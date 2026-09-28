# 5. Programmability & Administration

**Goal:** package logic inside the database (stored procedures, functions, triggers), keep
data consistent (transactions), and keep it safe (users, roles, SQL injection defence).

## 5.1 The DELIMITER command

A procedure body contains `;` characters. The `mysql` CLI would normally treat the first
`;` as the end of the whole `CREATE PROCEDURE`, so you temporarily change the client's
statement terminator:

```
DELIMITER $$
CREATE PROCEDURE ... BEGIN ...; ...; END$$
DELIMITER ;
```

`DELIMITER` is a **client** command, and the server never sees it. The learning app
understands it too, and in the app you may also leave it out.

## 5.2 Stored procedures

A procedure is a named, stored block of SQL that you run with `CALL`. It can take `IN`,
`OUT` and `INOUT` parameters, use variables, `IF`, loops and error handling, and return result sets.

```sql
DROP PROCEDURE IF EXISTS sp_orders_by_status;
DELIMITER $$
CREATE PROCEDURE sp_orders_by_status(IN p_status VARCHAR(20))
BEGIN
  SELECT order_id, customer_id, order_date
  FROM orders
  WHERE status = p_status
  ORDER BY order_id;
END$$
DELIMITER ;

CALL sp_orders_by_status('returned');
```

OUT parameters, variables and control flow:

```sql
DROP PROCEDURE IF EXISTS sp_customer_stats;
DELIMITER $$
CREATE PROCEDURE sp_customer_stats(IN p_customer_id INT, OUT p_orders INT, OUT p_tier VARCHAR(20))
BEGIN
  DECLARE v_spend DECIMAL(12,2) DEFAULT 0;

  SELECT COUNT(*) INTO p_orders FROM orders WHERE customer_id = p_customer_id;

  SELECT COALESCE(SUM(p.amount), 0) INTO v_spend
  FROM orders o JOIN payments p ON p.order_id = o.order_id
  WHERE o.customer_id = p_customer_id;

  IF v_spend >= 15000 THEN SET p_tier = 'VIP';
  ELSEIF v_spend > 0  THEN SET p_tier = 'Regular';
  ELSE                     SET p_tier = 'Prospect';
  END IF;
END$$
DELIMITER ;

CALL sp_customer_stats(7, @orders, @tier);
SELECT @orders, @tier;
```

Validation and errors with `SIGNAL`, plus a handler:

```sql
DROP PROCEDURE IF EXISTS sp_restock_demo;
DELIMITER $$
CREATE PROCEDURE sp_restock_demo(IN p_product_id INT, IN p_qty INT)
BEGIN
  IF p_qty <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be positive';
  END IF;
  UPDATE products SET stock_qty = stock_qty + p_qty WHERE product_id = p_product_id;
  SELECT product_id, name, stock_qty FROM products WHERE product_id = p_product_id;
END$$
DELIMITER ;

CALL sp_restock_demo(4, 0);   -- raises the error
```

Inside procedures you can also use `WHILE ... DO ... END WHILE`, `LOOP` / `LEAVE`, cursors
and `DECLARE ... HANDLER FOR SQLEXCEPTION`. Look at the ready-made examples too:

```sql
SHOW CREATE PROCEDURE sp_customer_summary;
CALL sp_customer_summary(42);
```

## 5.3 Stored functions

A function returns **one value** and can be used inside SQL expressions. It must declare
its nature: `DETERMINISTIC`, `NO SQL`, `READS SQL DATA` or `MODIFIES SQL DATA`.

```sql
DROP FUNCTION IF EXISTS fn_customer_name;
DELIMITER $$
CREATE FUNCTION fn_customer_name(p_customer_id INT)
RETURNS VARCHAR(101)
READS SQL DATA
BEGIN
  RETURN (SELECT CONCAT(first_name, ' ', last_name) FROM customers WHERE customer_id = p_customer_id);
END$$
DELIMITER ;

SELECT order_id, fn_customer_name(customer_id) AS customer FROM orders LIMIT 5;
```

| | Procedure | Function |
|---|---|---|
| Called with | `CALL p(...)` | inside an expression: `SELECT f(x)` |
| Returns | 0..n result sets, OUT parameters | exactly one value |
| Can use transactions | yes | no |
| Typical use | business operations ("place order") | reusable calculations |

> Calling a function for every row runs its query once per row. On big tables, a JOIN is usually much faster.

## 5.4 Triggers

A trigger runs automatically `BEFORE` or `AFTER` an `INSERT`, `UPDATE` or `DELETE` on a
table, once for each row. `OLD.col` and `NEW.col` hold the row before and after the change.

```sql
CREATE TABLE IF NOT EXISTS price_audit (
  audit_id   INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  old_price  DECIMAL(10,2),
  new_price  DECIMAL(10,2),
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_products_price_audit;
DELIMITER $$
CREATE TRIGGER trg_products_price_audit
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  IF NEW.unit_price <> OLD.unit_price THEN
    INSERT INTO price_audit (product_id, old_price, new_price)
    VALUES (OLD.product_id, OLD.unit_price, NEW.unit_price);
  END IF;
END$$
DELIMITER ;

UPDATE products SET unit_price = unit_price + 1 WHERE product_id = 33;
SELECT * FROM price_audit;
```

Good uses: audit trails, derived columns, extra validation (`BEFORE INSERT` + `SIGNAL`).
Use them sparingly: hidden logic surprises people and slows down writes.

## 5.5 Transactions

A transaction groups statements into **one unit of work** that either fully happens or doesn't happen at all.
The guarantees are known as **ACID**:

| | Guarantee |
|---|---|
| **A**tomicity | all or nothing |
| **C**onsistency | constraints hold before and after |
| **I**solation | concurrent transactions don't see each other's half-finished work |
| **D**urability | once committed, the data survives a crash |

```sql
USE playground;
SELECT * FROM accounts;

START TRANSACTION;
UPDATE accounts SET balance = balance - 250 WHERE account_id = 1;   -- Alice pays
UPDATE accounts SET balance = balance + 250 WHERE account_id = 2;   -- Bob receives
INSERT INTO transfers (from_account, to_account, amount) VALUES (1, 2, 250);
COMMIT;

SELECT * FROM accounts;
```

`ROLLBACK` undoes everything since `START TRANSACTION`, and `SAVEPOINT` lets you undo part of it:

```sql
USE playground;
START TRANSACTION;
UPDATE accounts SET balance = balance + 1000 WHERE account_id = 4;
SAVEPOINT after_bonus;
DELETE FROM accounts;                 -- oops!
ROLLBACK TO SAVEPOINT after_bonus;    -- the accounts are back, the bonus is kept
SELECT * FROM accounts;
ROLLBACK;                             -- undo the bonus as well
SELECT * FROM accounts;
```

Things to know in MySQL:

- **Autocommit** is on by default, so each statement commits on its own unless you `START TRANSACTION`.
- **DDL commits implicitly.** `CREATE`/`ALTER`/`DROP` inside a transaction ends it.
- Only **InnoDB** tables are transactional, which is the default engine.
- The default **isolation level** is `REPEATABLE READ`. Others are `READ COMMITTED`, `READ UNCOMMITTED` and `SERIALIZABLE`.
  Check it with `SELECT @@transaction_isolation;`.
- `SELECT ... FOR UPDATE` locks the rows you read, so two sessions can't sell the last item twice.
- A **deadlock** happens when two transactions wait for each other. MySQL kills one of them, and your code should retry.

> **Experiment:** open Adminer or the mysql CLI as a second session. `START TRANSACTION`
> and `UPDATE` a row in the app's Console, *without* committing. Then try to update the same
> row from the second session: it waits for the lock. `COMMIT` in the Console releases it.

## 5.6 Users, roles and privileges (DCL)

Follow the **principle of least privilege**: every application and person gets only what they need.

```sql
-- a role bundles privileges
CREATE ROLE IF NOT EXISTS analyst_role;
GRANT SELECT ON shopdb.* TO analyst_role;
GRANT SELECT, INSERT, UPDATE ON playground.* TO analyst_role;

-- a user that gets the role
CREATE USER IF NOT EXISTS 'report_bot'@'%' IDENTIFIED BY 'Chang3-Me!';
GRANT analyst_role TO 'report_bot'@'%';
SET DEFAULT ROLE analyst_role TO 'report_bot'@'%';

SHOW GRANTS FOR analyst_role;
SHOW GRANTS FOR 'report_bot'@'%' USING analyst_role;
```

```sql
-- take things away again
REVOKE INSERT, UPDATE ON playground.* FROM analyst_role;
DROP USER IF EXISTS 'report_bot'@'%';
DROP ROLE IF EXISTS analyst_role;
```

Privileges can be granted at the global (`*.*`), database (`db.*`), table (`db.t`) and
column (`GRANT SELECT (name, email) ON shopdb.customers`) level. A view plus `GRANT SELECT`
on the view is a neat way to expose only safe columns.

Other admin essentials:

| Task | Command / tool |
|---|---|
| Who is connected, what is running | `SHOW PROCESSLIST;` |
| Kill a runaway query | `KILL <id>;` |
| Server settings | `SHOW VARIABLES LIKE 'max_connections';` |
| Table sizes | `SELECT table_name, table_rows, data_length FROM information_schema.tables WHERE table_schema = 'shopdb';` |
| Backup / restore | `mysqldump` (see `workstation\backup.ps1` / `restore.ps1`) |

## 5.7 SQL injection

SQL injection happens when an application **builds SQL by concatenating user input**.
The input escapes its string and becomes code.

```js
// VULNERABLE (any language)
sql = "SELECT * FROM app_users WHERE username = '" + user + "' AND password_hash = SHA2('" + pass + "', 256)";
```

If the user types the username `admin' -- `, the database receives:

```sql
USE playground;
SELECT user_id, username, is_admin FROM app_users
WHERE username = 'admin' -- ' AND password_hash = SHA2('anything', 256)
;
```

Everything after `-- ` is a comment, so the password check vanishes and you are logged
in as admin. The input `' OR '1'='1` returns every user. With stacked queries,
`'; DROP TABLE app_users; -- ` is possible too.

### Defences

1. **Parameterised queries / prepared statements.** This is *the* fix. The SQL text and
   the values travel separately, so input is never parsed as SQL.
   ```js
   // Node.js (mysql2)
   const [rows] = await db.execute(
     'SELECT user_id FROM app_users WHERE username = ? AND password_hash = SHA2(?, 256)', [user, pass]);
   ```
   ```python
   # Python
   cur.execute("SELECT user_id FROM app_users WHERE username = %s", (user,))
   ```
   The same mechanism, in pure SQL:
   ```sql
   USE playground;
   PREPARE login_stmt FROM
     'SELECT user_id, username, is_admin FROM app_users WHERE username = ? AND password_hash = SHA2(?, 256)';
   SET @u = 'admin'' -- ', @p = 'anything';
   EXECUTE login_stmt USING @u, @p;     -- no rows: the attack is just a weird username
   SET @u = 'alice', @p = 'wonderland';
   EXECUTE login_stmt USING @u, @p;     -- alice logs in
   DEALLOCATE PREPARE login_stmt;
   ```
2. **Least privilege.** The app's DB user should not be able to `DROP` anything.
3. **Allow-list identifiers.** Placeholders only work for *values*. Table or column names
   (for example a user-chosen sort column) must be checked against a fixed list.
4. **Never build dynamic SQL from input inside stored procedures** either. Use `PREPARE ... USING`.
5. **Store password hashes** made with a slow, salted algorithm in the application (bcrypt or argon2),
   never plain text. The `SHA2` here only keeps the demo simple.
6. Validate input, turn off verbose error messages in production, and keep drivers up to date.

## Practice

Open **Practice → 5. Programmability & Administration** (8 exercises). Then keep the
[cheat sheet](06-cheatsheet.md) open and take the **Lab Assessment**.

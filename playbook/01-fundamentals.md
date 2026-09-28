# 1. Basics & Fundamentals

**Goal:** create and change tables (DDL), add and modify data (DML), and retrieve exactly
the rows you want (DQL), with filtering, sorting and paging.

## 1.1 Tables, rows, columns and data types

A **table** holds rows of the same shape. Every **column** has a data type and optional
constraints. The most common MySQL types:

| Type | Use for | Example |
|---|---|---|
| `INT`, `BIGINT` | whole numbers, ids | `42` |
| `DECIMAL(p,s)` | money and exact decimals (**never FLOAT for money**) | `DECIMAL(10,2)` → `12345678.90` |
| `VARCHAR(n)` | variable-length text up to *n* characters | `'Colombo'` |
| `CHAR(n)` | fixed-length text | country codes, hashes |
| `TEXT` | long text | reviews, descriptions |
| `DATE`, `DATETIME`, `TIMESTAMP` | dates and times | `'2024-03-15'`, `'2024-03-15 14:30:00'` |
| `TINYINT(1)` / `BOOLEAN` | true/false flags | `1` / `0` |
| `ENUM(...)` | one value from a fixed list | `ENUM('pending','shipped')` |
| `JSON` | semi-structured documents | `'{"size": "L"}'` |

## 1.2 DDL: CREATE, ALTER, DROP

Create tables in the **playground** database (switch with `USE playground;` or pick it in the Console).

```sql
USE playground;

CREATE TABLE students (
  student_id  INT          AUTO_INCREMENT PRIMARY KEY,  -- unique id, generated for you
  full_name   VARCHAR(100) NOT NULL,                    -- must always have a value
  email       VARCHAR(120) NOT NULL UNIQUE,             -- no two students share an email
  enrolled_on DATE         NOT NULL DEFAULT (CURRENT_DATE),
  gpa         DECIMAL(3,2) CHECK (gpa BETWEEN 0 AND 4)  -- rule enforced by the database
);
```

**Constraints** are rules the database enforces for you:

| Constraint | Meaning |
|---|---|
| `PRIMARY KEY` | uniquely identifies a row; implies NOT NULL + UNIQUE; one per table |
| `NOT NULL` | a value is required |
| `UNIQUE` | no duplicates in this column (NULLs are allowed) |
| `DEFAULT` | value used when an INSERT doesn't supply one |
| `CHECK` | a condition every row must satisfy |
| `FOREIGN KEY` | the value must exist in another table (see chapter 4) |

Change an existing table with `ALTER TABLE`:

```sql
USE playground;
ALTER TABLE students ADD COLUMN phone VARCHAR(20) NULL AFTER email;
ALTER TABLE students MODIFY COLUMN full_name VARCHAR(150) NOT NULL;
ALTER TABLE students RENAME COLUMN phone TO mobile;
ALTER TABLE students DROP COLUMN mobile;
DESCRIBE students;
```

Removing things:

| Command | What it removes | Can you undo it in a transaction? |
|---|---|---|
| `DELETE FROM t WHERE ...` | chosen rows | yes |
| `TRUNCATE TABLE t` | **all** rows, fast; resets AUTO_INCREMENT | no (it is DDL) |
| `DROP TABLE t` | the table itself, structure and data | no |

```sql
USE playground;
DROP TABLE IF EXISTS students;
```

> **Warning:** in MySQL, every DDL statement performs an **implicit COMMIT**. You cannot
> roll back a `DROP TABLE`. Keep backups (`workstation\backup.ps1`).

## 1.3 DML: INSERT, UPDATE, DELETE

```sql
-- one row, naming the columns (always name them: the table may gain columns later)
INSERT INTO departments (name, location, budget)
VALUES ('Data Science', 'Colombo', 350000);

-- several rows in one statement (much faster than many single INSERTs)
INSERT INTO suppliers (name, country, contact_email) VALUES
  ('Lanka Tech Traders', 'Sri Lanka', 'hello@lankatech.lk'),
  ('Maple Outdoor Co',   'Canada',    NULL);

-- copy rows from a query
-- INSERT INTO archive_table (cols...) SELECT cols... FROM source WHERE ...;
```

```sql
-- UPDATE: always write the WHERE first!
UPDATE employees
SET salary = salary * 1.10
WHERE department_id = 6;

-- DELETE: same rule
DELETE FROM product_reviews
WHERE rating = 1 AND review_text IS NULL;
```

> **Safe-update habit:** before any UPDATE or DELETE, run the same `WHERE` as a
> `SELECT COUNT(*)` to see how many rows you are about to touch. Or wrap the change in
> `START TRANSACTION; ... ROLLBACK;` while you test (see chapter 5).

## 1.4 DQL: SELECT ... FROM ... WHERE

```sql
SELECT first_name, last_name, email      -- which columns
FROM customers                           -- from which table
WHERE country = 'Sri Lanka';             -- which rows
```

- `SELECT *` returns all columns. That's fine for exploring, but avoid it in real code.
- Give columns and expressions readable names with **aliases**: `expr AS alias`.
- Text literals use **single quotes**. Escape a quote by doubling it: `'O''Brien'`.

```sql
SELECT name,
       unit_price,
       unit_price - cost_price                                AS margin,
       ROUND((unit_price - cost_price) / unit_price * 100, 1) AS margin_pct
FROM products;
```

### Comparison and logical operators

| Operator | Example |
|---|---|
| `=`, `<>` (or `!=`), `<`, `<=`, `>`, `>=` | `unit_price >= 100` |
| `AND`, `OR`, `NOT` | `is_active = 1 AND stock_qty > 0` |
| `BETWEEN a AND b` (inclusive) | `stock_qty BETWEEN 20 AND 200` |
| `IN (...)` | `status IN ('shipped', 'delivered')` |
| `LIKE` with `%` (any run of characters) and `_` (exactly one) | `last_name LIKE 'O%'` |
| `IS NULL`, `IS NOT NULL` | `phone IS NULL` |

`AND` binds tighter than `OR`. **Use parentheses** whenever you mix them:

```sql
-- products that are active AND (cheap OR plentiful)
SELECT name, unit_price, stock_qty
FROM products
WHERE is_active = 1
  AND (unit_price < 30 OR stock_qty > 200);
```

### NULL: the "unknown" value

`NULL` means *unknown* or *missing*. Any comparison with NULL, even `NULL = NULL`,
evaluates to *unknown*, and `WHERE` only keeps rows where the condition is *true*.

```sql
SELECT COUNT(*) FROM customers WHERE phone = NULL;   -- 0 rows: wrong!
SELECT COUNT(*) FROM customers WHERE phone IS NULL;  -- correct
SELECT first_name, COALESCE(phone, 'no phone') AS phone FROM customers LIMIT 10;
```

### Dates in WHERE

`order_date` is a `DATETIME`. `BETWEEN '2024-03-01' AND '2024-03-31'` means *up to
midnight at the start of* 31 March, so it silently drops most orders from that day. Use a
**half-open range** instead:

```sql
SELECT order_id, order_date, status
FROM orders
WHERE order_date >= '2024-03-01'
  AND order_date <  '2024-04-01';
```

## 1.5 Sorting and limiting: ORDER BY, DISTINCT, LIMIT

```sql
SELECT name, unit_price
FROM products
ORDER BY unit_price DESC, name ASC   -- tie-breaker: always make the order deterministic
LIMIT 5;                              -- first 5 rows
```

```sql
-- paging: rows 11-20
SELECT customer_id, email FROM customers ORDER BY customer_id LIMIT 10 OFFSET 10;
```

```sql
SELECT DISTINCT country FROM customers ORDER BY country;
SELECT DISTINCT city, country FROM customers;  -- distinct *combinations*
```

- Without `ORDER BY`, row order is **not guaranteed**, not even "insertion order".
- **Dialect note:** SQL Server uses `SELECT TOP 5 ...` or `OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY`. PostgreSQL supports `LIMIT` like MySQL.

## 1.6 How a query is actually evaluated

You *write* clauses in this order: `SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT`.
The database *logically evaluates* them in this order:

```
1. FROM / JOIN     build the working set of rows
2. WHERE           filter rows
3. GROUP BY        form groups
4. HAVING          filter groups
5. SELECT          compute expressions and aliases
6. DISTINCT        remove duplicates
7. ORDER BY        sort (aliases are visible here)
8. LIMIT / OFFSET  cut
```

This explains a classic error: you **cannot use a SELECT alias in WHERE**, because WHERE
runs before SELECT. You *can* use it in ORDER BY (and, in MySQL, in HAVING).

## Common mistakes

- Forgetting the `WHERE` on an UPDATE or DELETE.
- Writing `= NULL` instead of `IS NULL`.
- Using `BETWEEN` with DATETIME columns.
- Using `FLOAT` for money (`0.1 + 0.2 ≠ 0.3`). Use `DECIMAL`.
- Relying on row order without `ORDER BY`.

## Practice

Open **Practice → 1. Basics & Fundamentals** (15 exercises). Next chapter: [2. Intermediate](02-intermediate.md).

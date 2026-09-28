# 2. Intermediate SQL

**Goal:** summarise data (aggregations), combine tables (joins), stack result sets (unions)
and put decisions inside queries (CASE).

## 2.1 Aggregate functions

Aggregates collapse many rows into one value:

| Function | Returns | NULL handling |
|---|---|---|
| `COUNT(*)` | number of rows | counts every row |
| `COUNT(col)` | number of non-NULL values | ignores NULLs |
| `COUNT(DISTINCT col)` | number of different non-NULL values | ignores NULLs |
| `SUM(col)`, `AVG(col)` | total, mean | ignore NULLs (AVG of 10, NULL, 20 is 15) |
| `MIN(col)`, `MAX(col)` | smallest, largest | ignore NULLs |

```sql
SELECT COUNT(*)            AS customers,
       COUNT(phone)        AS with_phone,
       COUNT(DISTINCT country) AS countries
FROM customers;
```

## 2.2 GROUP BY and HAVING

`GROUP BY` produces **one output row per group**. Every column in the SELECT must either
be in the GROUP BY or be inside an aggregate. MySQL enforces this with the default
`ONLY_FULL_GROUP_BY` mode.

```sql
SELECT status, COUNT(*) AS order_count
FROM orders
GROUP BY status
ORDER BY order_count DESC;
```

**WHERE filters rows *before* grouping; HAVING filters groups *after* aggregation.**

```sql
SELECT customer_id, COUNT(*) AS order_count
FROM orders
WHERE status <> 'cancelled'          -- row filter
GROUP BY customer_id
HAVING COUNT(*) >= 18                -- group filter
ORDER BY order_count DESC;
```

Group by several columns, or by an expression:

```sql
SELECT YEAR(order_date) AS yr, MONTH(order_date) AS mon, COUNT(*) AS orders
FROM orders
GROUP BY YEAR(order_date), MONTH(order_date)
ORDER BY yr, mon;
```

`WITH ROLLUP` adds subtotal and grand-total rows:

```sql
SELECT ship_country, status, COUNT(*) AS orders
FROM orders
GROUP BY ship_country, status WITH ROLLUP;
```

## 2.3 Joins

A join matches rows from two tables using a condition, usually *foreign key = primary key*.

```
customers                    orders
customer_id | name           order_id | customer_id
1           | Bella   ───┬── 10       | 1
2           | Carlos     └── 11       | 1
3           | Diana (no orders)
```

| Join | Keeps |
|---|---|
| `INNER JOIN` (or plain `JOIN`) | only rows that match on both sides |
| `LEFT JOIN` | **all** rows from the left table, plus matches (NULLs where there is no match) |
| `RIGHT JOIN` | all rows from the right table, plus matches |
| `FULL OUTER JOIN` | all rows from both sides. **Not supported in MySQL**; emulate it (below) |
| `CROSS JOIN` | every combination (rows × rows) |
| self join | a table joined to itself under two aliases |

### INNER JOIN

```sql
SELECT o.order_id, o.order_date, CONCAT(c.first_name, ' ', c.last_name) AS customer
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.order_date >= '2024-12-01';
```

Chain joins to walk across the schema:

```sql
SELECT c.name AS category,
       ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS revenue
FROM order_items oi
JOIN orders     o ON o.order_id    = oi.order_id
JOIN products   p ON p.product_id  = oi.product_id
JOIN categories c ON c.category_id = p.category_id
WHERE o.status <> 'cancelled'
GROUP BY c.name
ORDER BY revenue DESC;
```

### LEFT JOIN and the anti-join

```sql
-- every customer and how many orders they placed (including zero)
SELECT c.customer_id, c.email, COUNT(o.order_id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.email
ORDER BY orders
LIMIT 15;
```

```sql
-- customers who have NEVER ordered: the "anti-join"
SELECT c.customer_id, c.email
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;
```

> **Classic trap:** a condition on the *right* table in `WHERE` turns a LEFT JOIN back
> into an INNER JOIN, because the NULL rows fail the test. Put such conditions in the `ON` clause:
> `LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered'`.

### Self join

```sql
SELECT CONCAT(e.first_name, ' ', e.last_name) AS employee,
       CONCAT(m.first_name, ' ', m.last_name) AS manager
FROM employees e
LEFT JOIN employees m ON m.employee_id = e.manager_id;
```

### FULL OUTER JOIN in MySQL

```sql
SELECT d.name AS department, e.first_name
FROM departments d LEFT JOIN employees e ON e.department_id = d.department_id
UNION
SELECT d.name, e.first_name
FROM departments d RIGHT JOIN employees e ON e.department_id = d.department_id;
```

The *Research* department (no staff) and *Zoe* (no department) both appear.

> **Gotcha:** `FROM departments FULL JOIN employees ...` does **not** raise an error in
> MySQL. It treats `FULL` as a table alias and runs an ordinary join!

### Join fan-out

Joining a *one* row to *many* rows repeats the *one* row. If you then `SUM` a column from
the *one* side, you count it several times:

```sql
-- WRONG: budget is repeated once per employee
SELECT SUM(d.budget) FROM departments d JOIN employees e ON e.department_id = d.department_id;
-- RIGHT
SELECT SUM(budget) FROM departments;
```

When you combine two *many* relationships (a product's order lines **and** its reviews),
aggregate each one separately in a subquery first, then join the results.

## 2.4 UNION and UNION ALL

Stack the results of two queries. They must have the **same number of columns** with
compatible types. The column names come from the first query.

| | Duplicates | Speed |
|---|---|---|
| `UNION` | removed | slower (has to sort/hash) |
| `UNION ALL` | kept | faster. Use it unless you *need* de-duplication |

```sql
SELECT first_name, last_name, email, 'customer' AS contact_type FROM customers
UNION ALL
SELECT first_name, last_name, email, 'employee' FROM employees
ORDER BY last_name, first_name;   -- one ORDER BY sorts the combined result
```

MySQL 8 also has `INTERSECT` and `EXCEPT` (from 8.0.31):

```sql
SELECT city FROM customers
INTERSECT
SELECT location FROM departments;   -- cities with both customers and an office
```

## 2.5 CASE expressions

`CASE` is SQL's if/else. It returns a value and can be used anywhere an expression is allowed.

```sql
SELECT name, unit_price,
       CASE WHEN unit_price < 50  THEN 'Budget'
            WHEN unit_price < 300 THEN 'Mid-range'
            ELSE 'Premium'
       END AS price_band
FROM products;
```

The first matching `WHEN` wins. Without `ELSE`, unmatched rows return NULL.

**Conditional aggregation** (a "pivot"):

```sql
SELECT YEAR(order_date) AS yr,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
       SUM(CASE WHEN status = 'returned'  THEN 1 ELSE 0 END) AS returned
FROM orders
GROUP BY YEAR(order_date);
```

CASE inside UPDATE and ORDER BY:

```sql
START TRANSACTION;
UPDATE products
SET unit_price = CASE category_id WHEN 13 THEN unit_price * 1.10 WHEN 5 THEN unit_price * 0.95 END
WHERE category_id IN (5, 13);
SELECT name, unit_price FROM products WHERE category_id IN (5, 13);
ROLLBACK;   -- undo the experiment
```

```sql
SELECT order_id, status FROM orders
ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'shipped' THEN 2 ELSE 3 END, order_id
LIMIT 20;
```

Handy shortcuts: `IF(cond, a, b)`, `COALESCE(a, b, ...)` (first non-NULL), `NULLIF(a, b)`
(NULL if equal, which is handy to avoid division by zero: `x / NULLIF(y, 0)`).

## Common mistakes

- Selecting a column that is neither grouped nor aggregated.
- Using `WHERE` to filter an aggregate (use `HAVING`).
- Turning a LEFT JOIN into an INNER JOIN with a WHERE condition on the right table.
- Fan-out: summing a value that the join has duplicated.
- Using `UNION` when `UNION ALL` is what you meant (slower, and it can hide real duplicates).

## Practice

Open **Practice → 2. Intermediate SQL** (14 exercises). Next: [3. Advanced](03-advanced.md).

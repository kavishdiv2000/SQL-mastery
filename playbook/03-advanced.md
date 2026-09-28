# 3. Advanced Queries

**Goal:** nest queries (subqueries), structure complex logic (CTEs, including recursive
ones), compute across related rows without collapsing them (window functions), and
work with text and dates.

## 3.1 Subqueries

A subquery is a `SELECT` inside another statement. Where you put it decides what it must return:

| Kind | Returns | Typical place |
|---|---|---|
| scalar | exactly one value | `WHERE price > (SELECT AVG(...))`, in SELECT list |
| row / list | one column, many rows | `WHERE id IN (SELECT ...)` |
| table (derived table) | a whole result set | `FROM (SELECT ...) AS t` |
| correlated | re-evaluated per outer row | `WHERE salary > (SELECT AVG(...) WHERE dept = outer.dept)` |

```sql
-- scalar
SELECT name, unit_price
FROM products
WHERE unit_price > (SELECT AVG(unit_price) FROM products WHERE is_active = 1);
```

```sql
-- IN list: customers who bought a book
SELECT customer_id, first_name, last_name
FROM customers
WHERE customer_id IN (SELECT o.customer_id
                      FROM orders o
                      JOIN order_items oi ON oi.order_id = o.order_id
                      JOIN products p     ON p.product_id = oi.product_id
                      WHERE p.category_id = 13);
```

```sql
-- correlated: earns more than their department's average
SELECT e.first_name, e.last_name, e.department_id, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(e2.salary) FROM employees e2 WHERE e2.department_id = e.department_id);
```

```sql
-- derived table: average order value per country
SELECT ship_country, ROUND(AVG(order_total), 2) AS avg_order_value
FROM (SELECT o.order_id, o.ship_country,
             SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) AS order_total
      FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
      GROUP BY o.order_id, o.ship_country) AS t
GROUP BY ship_country
ORDER BY avg_order_value DESC;
```

### EXISTS / NOT EXISTS

`EXISTS` is true as soon as the subquery finds **one** row. It is ideal for "has any..." questions.

```sql
SELECT p.product_id, p.name
FROM products p
WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id);
```

> **The NOT IN + NULL trap:** `WHERE x NOT IN (SELECT col ...)` returns **no rows at all**
> if `col` contains a NULL, because `x <> NULL` is *unknown*. Prefer `NOT EXISTS`.
> Try it: `SELECT COUNT(*) FROM employees WHERE employee_id NOT IN (SELECT manager_id FROM employees);`
> returns 0 because the CEO's `manager_id` is NULL.

## 3.2 Common Table Expressions (WITH)

A CTE names a subquery so you can read the query top-down and reuse the result.

```sql
WITH customer_spend AS (
  SELECT o.customer_id, SUM(p.amount) AS total_spend
  FROM orders o
  JOIN payments p ON p.order_id = o.order_id
  GROUP BY o.customer_id
),
avg_spend AS (
  SELECT AVG(total_spend) AS avg_total FROM customer_spend
)
SELECT cs.customer_id, cs.total_spend
FROM customer_spend cs, avg_spend a
WHERE cs.total_spend > a.avg_total
ORDER BY cs.total_spend DESC;
```

### Recursive CTEs

A recursive CTE has an **anchor** (the starting rows) `UNION ALL` a **recursive member**
that refers to the CTE itself. It repeats until the recursive member returns no rows.

```sql
-- walk down the org chart from the CEO
WITH RECURSIVE org AS (
  SELECT employee_id, first_name, manager_id, 0 AS level,
         CAST(first_name AS CHAR(300)) AS chain
  FROM employees
  WHERE manager_id IS NULL AND department_id IS NOT NULL      -- anchor: the CEO
  UNION ALL
  SELECT e.employee_id, e.first_name, e.manager_id, o.level + 1,
         CONCAT(o.chain, ' > ', e.first_name)
  FROM employees e
  JOIN org o ON e.manager_id = o.employee_id                  -- recursive step
)
SELECT level, chain FROM org ORDER BY chain;
```

```sql
-- generate a series of dates (no calendar table needed)
WITH RECURSIVE days AS (
  SELECT DATE('2024-12-01') AS d
  UNION ALL
  SELECT d + INTERVAL 1 DAY FROM days WHERE d < '2024-12-31'
)
SELECT d, DAYNAME(d) FROM days;
```

- **CAST the anchor's text columns** wide enough. The column type comes from the anchor,
  so longer values built later are rejected ("Data too long").
- A safety net, `cte_max_recursion_depth` (default 1000), stops runaway recursion.

## 3.3 Window functions

A window function computes a value **across a set of related rows while keeping every row**.
GROUP BY collapses rows; a window function doesn't.

```
function(...) OVER (
  PARTITION BY ...   -- split rows into groups (optional)
  ORDER BY ...       -- order inside each group (needed for ranking / running totals)
  ROWS BETWEEN ...   -- frame: which rows around the current one (optional)
)
```

### Ranking

| Function | Ties 100, 90, 90, 80 give |
|---|---|
| `ROW_NUMBER()` | 1, 2, 3, 4 (always unique) |
| `RANK()` | 1, 2, 2, 4 (gaps after ties) |
| `DENSE_RANK()` | 1, 2, 2, 3 (no gaps) |
| `NTILE(n)` | splits the rows into *n* roughly equal buckets |

```sql
SELECT name, category_id, unit_price,
       ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY unit_price DESC) AS rn,
       RANK()       OVER (PARTITION BY category_id ORDER BY unit_price DESC) AS rnk,
       DENSE_RANK() OVER (PARTITION BY category_id ORDER BY unit_price DESC) AS drnk
FROM products
ORDER BY category_id, rn;
```

**Top-N per group**: you can't filter a window function in WHERE (it is computed after WHERE), so wrap it:

```sql
SELECT customer_id, order_id, order_date
FROM (SELECT customer_id, order_id, order_date,
             ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
      FROM orders) t
WHERE rn = 1;          -- latest order per customer
```

### LAG and LEAD: look at neighbouring rows

```sql
WITH monthly AS (
  SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, SUM(amount) AS revenue
  FROM payments GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
)
SELECT month, revenue,
       LAG(revenue)  OVER (ORDER BY month) AS prev_month,
       LEAD(revenue) OVER (ORDER BY month) AS next_month,
       ROUND(100 * (revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month), 1) AS growth_pct
FROM monthly
ORDER BY month;
```

`FIRST_VALUE()`, `LAST_VALUE()` and `NTH_VALUE()` work in a similar way.

### Aggregates as windows: running totals, shares, moving averages

```sql
SELECT DATE(payment_date) AS day,
       SUM(amount) AS daily_total,
       SUM(SUM(amount)) OVER (ORDER BY DATE(payment_date))                        AS running_total,
       ROUND(AVG(SUM(amount)) OVER (ORDER BY DATE(payment_date)
                                    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 2) AS moving_avg_7d
FROM payments
WHERE payment_date >= '2024-12-01' AND payment_date < '2025-01-01'
GROUP BY DATE(payment_date)
ORDER BY day;
```

```sql
-- each product's share of its category's stock
SELECT category_id, name, stock_qty,
       ROUND(100 * stock_qty / SUM(stock_qty) OVER (PARTITION BY category_id), 1) AS pct_of_category
FROM products
ORDER BY category_id, pct_of_category DESC;
```

> **Frames:** with `ORDER BY` and no explicit frame, the default is
> `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, and *RANGE* treats ties as one step.
> Use `ROWS BETWEEN ...` when you need row-by-row behaviour.

A named window avoids repetition: `... OVER w ... WINDOW w AS (PARTITION BY x ORDER BY y)`.

## 3.4 String functions

| Function | Example | Result |
|---|---|---|
| `CONCAT(a, b, ...)` | `CONCAT('Ada', ' ', 'Lovelace')` | `Ada Lovelace` |
| `CONCAT_WS(sep, ...)` | `CONCAT_WS(', ', city, country)` | `Colombo, Sri Lanka` (skips NULLs) |
| `UPPER`, `LOWER` | `UPPER('sql')` | `SQL` |
| `LENGTH` / `CHAR_LENGTH` | bytes / characters | `CHAR_LENGTH('héllo')` = 5 |
| `SUBSTRING(s, pos, len)` | `SUBSTRING('LAP-001', 1, 3)` | `LAP` |
| `LEFT`, `RIGHT` | `RIGHT('LAP-001', 3)` | `001` |
| `SUBSTRING_INDEX(s, delim, n)` | `SUBSTRING_INDEX('a@b.com', '@', -1)` | `b.com` |
| `TRIM`, `LTRIM`, `RTRIM` | `TRIM('  x ')` | `x` |
| `REPLACE(s, from, to)` | `REPLACE('O''Brien', '''', '')` | `OBrien` |
| `LPAD`, `RPAD` | `LPAD('7', 3, '0')` | `007` |
| `LOCATE(sub, s)` | `LOCATE('@', email)` | position |
| `REGEXP_LIKE`, `REGEXP_REPLACE` | `REGEXP_LIKE(sku, '^LAP-')` | 1 |
| `GROUP_CONCAT(... SEPARATOR ...)` | aggregate into one string | `Alice, Bob` |

```sql
SELECT customer_id,
       CONCAT(UPPER(last_name), ', ', first_name) AS display_name,
       SUBSTRING_INDEX(email, '@', -1)            AS email_domain,
       LPAD(customer_id, 6, '0')                  AS customer_code
FROM customers
LIMIT 10;
```

```sql
SELECT c.name AS category, GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') AS products
FROM categories c JOIN products p ON p.category_id = c.category_id
GROUP BY c.name;
```

## 3.5 Date and time functions

| Function | Example | Result |
|---|---|---|
| `NOW()`, `CURDATE()` | current datetime / date | |
| `DATE(dt)`, `TIME(dt)` | `DATE('2024-03-15 10:30:00')` | `2024-03-15` |
| `YEAR`, `MONTH`, `DAY`, `QUARTER`, `WEEK`, `DAYOFWEEK` | `QUARTER('2024-08-01')` | `3` |
| `DAYNAME`, `MONTHNAME` | `DAYNAME('2024-03-15')` | `Friday` |
| `DATE_FORMAT(d, fmt)` | `DATE_FORMAT(d, '%d %b %Y')` | `15 Mar 2024` |
| `STR_TO_DATE(s, fmt)` | `STR_TO_DATE('15/03/2024', '%d/%m/%Y')` | `2024-03-15` |
| `DATEDIFF(a, b)` | `DATEDIFF('2024-03-15', '2024-03-01')` | `14` (days) |
| `TIMESTAMPDIFF(unit, a, b)` | `TIMESTAMPDIFF(YEAR, birth_date, CURDATE())` | age |
| `DATE_ADD`, `DATE_SUB`, `+ INTERVAL` | `order_date + INTERVAL 30 DAY` | |
| `LAST_DAY(d)` | `LAST_DAY('2024-02-10')` | `2024-02-29` |

```sql
SELECT ship_country,
       ROUND(AVG(DATEDIFF(shipped_date, order_date)), 2) AS avg_days_to_ship
FROM orders
WHERE status = 'delivered'
GROUP BY ship_country
ORDER BY avg_days_to_ship;
```

```sql
SELECT customer_id,
       TIMESTAMPDIFF(YEAR, birth_date, '2025-01-01') AS age,
       DAYNAME(signup_date) AS signup_weekday,
       CONCAT(YEAR(signup_date), '-Q', QUARTER(signup_date)) AS signup_quarter
FROM customers
LIMIT 10;
```

## Common mistakes

- `NOT IN` against a subquery that can return NULL.
- Filtering a window function in `WHERE` instead of an outer query.
- A recursive CTE anchor column that is too narrow for later values.
- Mixing up `RANK` and `DENSE_RANK` when the question says "top 3 *distinct* values".
- Calling `NOW()` in queries whose result must be reproducible. Use a fixed date.

## Practice

Open **Practice → 3. Advanced Queries** (16 exercises). Next: [4. Design & Performance](04-design-performance.md).

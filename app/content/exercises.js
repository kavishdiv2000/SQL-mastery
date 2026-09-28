// Practice exercises for the SQL Mastery app.
// Each exercise is auto-graded by comparing your result with the model solution
// (see lib/grader.js for what every field means).
//
// Revenue convention used throughout: quantity * unit_price * (1 - discount)

/** MySQL has no DROP INDEX IF EXISTS, so build it with a prepared statement. */
const dropIndexIfExists = (table, index) => `
SET @sqlm_drop = (SELECT IF(COUNT(*) > 0, 'DROP INDEX ${index} ON ${table}', 'DO 0')
                    FROM information_schema.statistics
                   WHERE table_schema = DATABASE() AND table_name = '${table}' AND index_name = '${index}');
PREPARE sqlm_stmt FROM @sqlm_drop;
EXECUTE sqlm_stmt;
DEALLOCATE PREPARE sqlm_stmt;`;

const indexCheck = (table, index) => `
SELECT index_name, column_name, seq_in_index
  FROM information_schema.statistics
 WHERE table_schema = 'shopdb' AND table_name = '${table}' AND index_name = '${index}'
 ORDER BY seq_in_index`;

const resetAccounts = `
DELETE FROM transfers;
DELETE FROM accounts;
INSERT INTO accounts (account_id, owner, balance) VALUES
  (1, 'Alice', 1000.00), (2, 'Bob', 500.00), (3, 'Charlie', 2500.00), (4, 'Dana', 0.00);`;

module.exports = [
  // ===================================================================
  {
    id: 'm1',
    title: '1. Basics & Fundamentals',
    playbook: '01-fundamentals',
    summary: 'DDL, DML and DQL - creating tables, changing data and asking questions with SELECT, WHERE, ORDER BY, DISTINCT, LIMIT, BETWEEN, IN and LIKE.',
    exercises: [
      {
        id: 'm1-select',
        topic: 'DQL',
        title: 'Your first SELECT',
        prompt: 'List the `first_name`, `last_name` and `email` of every customer who lives in **Sri Lanka** (`country` column).',
        hint: 'SELECT columns FROM table WHERE condition. Text values go in single quotes.',
        solution: `SELECT first_name, last_name, email
FROM customers
WHERE country = 'Sri Lanka';`,
      },
      {
        id: 'm1-where-and',
        topic: 'Filtering',
        title: 'Combining conditions',
        prompt: 'Find **active** products (`is_active = 1`) that cost **less than 50** and have **more than 100** units in stock. Return `product_id`, `name`, `unit_price`, `stock_qty`.',
        hint: 'Combine conditions with AND.',
        solution: `SELECT product_id, name, unit_price, stock_qty
FROM products
WHERE is_active = 1
  AND unit_price < 50
  AND stock_qty > 100;`,
      },
      {
        id: 'm1-order-limit',
        topic: 'Sorting',
        title: 'Top 5 most expensive',
        prompt: 'Show the **5 most expensive** products (including discontinued ones). Return `name` and `unit_price`, most expensive first.',
        hint: 'ORDER BY unit_price DESC, then LIMIT 5. (SQL Server uses TOP 5 instead of LIMIT.)',
        ordered: true,
        solution: `SELECT name, unit_price
FROM products
ORDER BY unit_price DESC
LIMIT 5;`,
      },
      {
        id: 'm1-distinct',
        topic: 'Sorting',
        title: 'DISTINCT countries',
        prompt: 'Which **distinct** countries do customers come from? Return a single column `country`, sorted alphabetically.',
        hint: 'SELECT DISTINCT removes duplicate rows.',
        ordered: true,
        solution: `SELECT DISTINCT country
FROM customers
ORDER BY country;`,
      },
      {
        id: 'm1-date-range',
        topic: 'Filtering',
        title: 'Date ranges & IN',
        prompt: 'List orders placed in **March 2024** whose `status` is `shipped` or `delivered`. Return `order_id`, `order_date`, `status`. Careful: `order_date` is a DATETIME, so `BETWEEN \'2024-03-01\' AND \'2024-03-31\'` would miss orders placed during the day on 31 March.',
        hint: "Use a half-open range: order_date >= '2024-03-01' AND order_date < '2024-04-01'. Use IN ('shipped','delivered') for the status list.",
        solution: `SELECT order_id, order_date, status
FROM orders
WHERE order_date >= '2024-03-01'
  AND order_date <  '2024-04-01'
  AND status IN ('shipped', 'delivered');`,
      },
      {
        id: 'm1-like',
        topic: 'Filtering',
        title: 'Pattern matching with LIKE',
        prompt: 'Find customers whose **last name starts with "O"** (e.g. Okafor, O\'Brien). Return `customer_id`, `first_name`, `last_name`.',
        hint: "LIKE 'O%' - % matches any number of characters, _ matches exactly one.",
        solution: `SELECT customer_id, first_name, last_name
FROM customers
WHERE last_name LIKE 'O%';`,
      },
      {
        id: 'm1-null',
        topic: 'Filtering',
        title: 'Working with NULL',
        prompt: 'List employees who do **not** have a commission (`commission_pct` is NULL). Return `first_name`, `last_name`, `job_title`.',
        hint: '"= NULL" is never true. Use IS NULL / IS NOT NULL.',
        forbids: [['=\\s*NULL', 'Comparing with "= NULL" never matches anything - use IS NULL.']],
        solution: `SELECT first_name, last_name, job_title
FROM employees
WHERE commission_pct IS NULL;`,
      },
      {
        id: 'm1-expressions',
        topic: 'DQL',
        title: 'Calculated columns & aliases',
        prompt: 'For each product return `name`, `unit_price`, `cost_price`, `margin` (= unit_price - cost_price) and `margin_pct` (= margin / unit_price * 100, **rounded to 1 decimal**). Only include products whose **unrounded** margin percentage is **above 60**. Sort by `margin_pct` descending, then `name`.',
        hint: 'You cannot use a column alias in WHERE (WHERE runs before SELECT) - repeat the expression. You CAN use aliases in ORDER BY.',
        ordered: true,
        solution: `SELECT name,
       unit_price,
       cost_price,
       unit_price - cost_price                               AS margin,
       ROUND((unit_price - cost_price) / unit_price * 100, 1) AS margin_pct
FROM products
WHERE (unit_price - cost_price) / unit_price * 100 > 60
ORDER BY margin_pct DESC, name;`,
      },
      {
        id: 'm1-create-table',
        topic: 'DDL',
        title: 'CREATE TABLE',
        db: 'playground',
        ddl: true,
        prompt: 'In the **playground** database create a table `students` with: `student_id` INT auto-increment primary key; `full_name` VARCHAR(100) NOT NULL; `email` VARCHAR(120) NOT NULL and UNIQUE; `enrolled_on` DATE NOT NULL.',
        hint: 'CREATE TABLE students ( col TYPE constraints, ... ). AUTO_INCREMENT PRIMARY KEY, NOT NULL, UNIQUE.',
        setup: 'DROP TABLE IF EXISTS students;',
        check: `SELECT column_name, data_type, character_maximum_length, is_nullable, column_key,
       (extra LIKE '%auto_increment%') AS is_auto_increment
  FROM information_schema.columns
 WHERE table_schema = 'playground' AND table_name = 'students'
 ORDER BY ordinal_position`,
        solution: `CREATE TABLE students (
  student_id  INT          AUTO_INCREMENT PRIMARY KEY,
  full_name   VARCHAR(100) NOT NULL,
  email       VARCHAR(120) NOT NULL UNIQUE,
  enrolled_on DATE         NOT NULL
);`,
      },
      {
        id: 'm1-alter-table',
        topic: 'DDL',
        title: 'ALTER TABLE',
        db: 'playground',
        ddl: true,
        prompt: 'A table `course_catalog (course_id INT PRIMARY KEY, title VARCHAR(50))` has been created for you in **playground**. Alter it so that `title` becomes **VARCHAR(150) NOT NULL**, and add a new column `price` **DECIMAL(8,2) NOT NULL DEFAULT 0** at the end.',
        hint: 'ALTER TABLE t MODIFY COLUMN col new_definition, ADD COLUMN col definition;',
        setup: `DROP TABLE IF EXISTS course_catalog;
CREATE TABLE course_catalog (course_id INT PRIMARY KEY, title VARCHAR(50));`,
        check: `SELECT column_name, column_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'playground' AND table_name = 'course_catalog'
 ORDER BY ordinal_position`,
        solution: `ALTER TABLE course_catalog
  MODIFY COLUMN title VARCHAR(150) NOT NULL,
  ADD COLUMN price DECIMAL(8,2) NOT NULL DEFAULT 0;`,
      },
      {
        id: 'm1-drop-table',
        topic: 'DDL',
        title: 'DROP TABLE',
        db: 'playground',
        ddl: true,
        prompt: 'A staging table `temp_import` exists in **playground** and is no longer needed. Remove the table completely (structure and data).',
        hint: 'DELETE removes rows, TRUNCATE empties the table quickly, DROP removes the table itself.',
        requires: [['DROP\\s+TABLE', 'Use DROP TABLE for this one.']],
        setup: `DROP TABLE IF EXISTS temp_import;
CREATE TABLE temp_import (id INT, payload VARCHAR(100));
INSERT INTO temp_import VALUES (1, 'a'), (2, 'b');`,
        check: `SELECT COUNT(*) AS tables_left
  FROM information_schema.tables
 WHERE table_schema = 'playground' AND table_name = 'temp_import'`,
        solution: 'DROP TABLE temp_import;',
      },
      {
        id: 'm1-insert',
        topic: 'DML',
        title: 'INSERT a row',
        prompt: 'Add a new department named **Data Science**, located in **Colombo**, with a budget of **350000**.',
        hint: 'INSERT INTO table (col1, col2, ...) VALUES (v1, v2, ...). Let AUTO_INCREMENT pick the id.',
        check: 'SELECT name, location, budget FROM departments ORDER BY department_id',
        solution: `INSERT INTO departments (name, location, budget)
VALUES ('Data Science', 'Colombo', 350000);`,
      },
      {
        id: 'm1-insert-multi',
        topic: 'DML',
        title: 'INSERT several rows at once',
        prompt: 'With a **single** INSERT statement add two suppliers: **Lanka Tech Traders** (Sri Lanka, hello@lankatech.lk) and **Maple Outdoor Co** (Canada, no contact email).',
        hint: 'VALUES (...), (...); - use NULL for the missing email.',
        forbids: [['INSERT[\\s\\S]*INSERT', 'Use one INSERT with two rows in the VALUES list.']],
        check: 'SELECT name, country, contact_email FROM suppliers ORDER BY supplier_id',
        solution: `INSERT INTO suppliers (name, country, contact_email) VALUES
  ('Lanka Tech Traders', 'Sri Lanka', 'hello@lankatech.lk'),
  ('Maple Outdoor Co',   'Canada',    NULL);`,
      },
      {
        id: 'm1-update',
        topic: 'DML',
        title: 'UPDATE with a WHERE',
        prompt: 'Give every employee in **Customer Support** (`department_id = 6`) a **10% raise**. (Practice runs are rolled back, so experiment freely.)',
        hint: 'UPDATE employees SET salary = salary * 1.10 WHERE ... - never forget the WHERE!',
        check: 'SELECT employee_id, salary FROM employees ORDER BY employee_id',
        solution: `UPDATE employees
SET salary = salary * 1.10
WHERE department_id = 6;`,
      },
      {
        id: 'm1-delete',
        topic: 'DML',
        title: 'DELETE rows',
        prompt: 'Delete every product review that has a **rating of 1** and **no review text**.',
        hint: 'Tip: run the same WHERE as a SELECT first to see what you are about to delete.',
        check: 'SELECT review_id FROM product_reviews ORDER BY review_id',
        solution: `DELETE FROM product_reviews
WHERE rating = 1
  AND review_text IS NULL;`,
      },
    ],
  },

  // ===================================================================
  {
    id: 'm2',
    title: '2. Intermediate SQL',
    playbook: '02-intermediate',
    summary: 'Aggregation with GROUP BY / HAVING, every kind of JOIN, UNION / UNION ALL and CASE expressions.',
    exercises: [
      {
        id: 'm2-count',
        topic: 'Aggregation',
        title: 'COUNT per group',
        prompt: 'How many orders are there per `status`? Return `status` and `order_count`.',
        hint: 'SELECT status, COUNT(*) ... GROUP BY status',
        solution: `SELECT status, COUNT(*) AS order_count
FROM orders
GROUP BY status;`,
      },
      {
        id: 'm2-sum-join',
        topic: 'Aggregation',
        title: 'Revenue per category',
        prompt: 'Calculate revenue per category: `category` (category name) and `revenue` = SUM(quantity * unit_price * (1 - discount)) from `order_items`, **rounded to 2 decimals**. Exclude **cancelled** orders.',
        hint: 'order_items -> orders (status) -> products -> categories. GROUP BY the category name.',
        solution: `SELECT c.name AS category,
       ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)), 2) AS revenue
FROM order_items oi
JOIN orders     o ON o.order_id    = oi.order_id
JOIN products   p ON p.product_id  = oi.product_id
JOIN categories c ON c.category_id = p.category_id
WHERE o.status <> 'cancelled'
GROUP BY c.name;`,
      },
      {
        id: 'm2-min-max-avg',
        topic: 'Aggregation',
        title: 'MIN, MAX, AVG',
        prompt: 'For every department that has employees return `department` (name), `headcount`, `min_salary`, `max_salary` and `avg_salary` (rounded to 2 decimals).',
        hint: 'An INNER JOIN automatically drops departments without employees.',
        solution: `SELECT d.name              AS department,
       COUNT(*)            AS headcount,
       MIN(e.salary)       AS min_salary,
       MAX(e.salary)       AS max_salary,
       ROUND(AVG(e.salary), 2) AS avg_salary
FROM departments d
JOIN employees e ON e.department_id = d.department_id
GROUP BY d.name;`,
      },
      {
        id: 'm2-having',
        topic: 'Aggregation',
        title: 'Filtering groups with HAVING',
        prompt: 'Which customers have placed **at least 18 orders**? Return `customer_id` and `order_count`, sorted by `order_count` descending then `customer_id`.',
        hint: 'WHERE filters rows before grouping; HAVING filters groups after aggregation.',
        ordered: true,
        requires: [['HAVING', 'Filter the groups with HAVING.']],
        solution: `SELECT customer_id, COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 18
ORDER BY order_count DESC, customer_id;`,
      },
      {
        id: 'm2-inner-join',
        topic: 'Joins',
        title: 'INNER JOIN',
        prompt: 'List orders placed in **December 2024** by customers who live in **Colombo** (use the customers table, not ship_city). Return `order_id`, `order_date` and `customer_name` (first name + space + last name).',
        hint: "JOIN customers c ON c.customer_id = o.customer_id; CONCAT(c.first_name, ' ', c.last_name)",
        solution: `SELECT o.order_id,
       o.order_date,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE c.city = 'Colombo'
  AND o.order_date >= '2024-12-01'
  AND o.order_date <  '2025-01-01';`,
      },
      {
        id: 'm2-left-join',
        topic: 'Joins',
        title: 'LEFT JOIN - find the missing',
        prompt: 'Find customers who have **never placed an order**. Return `customer_id` and `email`.',
        hint: 'LEFT JOIN orders and keep rows where the order side IS NULL (an "anti-join").',
        solution: `SELECT c.customer_id, c.email
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;`,
      },
      {
        id: 'm2-self-join',
        topic: 'Joins',
        title: 'Self join - who is my manager?',
        prompt: 'For **every** employee return `employee` (full name) and `manager` (manager\'s full name, NULL when they have no manager).',
        hint: 'Join employees to itself with two aliases: e (employee) and m (manager). Use LEFT JOIN so the CEO stays in.',
        solution: `SELECT CONCAT(e.first_name, ' ', e.last_name) AS employee,
       CONCAT(m.first_name, ' ', m.last_name) AS manager
FROM employees e
LEFT JOIN employees m ON m.employee_id = e.manager_id;`,
      },
      {
        id: 'm2-full-outer',
        topic: 'Joins',
        title: 'FULL OUTER JOIN in MySQL',
        prompt: 'MySQL has no FULL OUTER JOIN. Emulate it: list **all departments and all employees** as `department` (name) and `employee` (full name) - including departments with no employees (NULL employee) and employees with no department (NULL department).',
        hint: 'LEFT JOIN ... UNION ... RIGHT JOIN. UNION (not UNION ALL) removes the rows that appear in both halves.',
        requires: [['UNION', 'Emulate FULL OUTER JOIN with a UNION of a LEFT and a RIGHT join.']],
        solution: `SELECT d.name AS department, CONCAT(e.first_name, ' ', e.last_name) AS employee
FROM departments d
LEFT JOIN employees e ON e.department_id = d.department_id
UNION
SELECT d.name, CONCAT(e.first_name, ' ', e.last_name)
FROM departments d
RIGHT JOIN employees e ON e.department_id = d.department_id;`,
      },
      {
        id: 'm2-never-ordered',
        topic: 'Joins',
        title: 'Products never sold',
        prompt: 'Which products have **never appeared** in any order? Return `product_id` and `name`.',
        hint: 'Same anti-join pattern: products LEFT JOIN order_items ... IS NULL (or NOT EXISTS).',
        solution: `SELECT p.product_id, p.name
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.product_id
WHERE oi.order_item_id IS NULL;`,
      },
      {
        id: 'm2-union-all',
        topic: 'Unions',
        title: 'UNION ALL - one contact list',
        prompt: 'Build a single contact list of **all customers and all employees**: `first_name`, `last_name`, `email`, `contact_type` (the text \'customer\' or \'employee\').',
        hint: 'Both SELECTs must have the same number of columns in the same order. UNION ALL keeps everything (and is faster than UNION).',
        requires: [['UNION\\s+ALL', 'Use UNION ALL - there is nothing to de-duplicate here.']],
        solution: `SELECT first_name, last_name, email, 'customer' AS contact_type FROM customers
UNION ALL
SELECT first_name, last_name, email, 'employee' FROM employees;`,
      },
      {
        id: 'm2-union',
        topic: 'Unions',
        title: 'UNION - distinct cities',
        prompt: 'Return every **distinct** city where ShopCo has customers (`customers.city`) or an office (`departments.location`), as one column `city`, sorted alphabetically.',
        hint: 'UNION removes duplicates. A single ORDER BY at the end sorts the combined result.',
        ordered: true,
        solution: `SELECT city FROM customers
UNION
SELECT location FROM departments
ORDER BY city;`,
      },
      {
        id: 'm2-case',
        topic: 'CASE',
        title: 'CASE - price bands',
        prompt: 'Classify every product: return `name`, `unit_price` and `price_band` = \'Budget\' (under 50), \'Mid-range\' (50 up to but not including 300) or \'Premium\' (300 and above).',
        hint: 'CASE WHEN ... THEN ... WHEN ... THEN ... ELSE ... END - the first matching WHEN wins.',
        solution: `SELECT name,
       unit_price,
       CASE WHEN unit_price < 50  THEN 'Budget'
            WHEN unit_price < 300 THEN 'Mid-range'
            ELSE 'Premium'
       END AS price_band
FROM products;`,
      },
      {
        id: 'm2-case-pivot',
        topic: 'CASE',
        title: 'CASE inside aggregates (pivot)',
        prompt: 'Per order year return `order_year`, `delivered`, `cancelled`, `returned` - the number of orders with each status as separate columns. Sort by year.',
        hint: 'SUM(CASE WHEN status = \'delivered\' THEN 1 ELSE 0 END) - "conditional aggregation".',
        ordered: true,
        solution: `SELECT YEAR(order_date) AS order_year,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
       SUM(CASE WHEN status = 'returned'  THEN 1 ELSE 0 END) AS returned
FROM orders
GROUP BY YEAR(order_date)
ORDER BY order_year;`,
      },
      {
        id: 'm2-case-update',
        topic: 'CASE',
        title: 'CASE inside UPDATE',
        prompt: 'With a **single UPDATE**: raise the price of **Books** (`category_id = 13`) by 10% and cut the price of **Phones** (`category_id = 5`) by 5%. Round new prices to 2 decimals. Other products must not change.',
        hint: 'SET unit_price = CASE category_id WHEN 13 THEN ... WHEN 5 THEN ... END, and restrict with WHERE category_id IN (5, 13).',
        forbids: [['UPDATE[\\s\\S]*UPDATE', 'Do it in one UPDATE statement using CASE.']],
        check: 'SELECT product_id, unit_price FROM products ORDER BY product_id',
        solution: `UPDATE products
SET unit_price = CASE category_id
                   WHEN 13 THEN ROUND(unit_price * 1.10, 2)
                   WHEN 5  THEN ROUND(unit_price * 0.95, 2)
                 END
WHERE category_id IN (5, 13);`,
      },
    ],
  },

  // ===================================================================
  {
    id: 'm3',
    title: '3. Advanced Queries',
    playbook: '03-advanced',
    summary: 'Subqueries (scalar, IN, correlated, EXISTS), CTEs including recursive ones, window functions, and string & date functions.',
    exercises: [
      {
        id: 'm3-scalar-subquery',
        topic: 'Subqueries',
        title: 'Scalar subquery',
        prompt: 'Return `name` and `unit_price` of every product priced **above the average price of active products**.',
        hint: 'WHERE unit_price > (SELECT AVG(unit_price) FROM products WHERE is_active = 1)',
        solution: `SELECT name, unit_price
FROM products
WHERE unit_price > (SELECT AVG(unit_price) FROM products WHERE is_active = 1);`,
      },
      {
        id: 'm3-in-subquery',
        topic: 'Subqueries',
        title: 'IN (subquery)',
        prompt: 'Find customers who have bought at least one product from the **Books** category (`category_id = 13`). Return `customer_id`, `first_name`, `last_name` - each customer once. Use an `IN (SELECT ...)` subquery.',
        hint: 'The subquery returns the list of customer_ids that bought books.',
        requires: [['\\bIN\\s*\\(\\s*SELECT', 'Use an IN (SELECT ...) subquery for this exercise.']],
        solution: `SELECT customer_id, first_name, last_name
FROM customers
WHERE customer_id IN (
  SELECT o.customer_id
  FROM orders o
  JOIN order_items oi ON oi.order_id  = o.order_id
  JOIN products    p  ON p.product_id = oi.product_id
  WHERE p.category_id = 13
);`,
      },
      {
        id: 'm3-correlated',
        topic: 'Subqueries',
        title: 'Correlated subquery',
        prompt: 'List employees who earn **more than the average salary of their own department**. Return `first_name`, `last_name`, `department_id`, `salary`.',
        hint: 'The inner query refers to the outer row: WHERE e2.department_id = e.department_id. It is re-evaluated per employee.',
        solution: `SELECT e.first_name, e.last_name, e.department_id, e.salary
FROM employees e
WHERE e.salary > (
  SELECT AVG(e2.salary)
  FROM employees e2
  WHERE e2.department_id = e.department_id
);`,
      },
      {
        id: 'm3-exists',
        topic: 'Subqueries',
        title: 'EXISTS / NOT EXISTS',
        prompt: 'Which suppliers have **at least one product that has never been ordered**? Return the supplier `name`.',
        hint: 'EXISTS (products of this supplier AND NOT EXISTS (order_items for that product)).',
        requires: [['EXISTS', 'Solve this one with EXISTS / NOT EXISTS.']],
        solution: `SELECT s.name
FROM suppliers s
WHERE EXISTS (
  SELECT 1
  FROM products p
  WHERE p.supplier_id = s.supplier_id
    AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id)
);`,
      },
      {
        id: 'm3-derived-table',
        topic: 'Subqueries',
        title: 'Derived table (subquery in FROM)',
        prompt: 'What is the **average order value** per `ship_country` for **delivered** orders? First total each order (sum of its lines), then average those totals. Return `ship_country`, `avg_order_value` (2 decimals).',
        hint: 'SELECT ... FROM (SELECT order_id, ship_country, SUM(...) AS order_total FROM ... GROUP BY ...) t GROUP BY ship_country',
        solution: `SELECT ship_country, ROUND(AVG(order_total), 2) AS avg_order_value
FROM (
  SELECT o.order_id, o.ship_country,
         SUM(oi.quantity * oi.unit_price * (1 - oi.discount)) AS order_total
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status = 'delivered'
  GROUP BY o.order_id, o.ship_country
) t
GROUP BY ship_country;`,
      },
      {
        id: 'm3-cte',
        topic: 'CTEs',
        title: 'Readable queries with WITH',
        prompt: 'Using a **CTE**, compute each customer\'s total spend (sum of `payments.amount` over their orders) and return the customers whose spend is **above the average customer spend**. Return `customer_id`, `total_spend`.',
        hint: 'WITH customer_spend AS (...) SELECT ... FROM customer_spend WHERE total_spend > (SELECT AVG(total_spend) FROM customer_spend)',
        requires: [['\\bWITH\\b', 'Use a CTE (WITH ...).']],
        solution: `WITH customer_spend AS (
  SELECT o.customer_id, SUM(p.amount) AS total_spend
  FROM orders o
  JOIN payments p ON p.order_id = o.order_id
  GROUP BY o.customer_id
)
SELECT customer_id, total_spend
FROM customer_spend
WHERE total_spend > (SELECT AVG(total_spend) FROM customer_spend);`,
      },
      {
        id: 'm3-recursive-tree',
        topic: 'CTEs',
        title: 'Recursive CTE - category paths',
        prompt: 'Categories form a tree via `parent_category_id`. Return `category_id` and `path` for every category, where path looks like `Electronics > Computers > Laptops`.',
        hint: 'Anchor = root categories (parent IS NULL). Recursive part joins children to the rows found so far. CAST the anchor path to CHAR(200) or later rows get truncated.',
        requires: [['WITH\\s+RECURSIVE', 'Use WITH RECURSIVE.']],
        solution: `WITH RECURSIVE tree AS (
  SELECT category_id, CAST(name AS CHAR(200)) AS path
  FROM categories
  WHERE parent_category_id IS NULL
  UNION ALL
  SELECT c.category_id, CONCAT(t.path, ' > ', c.name)
  FROM categories c
  JOIN tree t ON c.parent_category_id = t.category_id
)
SELECT category_id, path FROM tree;`,
      },
      {
        id: 'm3-recursive-org',
        topic: 'CTEs',
        title: 'Recursive CTE - org chart',
        prompt: 'Find everyone who reports to the CTO (**employee 4**) directly or indirectly. Return `employee_id`, `first_name`, `level` (1 = direct report, 2 = their reports, ...).',
        hint: 'Anchor: WHERE manager_id = 4 with level 1. Recursive: employees whose manager is in the CTE, level + 1.',
        requires: [['WITH\\s+RECURSIVE', 'Use WITH RECURSIVE.']],
        solution: `WITH RECURSIVE reports AS (
  SELECT employee_id, first_name, 1 AS level
  FROM employees
  WHERE manager_id = 4
  UNION ALL
  SELECT e.employee_id, e.first_name, r.level + 1
  FROM employees e
  JOIN reports r ON e.manager_id = r.employee_id
)
SELECT employee_id, first_name, level FROM reports;`,
      },
      {
        id: 'm3-row-number',
        topic: 'Window functions',
        title: 'ROW_NUMBER - latest per group',
        prompt: 'Return each customer\'s **most recent order**: `customer_id`, `order_id`, `order_date` (one row per customer who has ordered).',
        hint: 'ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) and keep rn = 1 in an outer query.',
        requires: [['ROW_NUMBER\\s*\\(', 'Use ROW_NUMBER() for this one.']],
        solution: `SELECT customer_id, order_id, order_date
FROM (
  SELECT customer_id, order_id, order_date,
         ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC, order_id DESC) AS rn
  FROM orders
) t
WHERE rn = 1;`,
      },
      {
        id: 'm3-dense-rank',
        topic: 'Window functions',
        title: 'RANK / DENSE_RANK - top N per group',
        prompt: 'Rank products **within each category** by total quantity sold (exclude cancelled orders) using **DENSE_RANK**, highest first. Return the top 2 ranks per category: `category`, `product`, `qty_sold`, `rnk`.',
        hint: 'Aggregate first (CTE), then DENSE_RANK() OVER (PARTITION BY category ORDER BY qty_sold DESC), then filter rnk <= 2 outside.',
        requires: [['DENSE_RANK\\s*\\(', 'Use DENSE_RANK().']],
        solution: `WITH sales AS (
  SELECT c.name AS category, p.name AS product, SUM(oi.quantity) AS qty_sold
  FROM order_items oi
  JOIN orders     o ON o.order_id    = oi.order_id
  JOIN products   p ON p.product_id  = oi.product_id
  JOIN categories c ON c.category_id = p.category_id
  WHERE o.status <> 'cancelled'
  GROUP BY c.name, p.name
), ranked AS (
  SELECT category, product, qty_sold,
         DENSE_RANK() OVER (PARTITION BY category ORDER BY qty_sold DESC) AS rnk
  FROM sales
)
SELECT category, product, qty_sold, rnk
FROM ranked
WHERE rnk <= 2;`,
      },
      {
        id: 'm3-lag',
        topic: 'Window functions',
        title: 'LAG - compare with previous month',
        prompt: 'From `payments`, compute revenue per month and compare it with the previous month. Return `month` (format `YYYY-MM`), `revenue`, `prev_revenue`, `change_amount` (revenue - prev_revenue), sorted by month.',
        hint: "DATE_FORMAT(payment_date, '%Y-%m'). LAG(revenue) OVER (ORDER BY month). Note: CHANGE is a reserved word in MySQL.",
        ordered: true,
        requires: [['LAG\\s*\\(', 'Use LAG().']],
        solution: `WITH monthly AS (
  SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, SUM(amount) AS revenue
  FROM payments
  GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
)
SELECT month,
       revenue,
       LAG(revenue) OVER (ORDER BY month)           AS prev_revenue,
       revenue - LAG(revenue) OVER (ORDER BY month) AS change_amount
FROM monthly
ORDER BY month;`,
      },
      {
        id: 'm3-running-total',
        topic: 'Window functions',
        title: 'Running total',
        prompt: 'For **December 2024**, return `pay_day` (date), `daily_total` (sum of payments that day) and `running_total` (cumulative sum from 1 Dec), sorted by day.',
        hint: 'SUM(SUM(amount)) OVER (ORDER BY DATE(payment_date)) - a window over an aggregate.',
        ordered: true,
        requires: [['OVER\\s*\\(', 'Use a window function (SUM ... OVER).']],
        solution: `SELECT DATE(payment_date) AS pay_day,
       SUM(amount)        AS daily_total,
       SUM(SUM(amount)) OVER (ORDER BY DATE(payment_date)) AS running_total
FROM payments
WHERE payment_date >= '2024-12-01' AND payment_date < '2025-01-01'
GROUP BY DATE(payment_date)
ORDER BY pay_day;`,
      },
      {
        id: 'm3-ntile',
        topic: 'Window functions',
        title: 'NTILE - spend quartiles',
        prompt: 'Split paying customers into **4 quartiles** by total spend (sum of payments). Return `customer_id`, `total_spend`, `quartile` (1 = top spenders). Break ties by `customer_id`.',
        hint: 'NTILE(4) OVER (ORDER BY total_spend DESC, customer_id)',
        requires: [['NTILE\\s*\\(', 'Use NTILE().']],
        solution: `WITH spend AS (
  SELECT o.customer_id, SUM(p.amount) AS total_spend
  FROM orders o
  JOIN payments p ON p.order_id = o.order_id
  GROUP BY o.customer_id
)
SELECT customer_id, total_spend,
       NTILE(4) OVER (ORDER BY total_spend DESC, customer_id) AS quartile
FROM spend;`,
      },
      {
        id: 'm3-strings',
        topic: 'String functions',
        title: 'String functions',
        prompt: 'For customers with `customer_id` 1-20 return `customer_id`, `display_name` formatted as `LASTNAME, First` (last name in upper case), `initials` (first letter of first + last name) and `email_domain` (the part after @).',
        hint: "CONCAT, UPPER, LEFT, SUBSTRING_INDEX(email, '@', -1)",
        solution: `SELECT customer_id,
       CONCAT(UPPER(last_name), ', ', first_name) AS display_name,
       CONCAT(LEFT(first_name, 1), LEFT(last_name, 1)) AS initials,
       SUBSTRING_INDEX(email, '@', -1) AS email_domain
FROM customers
WHERE customer_id BETWEEN 1 AND 20;`,
      },
      {
        id: 'm3-dates',
        topic: 'Date functions',
        title: 'Date arithmetic',
        prompt: 'What is the average number of days between ordering and shipping per `ship_country`, for **delivered** orders? Return `ship_country`, `avg_days_to_ship` (2 decimals).',
        hint: 'DATEDIFF(later, earlier) returns whole days.',
        solution: `SELECT ship_country,
       ROUND(AVG(DATEDIFF(shipped_date, order_date)), 2) AS avg_days_to_ship
FROM orders
WHERE status = 'delivered'
GROUP BY ship_country;`,
      },
      {
        id: 'm3-dates-format',
        topic: 'Date functions',
        title: 'Extracting & formatting dates',
        prompt: "For customers 1-10 return `customer_id`, `age` (completed years on **2025-01-01**), `signup_weekday` (e.g. Monday) and `signup_pretty` formatted like `05 Mar 2022`.",
        hint: "TIMESTAMPDIFF(YEAR, birth_date, '2025-01-01'), DAYNAME(), DATE_FORMAT(d, '%d %b %Y')",
        solution: `SELECT customer_id,
       TIMESTAMPDIFF(YEAR, birth_date, '2025-01-01') AS age,
       DAYNAME(signup_date)                          AS signup_weekday,
       DATE_FORMAT(signup_date, '%d %b %Y')          AS signup_pretty
FROM customers
WHERE customer_id <= 10;`,
      },
    ],
  },

  // ===================================================================
  {
    id: 'm4',
    title: '4. Design & Performance',
    playbook: '04-design-performance',
    summary: 'Normalisation, constraints and keys, views, indexes (composite / covering) and reading execution plans.',
    exercises: [
      {
        id: 'm4-normalise',
        topic: 'Normalisation',
        title: 'Extract a customers table',
        db: 'playground',
        ddl: true,
        prompt: '`shopdb.legacy_sales` repeats customer details on every line. In **playground** create `legacy_customers` (`customer_email` VARCHAR(100) PRIMARY KEY, `customer_name` VARCHAR(100) NOT NULL, `customer_city` VARCHAR(50)) and fill it with **one row per customer**. Watch out: one customer appears with two different cities - keep the city from their **most recent invoice**.',
        hint: 'ROW_NUMBER() OVER (PARTITION BY customer_email ORDER BY invoice_date DESC) and INSERT ... SELECT the rn = 1 rows. That conflicting city is an "update anomaly" - exactly what normalisation prevents.',
        setup: 'DROP TABLE IF EXISTS legacy_customers;',
        check: `SELECT customer_email, customer_name, customer_city,
       (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema = 'playground' AND table_name = 'legacy_customers'
           AND constraint_type = 'PRIMARY KEY') AS has_primary_key
FROM legacy_customers
ORDER BY customer_email`,
        solution: `CREATE TABLE legacy_customers (
  customer_email VARCHAR(100) PRIMARY KEY,
  customer_name  VARCHAR(100) NOT NULL,
  customer_city  VARCHAR(50)
);

INSERT INTO legacy_customers (customer_email, customer_name, customer_city)
SELECT customer_email, customer_name, customer_city
FROM (
  SELECT customer_email, customer_name, customer_city,
         ROW_NUMBER() OVER (PARTITION BY customer_email ORDER BY invoice_date DESC, line_id DESC) AS rn
  FROM shopdb.legacy_sales
) t
WHERE rn = 1;`,
      },
      {
        id: 'm4-foreign-key',
        topic: 'Keys & constraints',
        title: 'Foreign keys',
        db: 'playground',
        ddl: true,
        prompt: 'In **playground** create `authors` (`author_id` INT PRIMARY KEY, `name` VARCHAR(100) NOT NULL) and `books` (`book_id` INT PRIMARY KEY, `title` VARCHAR(200) NOT NULL, `author_id` INT NOT NULL) where `books.author_id` is a **foreign key** to `authors` that **deletes a author\'s books automatically** when the author is deleted.',
        hint: 'FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE. Create the parent table first.',
        setup: 'DROP TABLE IF EXISTS books; DROP TABLE IF EXISTS authors;',
        check: `SELECT table_name, referenced_table_name, delete_rule
  FROM information_schema.referential_constraints
 WHERE constraint_schema = 'playground' AND table_name = 'books'`,
        cleanup: 'DROP TABLE IF EXISTS books; DROP TABLE IF EXISTS authors;',
        solution: `CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL
);

CREATE TABLE books (
  book_id   INT PRIMARY KEY,
  title     VARCHAR(200) NOT NULL,
  author_id INT NOT NULL,
  CONSTRAINT fk_books_author FOREIGN KEY (author_id)
    REFERENCES authors (author_id) ON DELETE CASCADE
);`,
      },
      {
        id: 'm4-check',
        topic: 'Keys & constraints',
        title: 'CHECK constraints',
        db: 'playground',
        ddl: true,
        prompt: 'The table `wallets (wallet_id, owner, balance)` exists in **playground**. Add a CHECK constraint named **chk_wallets_balance** so that `balance` can never be negative.',
        hint: 'ALTER TABLE wallets ADD CONSTRAINT name CHECK (condition);',
        setup: `DROP TABLE IF EXISTS wallets;
CREATE TABLE wallets (wallet_id INT PRIMARY KEY, owner VARCHAR(50) NOT NULL, balance DECIMAL(10,2) NOT NULL);
INSERT INTO wallets VALUES (1, 'Alice', 50.00), (2, 'Bob', 0.00);`,
        check: `SELECT tc.constraint_name, tc.constraint_type, cc.check_clause LIKE '%balance%' AS mentions_balance
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc
    ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name
 WHERE tc.table_schema = 'playground' AND tc.table_name = 'wallets' AND tc.constraint_type = 'CHECK'`,
        cleanup: 'DROP TABLE IF EXISTS wallets;',
        solution: `ALTER TABLE wallets
  ADD CONSTRAINT chk_wallets_balance CHECK (balance >= 0);`,
      },
      {
        id: 'm4-view',
        topic: 'Views',
        title: 'CREATE VIEW',
        ddl: true,
        prompt: 'Create a view **v_customer_spend** returning, for every customer with at least one payment: `customer_id`, `customer_name` (first + space + last), `orders_paid` (number of payments) and `total_spend` (sum of payment amounts).',
        hint: 'CREATE VIEW name AS SELECT ... (CREATE OR REPLACE VIEW lets you re-run it).',
        setup: 'DROP VIEW IF EXISTS v_customer_spend;',
        check: 'SELECT * FROM v_customer_spend ORDER BY customer_id',
        solution: `CREATE VIEW v_customer_spend AS
SELECT c.customer_id,
       CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       COUNT(p.payment_id) AS orders_paid,
       SUM(p.amount)       AS total_spend
FROM customers c
JOIN orders   o ON o.customer_id = c.customer_id
JOIN payments p ON p.order_id    = o.order_id
GROUP BY c.customer_id, c.first_name, c.last_name;`,
      },
      {
        id: 'm4-index',
        topic: 'Indexes',
        title: 'Create a composite index',
        ddl: true,
        prompt: '`web_events` (200k rows) has no secondary indexes, so `SELECT * FROM web_events WHERE customer_id = 42 ORDER BY event_time` scans the whole table. Create an index **idx_events_customer_time** on `(customer_id, event_time)`. Try `EXPLAIN` on that query in the Console before and after!',
        hint: 'CREATE INDEX idx_name ON table (col1, col2); - column order matters: equality column first, then the sort/range column.',
        setup: dropIndexIfExists('web_events', 'idx_events_customer_time'),
        check: indexCheck('web_events', 'idx_events_customer_time'),
        solution: 'CREATE INDEX idx_events_customer_time ON web_events (customer_id, event_time);',
      },
      {
        id: 'm4-covering',
        topic: 'Indexes',
        title: 'Covering index',
        ddl: true,
        prompt: 'This report runs every hour: `SELECT customer_id, COUNT(*) FROM web_events WHERE event_type = \'purchase\' GROUP BY customer_id`. Create a **covering** index named **idx_events_type_customer** so MySQL can answer it from the index alone (EXPLAIN will show "Using index").',
        hint: 'Put the filtered column first and include every other column the query touches: (event_type, customer_id).',
        setup: dropIndexIfExists('web_events', 'idx_events_type_customer'),
        check: indexCheck('web_events', 'idx_events_type_customer'),
        solution: 'CREATE INDEX idx_events_type_customer ON web_events (event_type, customer_id);',
      },
      {
        id: 'm4-sargable',
        topic: 'Query optimisation',
        title: 'Make it sargable',
        prompt: 'This query cannot use an index on `order_date` because the column is wrapped in functions:\n`SELECT order_id, order_date FROM orders WHERE YEAR(order_date) = 2024 AND MONTH(order_date) = 2;`\nRewrite it so the column is left bare (same result).',
        hint: "Compare the raw column with a half-open range: order_date >= '2024-02-01' AND order_date < '2024-03-01'.",
        forbids: [
          ['\\b(YEAR|MONTH|DATE|DATE_FORMAT|EXTRACT)\\s*\\(\\s*order_date', 'Do not wrap order_date in a function - that prevents index use.'],
        ],
        solution: `SELECT order_id, order_date
FROM orders
WHERE order_date >= '2024-02-01'
  AND order_date <  '2024-03-01';`,
      },
      {
        id: 'm4-explain',
        topic: 'Query optimisation',
        title: 'Top pages (then EXPLAIN it)',
        prompt: 'Return the **10 most viewed product pages** in **Q1 2024**: `page_url`, `views` (count of `page_view` events), sorted by views descending then page_url. Afterwards, run `EXPLAIN ANALYZE` on your query in the Console and look for "Table scan".',
        hint: "WHERE event_type = 'page_view' AND event_time >= '2024-01-01' AND event_time < '2024-04-01' ... GROUP BY page_url ORDER BY views DESC, page_url LIMIT 10",
        ordered: true,
        solution: `SELECT page_url, COUNT(*) AS views
FROM web_events
WHERE event_type = 'page_view'
  AND event_time >= '2024-01-01'
  AND event_time <  '2024-04-01'
GROUP BY page_url
ORDER BY views DESC, page_url
LIMIT 10;`,
      },
    ],
  },

  // ===================================================================
  {
    id: 'm5',
    title: '5. Programmability & Administration',
    playbook: '05-programmability-admin',
    summary: 'Stored procedures, functions and triggers, transactions (COMMIT / ROLLBACK), users & roles, and defending against SQL injection.',
    exercises: [
      {
        id: 'm5-procedure',
        topic: 'Stored procedures',
        title: 'A procedure with an IN parameter',
        ddl: true,
        prompt: 'Create a stored procedure **sp_orders_by_status(IN p_status VARCHAR(20))** that returns `order_id`, `customer_id`, `order_date` for orders with that status, sorted by `order_id`. The grader runs `CALL sp_orders_by_status(\'returned\')`.',
        hint: 'In the mysql CLI wrap it in DELIMITER $$ ... $$ DELIMITER ; - this app supports that too, or you can omit DELIMITER here.',
        ordered: true,
        setup: 'DROP PROCEDURE IF EXISTS sp_orders_by_status;',
        check: "CALL sp_orders_by_status('returned');",
        solution: `DELIMITER $$
CREATE PROCEDURE sp_orders_by_status(IN p_status VARCHAR(20))
BEGIN
  SELECT order_id, customer_id, order_date
  FROM orders
  WHERE status = p_status
  ORDER BY order_id;
END$$
DELIMITER ;`,
      },
      {
        id: 'm5-procedure-out',
        topic: 'Stored procedures',
        title: 'OUT parameters',
        ddl: true,
        prompt: 'Create **sp_customer_order_count(IN p_customer_id INT, OUT p_order_count INT)** that stores the number of orders of that customer in the OUT parameter. The grader runs `CALL sp_customer_order_count(7, @n); SELECT @n;`',
        hint: 'SELECT COUNT(*) INTO p_order_count FROM orders WHERE customer_id = p_customer_id;',
        setup: 'DROP PROCEDURE IF EXISTS sp_customer_order_count;',
        check: 'CALL sp_customer_order_count(7, @n); SELECT @n AS order_count;',
        solution: `DELIMITER $$
CREATE PROCEDURE sp_customer_order_count(IN p_customer_id INT, OUT p_order_count INT)
BEGIN
  SELECT COUNT(*) INTO p_order_count
  FROM orders
  WHERE customer_id = p_customer_id;
END$$
DELIMITER ;`,
      },
      {
        id: 'm5-function',
        topic: 'Functions',
        title: 'A stored function',
        ddl: true,
        prompt: 'Create a function **fn_customer_name(p_customer_id INT) RETURNS VARCHAR(101)** that returns the customer\'s first and last name separated by a space. The grader runs it for customers 1-10.',
        hint: 'Functions need a characteristic such as READS SQL DATA (or DETERMINISTIC). Use RETURN (SELECT ...);',
        ordered: true,
        setup: 'DROP FUNCTION IF EXISTS fn_customer_name;',
        check: 'SELECT customer_id, fn_customer_name(customer_id) AS full_name FROM customers WHERE customer_id <= 10 ORDER BY customer_id',
        solution: `DELIMITER $$
CREATE FUNCTION fn_customer_name(p_customer_id INT)
RETURNS VARCHAR(101)
READS SQL DATA
BEGIN
  RETURN (SELECT CONCAT(first_name, ' ', last_name)
          FROM customers
          WHERE customer_id = p_customer_id);
END$$
DELIMITER ;`,
      },
      {
        id: 'm5-trigger',
        topic: 'Triggers',
        title: 'Audit trail with a trigger',
        ddl: true,
        prompt: 'A table `price_audit(audit_id, product_id, old_price, new_price, changed_at)` has been created. Write an **AFTER UPDATE** trigger **trg_products_price_audit** on `products` that inserts a row into `price_audit` **only when `unit_price` actually changes**.',
        hint: 'FOR EACH ROW BEGIN IF NEW.unit_price <> OLD.unit_price THEN INSERT ... END IF; END. The grader updates book prices and a stock level, then reads price_audit.',
        setup: `DROP TRIGGER IF EXISTS trg_products_price_audit;
DROP TABLE IF EXISTS price_audit;
CREATE TABLE price_audit (
  audit_id   INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  old_price  DECIMAL(10,2),
  new_price  DECIMAL(10,2),
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`,
        check: `UPDATE products SET unit_price = unit_price * 1.10 WHERE category_id = 13;
UPDATE products SET stock_qty = stock_qty + 1 WHERE product_id = 1;
SELECT product_id, old_price, new_price FROM price_audit ORDER BY product_id;`,
        cleanup: 'DROP TRIGGER IF EXISTS trg_products_price_audit; DROP TABLE IF EXISTS price_audit;',
        solution: `DELIMITER $$
CREATE TRIGGER trg_products_price_audit
AFTER UPDATE ON products
FOR EACH ROW
BEGIN
  IF NEW.unit_price <> OLD.unit_price THEN
    INSERT INTO price_audit (product_id, old_price, new_price)
    VALUES (OLD.product_id, OLD.unit_price, NEW.unit_price);
  END IF;
END$$
DELIMITER ;`,
      },
      {
        id: 'm5-transaction',
        topic: 'Transactions',
        title: 'An atomic money transfer',
        db: 'playground',
        prompt: 'In **playground**, move **250** from Alice (account 1) to Bob (account 2) **and** log it in `transfers (from_account, to_account, amount)` - all inside **one transaction** that you COMMIT. (The accounts are reset before and after grading.)',
        hint: 'START TRANSACTION; UPDATE ... -250; UPDATE ... +250; INSERT INTO transfers ...; COMMIT;',
        requires: [
          ['START\\s+TRANSACTION|\\bBEGIN\\b', 'Start the transaction explicitly with START TRANSACTION (or BEGIN).'],
          ['\\bCOMMIT\\b', 'Finish with COMMIT.'],
        ],
        setup: resetAccounts,
        check: `SELECT a.account_id, a.balance,
       (SELECT COUNT(*) FROM transfers WHERE from_account = 1 AND to_account = 2 AND amount = 250) AS logged
FROM accounts a
ORDER BY a.account_id`,
        cleanup: resetAccounts,
        solution: `START TRANSACTION;
UPDATE accounts SET balance = balance - 250 WHERE account_id = 1;
UPDATE accounts SET balance = balance + 250 WHERE account_id = 2;
INSERT INTO transfers (from_account, to_account, amount) VALUES (1, 2, 250);
COMMIT;`,
      },
      {
        id: 'm5-roles',
        topic: 'Security',
        title: 'Roles & privileges',
        ddl: true,
        prompt: 'Create a role **analyst_role**. Grant it **SELECT** on all of `shopdb`, and **SELECT, INSERT, UPDATE** on all of `playground`. (The grader reads `mysql.db` to verify.)',
        hint: 'CREATE ROLE analyst_role; GRANT SELECT ON shopdb.* TO analyst_role; ...  Then a user gets it with GRANT analyst_role TO user; SET DEFAULT ROLE ...',
        setup: 'DROP ROLE IF EXISTS analyst_role;',
        check: `SELECT Db, Select_priv, Insert_priv, Update_priv, Delete_priv
  FROM mysql.db
 WHERE User = 'analyst_role'
 ORDER BY Db`,
        cleanup: 'DROP ROLE IF EXISTS analyst_role;',
        solution: `CREATE ROLE analyst_role;
GRANT SELECT ON shopdb.* TO analyst_role;
GRANT SELECT, INSERT, UPDATE ON playground.* TO analyst_role;`,
      },
      {
        id: 'm5-injection',
        topic: 'Security',
        title: 'See an SQL injection happen',
        db: 'playground',
        prompt: "A vulnerable app builds its login query by gluing strings: `\"SELECT user_id, username FROM app_users WHERE username = '\" + user + \"' AND password_hash = SHA2('\" + pass + \"', 256)\"`. Write the **exact** SQL it would send when an attacker types the username `admin' -- ` (note the trailing space) and the password `anything`. Run it: you log in as admin without the password!",
        hint: "Substitute the input literally. The quote closes the string early and '-- ' comments out the password check.",
        solution: `SELECT user_id, username FROM app_users WHERE username = 'admin' -- ' AND password_hash = SHA2('anything', 256)`,
      },
      {
        id: 'm5-prepared',
        topic: 'Security',
        title: 'Fix it with a prepared statement',
        db: 'playground',
        prompt: 'Write the safe version: **PREPARE** a statement with two `?` placeholders returning `user_id`, `username`, `is_admin` for a matching username and `SHA2(password, 256)`. Then set `@u = \'alice\'`, `@p = \'wonderland\'` and **EXECUTE ... USING @u, @p**. Placeholders are sent as data, never parsed as SQL.',
        hint: "PREPARE login_stmt FROM 'SELECT ... WHERE username = ? AND password_hash = SHA2(?, 256)'; SET @u = ...; EXECUTE login_stmt USING @u, @p;",
        requires: [
          ['\\bPREPARE\\b', 'Use PREPARE.'],
          ['EXECUTE\\s+\\w+\\s+USING', 'Use EXECUTE ... USING to pass the values.'],
        ],
        solution: `PREPARE login_stmt FROM
  'SELECT user_id, username, is_admin FROM app_users WHERE username = ? AND password_hash = SHA2(?, 256)';
SET @u = 'alice', @p = 'wonderland';
EXECUTE login_stmt USING @u, @p;
DEALLOCATE PREPARE login_stmt;`,
      },
    ],
  },
];

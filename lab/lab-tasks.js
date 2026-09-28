// SQL Practical Lab Assessment: task definitions, model solutions and grading checks.
// Used by the app's "Lab" page and by  workstation/grade-lab.(ps1|sh).
//
// !!! SPOILER WARNING !!!  This file contains the model answers. Attempt the lab
// first (lab/README.md), then use this file to review.
//
// Field reference: see app/lib/grader.js

const dropIndexIfExists = (table, index) => `
SET @sqlm_drop = (SELECT IF(COUNT(*) > 0, 'DROP INDEX ${index} ON ${table}', 'DO 0')
                    FROM information_schema.statistics
                   WHERE table_schema = DATABASE() AND table_name = '${table}' AND index_name = '${index}');
PREPARE sqlm_stmt FROM @sqlm_drop;
EXECUTE sqlm_stmt;
DEALLOCATE PREPARE sqlm_stmt;`;

const resetAccounts = `
DELETE FROM transfers;
DELETE FROM accounts;
INSERT INTO accounts (account_id, owner, balance) VALUES
  (1, 'Alice', 1000.00), (2, 'Bob', 500.00), (3, 'Charlie', 2500.00), (4, 'Dana', 0.00);`;

const LINE_REVENUE = 'oi.quantity * oi.unit_price * (1 - oi.discount)';

module.exports = {
  title: 'SQL Practical Lab Assessment - ShopCo Analytics',
  durationMinutes: 120,
  passMark: 60,
  instructions: [
    'You are the new data analyst at ShopCo. Answer every task with SQL against the live MySQL database.',
    'Revenue of an order line = quantity * unit_price * (1 - discount). A "valid" order is one whose status is NOT cancelled and NOT returned.',
    'Unless a task says otherwise, work in shopdb. Tasks marked [playground] must be done in the playground database.',
    'Match the requested column ORDER exactly. Column names/aliases are not graded, values are. Row order only matters when the task asks for sorting.',
    'Each task is all-or-nothing. "Run" executes your SQL inside a transaction that is rolled back; DDL (CREATE/ALTER/DROP) is still committed.',
    'Allowed: the playbook, the MySQL manual. Not allowed: the solutions file (lab/lab-tasks.js).',
  ],
  tasks: [
    // ------------------------------------------------------------------ A
    {
      id: 'A1', section: 'A - Fundamentals', marks: 4, title: 'Create the support_tickets table',
      db: 'playground', ddl: true,
      prompt: '[playground] Create table `support_tickets`: `ticket_id` INT auto-increment primary key; `customer_id` INT NOT NULL; `subject` VARCHAR(150) NOT NULL; `priority` ENUM(\'low\',\'medium\',\'high\') NOT NULL, default \'medium\'; `created_at` DATETIME NOT NULL defaulting to the current timestamp; `resolved_at` DATETIME that may be NULL.',
      setup: 'DROP TABLE IF EXISTS support_tickets;',
      check: `SELECT column_name, column_type, is_nullable, column_key, column_default,
       (extra LIKE '%auto_increment%') AS auto_inc
  FROM information_schema.columns
 WHERE table_schema = 'playground' AND table_name = 'support_tickets'
 ORDER BY ordinal_position`,
      cleanup: 'DROP TABLE IF EXISTS support_tickets;',
      solution: `CREATE TABLE support_tickets (
  ticket_id   INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  subject     VARCHAR(150) NOT NULL,
  priority    ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL
);`,
    },
    {
      id: 'A2', section: 'A - Fundamentals', marks: 4, title: 'Audio price increase',
      prompt: 'Increase the `unit_price` of every **active** product in the **Audio** category (`category_id = 6`) by **5%**, rounded to 2 decimals. No other product may change.',
      check: 'SELECT product_id, unit_price FROM products ORDER BY product_id',
      solution: `UPDATE products
SET unit_price = ROUND(unit_price * 1.05, 2)
WHERE category_id = 6
  AND is_active = 1;`,
    },
    {
      id: 'A3', section: 'A - Fundamentals', marks: 4, title: '2022 sign-ups in the UK & Australia',
      ordered: true,
      prompt: 'List customers from the **UK** or **Australia** who signed up during **2022**. Return `customer_id`, `first_name`, `last_name`, `city`, `signup_date`, sorted by `signup_date` then `customer_id`.',
      solution: `SELECT customer_id, first_name, last_name, city, signup_date
FROM customers
WHERE country IN ('UK', 'Australia')
  AND signup_date BETWEEN '2022-01-01' AND '2022-12-31'
ORDER BY signup_date, customer_id;`,
    },
    {
      id: 'A4', section: 'A - Fundamentals', marks: 4, title: 'Phone & Pro product search',
      ordered: true,
      prompt: 'Find **active** products whose name contains **"phone"** or **"pro"** (any letter case) and whose `stock_qty` is **between 20 and 200 inclusive**. Return `sku`, `name`, `stock_qty` sorted by `sku`.',
      solution: `SELECT sku, name, stock_qty
FROM products
WHERE is_active = 1
  AND (name LIKE '%phone%' OR name LIKE '%pro%')
  AND stock_qty BETWEEN 20 AND 200
ORDER BY sku;`,
    },
    {
      id: 'A5', section: 'A - Fundamentals', marks: 4, title: 'Well-paid staff without commission',
      ordered: true,
      prompt: 'Employees with **no commission** and a salary **above 60000**. Return `employee_id`, `full_name` (first + space + last), `salary`, sorted by salary (highest first) then `employee_id`.',
      solution: `SELECT employee_id, CONCAT(first_name, ' ', last_name) AS full_name, salary
FROM employees
WHERE commission_pct IS NULL
  AND salary > 60000
ORDER BY salary DESC, employee_id;`,
    },

    // ------------------------------------------------------------------ B
    {
      id: 'B1', section: 'B - Intermediate', marks: 5, title: 'Sales rep performance 2024',
      prompt: 'For each sales rep who handled **valid** orders placed in **2024**: `employee_id`, `rep_name` (first + space + last), `orders_handled` (distinct orders), `revenue` (2 decimals).',
      solution: `SELECT e.employee_id,
       CONCAT(e.first_name, ' ', e.last_name) AS rep_name,
       COUNT(DISTINCT o.order_id)             AS orders_handled,
       ROUND(SUM(${LINE_REVENUE}), 2)         AS revenue
FROM employees e
JOIN orders      o  ON o.employee_id = e.employee_id
JOIN order_items oi ON oi.order_id   = o.order_id
WHERE o.status NOT IN ('cancelled', 'returned')
  AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
GROUP BY e.employee_id, e.first_name, e.last_name;`,
    },
    {
      id: 'B2', section: 'B - Intermediate', marks: 5, title: 'Review scores by category',
      prompt: 'Per category (name) return `category`, `review_count`, `avg_rating` (2 decimals) - only categories with **at least 55 reviews**.',
      solution: `SELECT c.name AS category, COUNT(*) AS review_count, ROUND(AVG(r.rating), 2) AS avg_rating
FROM product_reviews r
JOIN products   p ON p.product_id  = r.product_id
JOIN categories c ON c.category_id = p.category_id
GROUP BY c.name
HAVING COUNT(*) >= 55;`,
    },
    {
      id: 'B3', section: 'B - Intermediate', marks: 5, title: 'Lapsed customers',
      prompt: 'Find customers who ordered **before 2024-10-01** but have **no order on or after 2024-10-01**. Return `customer_id`, `email`, `last_order_date` (the DATE of their most recent order).',
      solution: `SELECT c.customer_id, c.email, DATE(MAX(o.order_date)) AS last_order_date
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id, c.email
HAVING MAX(o.order_date) < '2024-10-01';`,
    },
    {
      id: 'B4', section: 'B - Intermediate', marks: 5, title: 'Customer activity timeline',
      ordered: true,
      prompt: 'Build a timeline for **customer 25** combining orders and reviews: `activity_date` (DATE), `activity` (\'order\' or \'review\'), `ref_id` (order_id or review_id). Sort by `activity_date`, then `activity`, then `ref_id`.',
      requires: [['UNION', 'Combine the two sources with UNION ALL.']],
      solution: `SELECT DATE(order_date) AS activity_date, 'order' AS activity, order_id AS ref_id
FROM orders WHERE customer_id = 25
UNION ALL
SELECT review_date, 'review', review_id
FROM product_reviews WHERE customer_id = 25
ORDER BY activity_date, activity, ref_id;`,
    },
    {
      id: 'B5', section: 'B - Intermediate', marks: 5, title: 'Stock status summary',
      ordered: true,
      prompt: 'Classify **active** products: stock 0 = \'Out of stock\', below 30 = \'Low\', below 100 = \'OK\', otherwise \'Overstocked\'. Return `stock_status`, `product_count`, `total_units` - in the order Out of stock, Low, OK, Overstocked (omit statuses with no products).',
      solution: `SELECT stock_status, COUNT(*) AS product_count, SUM(stock_qty) AS total_units
FROM (
  SELECT stock_qty,
         CASE WHEN stock_qty = 0   THEN 'Out of stock'
              WHEN stock_qty < 30  THEN 'Low'
              WHEN stock_qty < 100 THEN 'OK'
              ELSE 'Overstocked' END AS stock_status
  FROM products
  WHERE is_active = 1
) s
GROUP BY stock_status
ORDER BY FIELD(stock_status, 'Out of stock', 'Low', 'OK', 'Overstocked');`,
    },

    // ------------------------------------------------------------------ C
    {
      id: 'C1', section: 'C - Advanced', marks: 5, title: 'Top 3 customers per country',
      prompt: 'Rank customers **within their country** (`customers.country`) by revenue from valid orders using **RANK()**. Return `country`, `customer_id`, `revenue` (2 decimals), `revenue_rank` for ranks 1-3 only.',
      requires: [['\\bRANK\\s*\\(', 'Use RANK().']],
      solution: `WITH rev AS (
  SELECT c.country, c.customer_id, ROUND(SUM(${LINE_REVENUE}), 2) AS revenue
  FROM customers c
  JOIN orders      o  ON o.customer_id = c.customer_id
  JOIN order_items oi ON oi.order_id   = o.order_id
  WHERE o.status NOT IN ('cancelled', 'returned')
  GROUP BY c.country, c.customer_id
), ranked AS (
  SELECT country, customer_id, revenue,
         RANK() OVER (PARTITION BY country ORDER BY revenue DESC) AS revenue_rank
  FROM rev
)
SELECT country, customer_id, revenue, revenue_rank
FROM ranked
WHERE revenue_rank <= 3;`,
    },
    {
      id: 'C2', section: 'C - Advanced', marks: 5, title: 'Month-over-month growth 2024',
      ordered: true,
      prompt: 'For **2024** valid orders: `month_no` (1-12), `revenue` (2 decimals), `prev_revenue` (previous month in 2024; NULL for January), `growth_pct` = (revenue - prev_revenue) / prev_revenue * 100 rounded to **1** decimal. Sort by month.',
      requires: [['LAG\\s*\\(', 'Use LAG().']],
      solution: `WITH monthly AS (
  SELECT MONTH(o.order_date) AS month_no, ROUND(SUM(${LINE_REVENUE}), 2) AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.order_id
  WHERE o.status NOT IN ('cancelled', 'returned')
    AND o.order_date >= '2024-01-01' AND o.order_date < '2025-01-01'
  GROUP BY MONTH(o.order_date)
)
SELECT month_no,
       revenue,
       LAG(revenue) OVER (ORDER BY month_no) AS prev_revenue,
       ROUND((revenue - LAG(revenue) OVER (ORDER BY month_no))
             / LAG(revenue) OVER (ORDER BY month_no) * 100, 1) AS growth_pct
FROM monthly
ORDER BY month_no;`,
    },
    {
      id: 'C3', section: 'C - Advanced', marks: 5, title: 'The Sales organisation',
      ordered: true,
      prompt: 'List everyone who reports to the VP of Sales (**employee 2**) directly or indirectly: `employee_id`, `full_name`, `level` (1 = direct report). Sort by `level` then `employee_id`.',
      requires: [['WITH\\s+RECURSIVE', 'Use a recursive CTE.']],
      solution: `WITH RECURSIVE chain AS (
  SELECT employee_id, CONCAT(first_name, ' ', last_name) AS full_name, 1 AS level
  FROM employees
  WHERE manager_id = 2
  UNION ALL
  SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name), c.level + 1
  FROM employees e
  JOIN chain c ON e.manager_id = c.employee_id
)
SELECT employee_id, full_name, level
FROM chain
ORDER BY level, employee_id;`,
    },
    {
      id: 'C4', section: 'C - Advanced', marks: 5, title: 'Category heavyweights',
      prompt: 'For valid orders compute each product\'s revenue and its **share of its category\'s revenue**. Return `category`, `product`, `product_revenue` (2 decimals), `share_pct` (rounded to 1 decimal) for products whose rounded share is **above 30**.',
      requires: [['OVER\\s*\\(', 'Use a window function for the category total.']],
      solution: `WITH pr AS (
  SELECT c.name AS category, p.name AS product, SUM(${LINE_REVENUE}) AS product_revenue
  FROM order_items oi
  JOIN orders     o ON o.order_id    = oi.order_id
  JOIN products   p ON p.product_id  = oi.product_id
  JOIN categories c ON c.category_id = p.category_id
  WHERE o.status NOT IN ('cancelled', 'returned')
  GROUP BY c.name, p.name
)
SELECT category, product, product_revenue, share_pct
FROM (
  SELECT category, product,
         ROUND(product_revenue, 2) AS product_revenue,
         ROUND(100 * product_revenue / SUM(product_revenue) OVER (PARTITION BY category), 1) AS share_pct
  FROM pr
) t
WHERE share_pct > 30;`,
    },
    {
      id: 'C5', section: 'C - Advanced', marks: 5, title: 'Customers without a phone',
      prompt: 'For customers with **no phone number**: `customer_id`, `initials` (upper-case first letters of first and last name), `email_domain`, `days_since_signup` (days from signup_date to **2025-01-01**), `signup_quarter` formatted like `2022-Q3`.',
      solution: `SELECT customer_id,
       UPPER(CONCAT(LEFT(first_name, 1), LEFT(last_name, 1)))   AS initials,
       SUBSTRING_INDEX(email, '@', -1)                           AS email_domain,
       DATEDIFF('2025-01-01', signup_date)                       AS days_since_signup,
       CONCAT(YEAR(signup_date), '-Q', QUARTER(signup_date))     AS signup_quarter
FROM customers
WHERE phone IS NULL;`,
    },

    // ------------------------------------------------------------------ D
    {
      id: 'D1', section: 'D - Design & Performance', marks: 5, title: 'Index for the order dashboard',
      ddl: true,
      prompt: 'The operations dashboard constantly runs `WHERE status = ? AND order_date >= ?`. Create a composite index named **idx_orders_status_date** that serves this pattern best.',
      setup: dropIndexIfExists('orders', 'idx_orders_status_date'),
      check: `SELECT index_name, column_name, seq_in_index
  FROM information_schema.statistics
 WHERE table_schema = 'shopdb' AND table_name = 'orders' AND index_name = 'idx_orders_status_date'
 ORDER BY seq_in_index`,
      solution: 'CREATE INDEX idx_orders_status_date ON orders (status, order_date);',
    },
    {
      id: 'D2', section: 'D - Design & Performance', marks: 5, title: 'Normalise legacy invoices',
      db: 'playground', ddl: true,
      prompt: '[playground] Create `legacy_invoices` with columns `invoice_no` INT (**primary key**), `invoice_date` DATE NOT NULL, `customer_email` VARCHAR(100) NOT NULL, `sales_rep` VARCHAR(100) NOT NULL, and fill it with **one row per invoice** from `shopdb.legacy_sales`.',
      setup: 'DROP TABLE IF EXISTS legacy_invoices;',
      check: `SELECT l.invoice_no, l.invoice_date, l.customer_email, l.sales_rep,
       (SELECT COUNT(*) FROM information_schema.table_constraints
         WHERE table_schema = 'playground' AND table_name = 'legacy_invoices'
           AND constraint_type = 'PRIMARY KEY') AS has_pk
FROM legacy_invoices l
ORDER BY l.invoice_no`,
      cleanup: 'DROP TABLE IF EXISTS legacy_invoices;',
      solution: `CREATE TABLE legacy_invoices (
  invoice_no     INT PRIMARY KEY,
  invoice_date   DATE NOT NULL,
  customer_email VARCHAR(100) NOT NULL,
  sales_rep      VARCHAR(100) NOT NULL
);

INSERT INTO legacy_invoices (invoice_no, invoice_date, customer_email, sales_rep)
SELECT DISTINCT invoice_no, invoice_date, customer_email, sales_rep
FROM shopdb.legacy_sales;`,
    },
    {
      id: 'D3', section: 'D - Design & Performance', marks: 5, title: 'Product performance view',
      ddl: true,
      prompt: 'Create view **v_product_performance** with one row for **every** product: `product_id`, `product_name`, `units_sold` (valid orders, 0 if none), `revenue` (valid orders, 2 decimals, 0 if none), `avg_rating` (2 decimals, NULL if no reviews). Beware of join fan-out when combining sales and reviews!',
      setup: 'DROP VIEW IF EXISTS v_product_performance;',
      check: 'SELECT * FROM v_product_performance ORDER BY product_id',
      solution: `CREATE VIEW v_product_performance AS
SELECT p.product_id,
       p.name                     AS product_name,
       COALESCE(s.units_sold, 0)  AS units_sold,
       COALESCE(s.revenue, 0)     AS revenue,
       r.avg_rating
FROM products p
LEFT JOIN (
  SELECT oi.product_id,
         SUM(oi.quantity)              AS units_sold,
         ROUND(SUM(${LINE_REVENUE}), 2) AS revenue
  FROM order_items oi
  JOIN orders o ON o.order_id = oi.order_id
  WHERE o.status NOT IN ('cancelled', 'returned')
  GROUP BY oi.product_id
) s ON s.product_id = p.product_id
LEFT JOIN (
  SELECT product_id, ROUND(AVG(rating), 2) AS avg_rating
  FROM product_reviews
  GROUP BY product_id
) r ON r.product_id = p.product_id;`,
    },

    // ------------------------------------------------------------------ E
    {
      id: 'E1', section: 'E - Programmability', marks: 5, title: 'Restock procedure',
      ddl: true,
      prompt: 'Create **sp_restock(IN p_product_id INT, IN p_qty INT)**: if `p_qty` <= 0 raise an error with `SIGNAL SQLSTATE \'45000\'`; otherwise add `p_qty` to the product\'s `stock_qty`. The grader calls it for products 4 (+50) and 38 (+10) and reads their stock.',
      requires: [['SIGNAL\\s+SQLSTATE', 'Reject non-positive quantities with SIGNAL SQLSTATE \'45000\'.']],
      setup: 'DROP PROCEDURE IF EXISTS sp_restock;',
      check: `CALL sp_restock(4, 50);
CALL sp_restock(38, 10);
SELECT product_id, stock_qty FROM products WHERE product_id IN (4, 38) ORDER BY product_id;`,
      solution: `DELIMITER $$
CREATE PROCEDURE sp_restock(IN p_product_id INT, IN p_qty INT)
BEGIN
  IF p_qty <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be positive';
  END IF;
  UPDATE products SET stock_qty = stock_qty + p_qty WHERE product_id = p_product_id;
END$$
DELIMITER ;`,
    },
    {
      id: 'E2', section: 'E - Programmability', marks: 5, title: 'Order revenue function',
      ddl: true,
      prompt: 'Create function **fn_order_revenue(p_order_id INT) RETURNS DECIMAL(12,2)** returning the order\'s revenue (sum of its lines, 2 decimals) - and **0** (not NULL) for an order with no lines / that does not exist.',
      setup: 'DROP FUNCTION IF EXISTS fn_order_revenue;',
      check: `SELECT order_id, fn_order_revenue(order_id) AS revenue FROM orders WHERE order_id <= 25
UNION ALL
SELECT 999999, fn_order_revenue(999999)
ORDER BY order_id`,
      solution: `DELIMITER $$
CREATE FUNCTION fn_order_revenue(p_order_id INT)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
  RETURN (SELECT COALESCE(ROUND(SUM(quantity * unit_price * (1 - discount)), 2), 0)
          FROM order_items
          WHERE order_id = p_order_id);
END$$
DELIMITER ;`,
    },
    {
      id: 'E3', section: 'E - Programmability', marks: 5, title: 'Atomic transfer',
      db: 'playground',
      prompt: '[playground] In **one explicit transaction**, move **500** from Charlie (account 3) to Alice (account 1) and record it in `transfers (from_account, to_account, amount)`. Commit it.',
      requires: [
        ['START\\s+TRANSACTION|\\bBEGIN\\b', 'Start the transaction explicitly.'],
        ['\\bCOMMIT\\b', 'Finish with COMMIT.'],
      ],
      setup: resetAccounts,
      check: `SELECT a.account_id, a.balance,
       (SELECT COUNT(*) FROM transfers WHERE from_account = 3 AND to_account = 1 AND amount = 500) AS logged
FROM accounts a
ORDER BY a.account_id`,
      cleanup: resetAccounts,
      solution: `START TRANSACTION;
UPDATE accounts SET balance = balance - 500 WHERE account_id = 3;
UPDATE accounts SET balance = balance + 500 WHERE account_id = 1;
INSERT INTO transfers (from_account, to_account, amount) VALUES (3, 1, 500);
COMMIT;`,
    },
  ],
};

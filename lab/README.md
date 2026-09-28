# SQL Practical Lab Assessment: ShopCo Analytics

| | |
|---|---|
| **Duration** | 120 minutes |
| **Total marks** | 100 (20 tasks) |
| **Pass mark** | 60% |
| **Database** | MySQL 8.4, `shopdb` (+ `playground` where stated) |
| **Grading** | Automatic. Each task is all-or-nothing |

## Scenario

You have just joined **ShopCo**, an online retailer, as a data analyst. The operations,
finance and engineering teams have sent you a list of requests. Answer each one with SQL
against the live database.

## Before you start

1. Start the workstation: `workstation\setup.ps1` (Windows) or `workstation/setup.sh`.
2. Give yourself a clean database. Either click **Settings → Reset database** in the app,
   or run `workstation\reset.ps1`.
3. Choose how you want to sit the lab:
   - **In the app (recommended):** open <http://localhost:3000>, go to **Lab Assessment**
     and press **Start**. A timer runs, every task has its own editor, and **Submit**
     grades everything.
   - **Offline:** write your answers in [`answer-sheet.sql`](answer-sheet.sql) using any
     SQL client (Adminer, MySQL Workbench, DBeaver, `mysql-cli`). Grade it with
     `workstation\grade-lab.ps1` or `workstation/grade-lab.sh`.

## Rules and conventions

- **Revenue** of an order line = `quantity * unit_price * (1 - discount)`.
- A **valid order** has a status that is **not** `cancelled` and **not** `returned`.
- Work in `shopdb` unless a task is marked **[playground]**.
- Return the requested columns **in the requested order**. Column aliases are not graded;
  values are. Row order only matters when the task asks you to sort.
- Round only where the task says so.
- You may use the [playbook](../playbook/) and the MySQL reference manual.
  **Do not open [`lab-tasks.js`](lab-tasks.js)**: it contains the model answers.

## Mark scheme

| Section | Topic | Tasks | Marks |
|---|---|---|---|
| A | Fundamentals: DDL, DML, filtering, sorting | A1–A5 | 20 |
| B | Intermediate: aggregation, joins, unions, CASE | B1–B5 | 25 |
| C | Advanced: window functions, CTEs, recursion, string/date functions | C1–C5 | 25 |
| D | Design & performance: indexes, normalisation, views | D1–D3 | 15 |
| E | Programmability: procedures, functions, transactions | E1–E3 | 15 |

**Result bands:** 85%+ Distinction · 70–84% Merit · 60–69% Pass · below 60% Not yet: revise and retake.

## The tasks

### Section A: Fundamentals (20 marks)

**A1 (4). Create the support_tickets table** *[playground]*
Create table `support_tickets` with these columns:
- `ticket_id`: INT, auto-increment primary key
- `customer_id`: INT NOT NULL
- `subject`: VARCHAR(150) NOT NULL
- `priority`: ENUM('low','medium','high') NOT NULL, default 'medium'
- `created_at`: DATETIME NOT NULL, defaulting to the current timestamp
- `resolved_at`: DATETIME, nullable

**A2 (4). Audio price increase**
Increase the `unit_price` of every **active** product in the Audio category (`category_id = 6`) by 5%, rounded to 2 decimals. No other product may change.

**A3 (4). 2022 sign-ups in the UK & Australia**
Customers from the UK or Australia who signed up during 2022. Return `customer_id, first_name, last_name, city, signup_date`, sorted by `signup_date` then `customer_id`.

**A4 (4). Phone & Pro product search**
Active products whose name contains "phone" or "pro" (any case) and whose stock is between 20 and 200 inclusive. Return `sku, name, stock_qty`, sorted by `sku`.

**A5 (4). Well-paid staff without commission**
Employees with no commission and salary above 60000. Return `employee_id, full_name, salary`, highest salary first, then `employee_id`.

### Section B: Intermediate (25 marks)

**B1 (5). Sales rep performance 2024**
For each sales rep who handled valid orders placed in 2024, return `employee_id, rep_name, orders_handled` (distinct orders) and `revenue` (2 dp).

**B2 (5). Review scores by category**
For each category, return `category, review_count, avg_rating` (2 dp). Include only categories with at least 55 reviews.

**B3 (5). Lapsed customers**
Customers who ordered before 2024-10-01 but have no order on or after that date. Return `customer_id, email, last_order_date` (DATE of the most recent order).

**B4 (5). Customer activity timeline**
Combine customer 25's orders and reviews into one timeline with columns `activity_date` (DATE), `activity` ('order' / 'review') and `ref_id`. Sort by date, then activity, then ref_id.

**B5 (5). Stock status summary**
Classify active products by stock level:

| Stock | Status |
|---|---|
| 0 | Out of stock |
| below 30 | Low |
| below 100 | OK |
| 100 or more | Overstocked |

Return `stock_status, product_count, total_units` in exactly that order of statuses, and leave out statuses that have no products.

### Section C: Advanced (25 marks)

**C1 (5). Top 3 customers per country**
Use RANK() to rank customers within their country by revenue from valid orders. Return `country, customer_id, revenue` (2 dp) and `revenue_rank`, for ranks 1–3 only.

**C2 (5). Month-over-month growth 2024**
For valid orders in 2024, return:
- `month_no`: 1–12
- `revenue`: 2 dp
- `prev_revenue`: the previous month's revenue (NULL for January)
- `growth_pct`: `(revenue - prev_revenue) / prev_revenue * 100`, rounded to 1 dp

Sort by month.

**C3 (5). The Sales organisation**
List everyone who reports to employee 2 (VP of Sales), directly or indirectly. Return `employee_id, full_name, level`, sorted by level then id.

**C4 (5). Category heavyweights**
For valid orders, work out each product's revenue as a share of its category's revenue. Return `category, product, product_revenue` (2 dp) and `share_pct` (1 dp), keeping rows where the rounded share is above 30.

**C5 (5). Customers without a phone**
For customers with no phone number, return:
- `customer_id`
- `initials`: upper-case first letters of first and last name
- `email_domain`
- `days_since_signup`: days from signup to 2025-01-01
- `signup_quarter`: formatted like `2022-Q3`

### Section D: Design & Performance (15 marks)

**D1 (5). Index for the order dashboard**
The operations dashboard constantly filters with `WHERE status = ? AND order_date >= ?`. Create a composite index named `idx_orders_status_date` that serves this pattern best.

**D2 (5). Normalise legacy invoices** *[playground]*
Create `legacy_invoices` with columns `invoice_no` INT (primary key), `invoice_date` DATE NOT NULL, `customer_email` VARCHAR(100) NOT NULL and `sales_rep` VARCHAR(100) NOT NULL. Fill it with one row per invoice from `shopdb.legacy_sales`.

**D3 (5). Product performance view**
Create view `v_product_performance` with one row for **every** product:
- `product_id`
- `product_name`
- `units_sold`: from valid orders, 0 if none
- `revenue`: from valid orders, 2 dp, 0 if none
- `avg_rating`: 2 dp, NULL if the product has no reviews

Beware of join fan-out when you combine sales and reviews.

### Section E: Programmability (15 marks)

**E1 (5). Restock procedure**
Create `sp_restock(IN p_product_id INT, IN p_qty INT)`. If `p_qty <= 0`, raise an error with `SIGNAL SQLSTATE '45000'`. Otherwise, add `p_qty` to the product's `stock_qty`.

**E2 (5). Order revenue function**
Create `fn_order_revenue(p_order_id INT) RETURNS DECIMAL(12,2)`. It returns the order's revenue (2 dp), and returns **0** (not NULL) when the order has no lines.

**E3 (5). Atomic transfer** *[playground]*
In one explicit transaction, move 500 from account 3 (Charlie) to account 1 (Alice) and record it in `transfers(from_account, to_account, amount)`, then commit.

## After the lab

- In the app, the results page shows each task's model solution. Compare it with your approach; there is usually more than one correct answer.
- Any section under 60%? Go back to that chapter of the playbook and redo its practice exercises, then reset the database and retake the lab.

# 0. Roadmap & How to Use This Playbook

This playbook takes you from your first `SELECT` to query tuning, stored procedures and
database security. Each chapter follows the same loop:

1. **Read** a section here. Every SQL example has a **Try it** button that opens it in the app's SQL Console.
2. **Practise** with the auto-graded exercises for that chapter (the app's **Practice** page).
3. **Experiment** in the **SQL Console**. Break things; *Settings → Reset* fixes them.
4. When every chapter is done, sit the timed **Lab Assessment** (see `lab/README.md`).

## Study plan (about 6 weeks at 5–7 hours per week)

| Week | Chapter | You should be able to... |
|---|---|---|
| 1 | [1. Fundamentals](01-fundamentals.md) | create tables, insert/update/delete rows, filter and sort with confidence |
| 2 | [2. Intermediate](02-intermediate.md) | summarise data with GROUP BY, combine tables with every kind of JOIN, use UNION and CASE |
| 3 | [3. Advanced (part 1)](03-advanced.md) | write subqueries and CTEs, including recursive ones |
| 4 | [3. Advanced (part 2)](03-advanced.md) | use window functions, string and date functions |
| 5 | [4. Design & Performance](04-design-performance.md) | normalise a schema, choose indexes, read EXPLAIN plans |
| 6 | [5. Programmability & Admin](05-programmability-admin.md) | write procedures, functions and triggers, use transactions, manage users, prevent SQL injection |
| - | [Cheat sheet](06-cheatsheet.md) | quick syntax reference, plus MySQL vs PostgreSQL vs SQL Server |

> **Tip:** Don't just read the solutions. Type every query yourself, predict the result
> *before* you run it, then compare. Wrong predictions are where the learning happens.

## Your workstation

| Tool | Where | Use it for |
|---|---|---|
| Learning app | <http://localhost:3000> | playbook, practice, console, lab |
| Adminer | <http://localhost:8081> | browsing tables and data in a GUI (server `mysql`, user `learner`) |
| mysql CLI | `workstation\mysql-cli.ps1` | the classic command-line client |
| Any desktop client | `localhost:3306` | MySQL Workbench, DBeaver, DataGrip, VS Code extensions |

Credentials (from `workstation/.env`): user **learner**, password **learnerpass**, database **shopdb**.

## The practice data: ShopCo

**ShopCo** is a small online retailer. All exercises and the lab use this schema.
In the app, the interactive ER diagram below is drawn from the live database. Hover a table to
see its relationships. It is also on **Practice → Meet the database**, and behind the
**ER diagram** button on every question.

<div class="er-embed" data-db="shopdb"></div>

Text version:

```
departments ─┐
             └─< employees >─┐ (manager_id → employees: an org chart)
                             │
categories (tree) ─< products >─ suppliers
                        │
customers ─< orders >───┼── employees (sales rep, optional)
               │        │
               ├─< order_items >─ products
               └─< payments

products ─< product_reviews >─ customers
web_events       200,000 click-stream rows, no secondary indexes (performance lab)
legacy_sales     a badly designed spreadsheet import (normalisation lab)
```

| Table | Rows | Notes |
|---|---|---|
| `departments` | 7 | *Research* has no employees |
| `employees` | 26 | `manager_id` builds a hierarchy; *Zoe* has no department |
| `categories` | 13 | three-level tree via `parent_category_id` |
| `suppliers` | 6 | |
| `products` | 40 | products 37–40 were never ordered; 39 is discontinued |
| `customers` | 120 | 111–120 have never ordered; some phones are NULL |
| `orders` | 1,500 | Jan 2023 – Dec 2024, statuses pending/shipped/delivered/cancelled/returned |
| `order_items` | ~3,700 | revenue of a line = `quantity * unit_price * (1 - discount)` |
| `payments` | ~1,400 | one per order that isn't cancelled or pending |
| `product_reviews` | 500 | ratings 1–5, some without text |
| `web_events` | 200,000 | for index and EXPLAIN experiments |

The second database, **playground**, is your scratch space. It contains `accounts`,
`transfers` and `app_users` for the transactions and security lessons.

Look around first:

```sql
SHOW TABLES;
```

```sql
DESCRIBE orders;
```

```sql
SELECT * FROM orders LIMIT 10;
```

## How SQL is organised

SQL commands fall into families. You will meet all of them:

| Family | Purpose | Commands |
|---|---|---|
| **DDL**: Data Definition | define structure | `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME` |
| **DML**: Data Manipulation | change rows | `INSERT`, `UPDATE`, `DELETE` |
| **DQL**: Data Query | read rows | `SELECT` |
| **DCL**: Data Control | permissions | `GRANT`, `REVOKE` |
| **TCL**: Transaction Control | group changes | `START TRANSACTION`, `COMMIT`, `ROLLBACK`, `SAVEPOINT` |

Continue with [1. Fundamentals](01-fundamentals.md).

# SQL Mastery

A self-contained course for learning SQL on MySQL 8. It covers everything from `SELECT`
to window functions, indexing, stored procedures, transactions and SQL-injection defence.

| Folder | What's inside |
|---|---|
| [`workstation/`](workstation/) | Docker setup: **MySQL 8.4** + **Adminer** GUI + the learning app, seed data, helper scripts |
| [`app/`](app/) | The **learning app**: playbook reader, 61 auto-graded exercises, SQL console, timed lab |
| [`playbook/`](playbook/) | The **playbook**: 7 chapters of explanations with runnable examples |
| [`lab/`](lab/) | The **practical lab assessment**: 20 tasks, 100 marks, auto-graded |

## Quick start

Prerequisite: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running).

```powershell
# Windows (PowerShell)
cd workstation
.\setup.ps1
```

```bash
# macOS / Linux / WSL / Git Bash
cd workstation
./setup.sh
```

The first start downloads the images and seeds about 210,000 rows, which takes 1–3 minutes. Then open:

| | URL | Login |
|---|---|---|
| **Learning app** | <http://localhost:3000> | - |
| Adminer (DB GUI) | <http://localhost:8081> | server `mysql`, user `learner`, password `learnerpass` |
| MySQL (any client) | `localhost:3306` | user `learner`, password `learnerpass`, database `shopdb` |

## Learning path

1. **Playbook** → read a chapter (every SQL example has a *Try it* button).
2. **Practice** → solve that chapter's exercises; *Check answer* grades you instantly.
3. **SQL Console** → experiment freely (a real persistent session; transactions work).
4. **Lab Assessment** → 120-minute timed practical once all 5 chapters are done.

| Chapter | Topics |
|---|---|
| 0. Roadmap | study plan, the ShopCo dataset, SQL command families |
| 1. Fundamentals | data types, DDL (`CREATE`/`ALTER`/`DROP`), DML (`INSERT`/`UPDATE`/`DELETE`), `SELECT`, `WHERE`, `ORDER BY`, `DISTINCT`, `LIMIT`, `BETWEEN`/`IN`/`LIKE`, NULL |
| 2. Intermediate | aggregates, `GROUP BY`/`HAVING`, all joins (incl. FULL OUTER emulation), `UNION`/`UNION ALL`, `CASE` |
| 3. Advanced | subqueries, correlated/`EXISTS`, CTEs, recursive CTEs, window functions (`ROW_NUMBER`, `RANK`, `LAG`/`LEAD`, running totals), string & date functions |
| 4. Design & Performance | keys, 1NF–3NF normalisation, constraints, views, clustered/secondary/composite/covering indexes, `EXPLAIN ANALYZE`, sargable queries |
| 5. Programmability & Admin | procedures, functions, triggers, transactions/ACID/savepoints, users & roles, SQL injection & prepared statements |
| 6. Cheat sheet | syntax reference + MySQL vs PostgreSQL vs SQL Server |

## Workstation scripts

Run from `workstation/` (use `.ps1` on Windows PowerShell, `.sh` elsewhere):

| Script | Does |
|---|---|
| `setup` | build and start everything, wait until the database is seeded |
| `stop` | stop the containers (data kept); `-Remove` / `--remove` also removes them |
| `reset` | **wipe** the database volume and re-seed from scratch |
| `mysql-cli` | open the `mysql` client (`-Root` / `--root` for root, or pass a database name) |
| `grade-lab` | auto-grade `lab/answer-sheet.sql` |
| `backup` / `restore` | dump / restore `shopdb` + `playground` to `workstation/backups/` |

For a quick reset of just the practice data, use **Settings → Reset database** in the app (about 5 seconds).

## The practice data

Two databases are seeded from [`workstation/mysql/init/`](workstation/mysql/init/):

- **`shopdb`**: *ShopCo*, a small online retailer: departments, employees (with an org
  chart), a category tree, suppliers, 40 products, 120 customers, 1,500 orders (2023–2024),
  order items, payments, 500 reviews, **200,000 web events** (un-indexed, for performance
  work) and a deliberately **denormalised legacy table** (for normalisation work). The data
  is generated deterministically, so everyone gets identical results.
- **`playground`**: a scratch area with bank accounts (transactions) and an app-users
  table (SQL injection).

## How grading works

The grader runs your SQL and the model solution the same way on a fresh connection and
compares the results: values, column count and (when the task asks for sorting) row order.
- **Queries** are compared directly. Column aliases are ignored and numbers are compared to the cent.
- **DML** (`INSERT`/`UPDATE`/`DELETE`) runs inside a transaction. The grader inspects the
  resulting table state and then **rolls back**, so grading never changes your data.
- **DDL** (tables, indexes, views, routines, triggers, roles) is verified through
  `information_schema` or by calling the object you created.
- Some exercises also require a particular technique (e.g. "use a CTE", "no `= NULL`").

Content self-test (every model solution must pass its own grader):

```bash
docker exec sqlm-app node scripts/verify-content.js
```

## Running the app without Docker (optional)

If you already run MySQL 8 locally, load `workstation/mysql/init/*.sql` in order (as root),
then:

```bash
cd app
npm install
DB_HOST=127.0.0.1 DB_USER=learner DB_PASSWORD=learnerpass npm start
```

# 4. Database Design & Performance

**Goal:** design tables that don't contradict themselves (normalisation and constraints),
and make queries fast (indexes, execution plans, query rewriting).

## 4.1 Keys and relationships

| Term | Meaning |
|---|---|
| **Primary key (PK)** | column(s) that uniquely identify a row. Keep it small and stable; an auto-increment INT is typical |
| **Candidate / natural key** | another unique identifier, e.g. `email`, `sku`. Enforce it with `UNIQUE` |
| **Foreign key (FK)** | a column that must match a PK in another table; it enforces *referential integrity* |
| **One-to-many** | FK on the "many" side (`orders.customer_id → customers`) |
| **Many-to-many** | needs a *junction table* (`order_items` links orders and products) |
| **One-to-one** | FK + UNIQUE on one side |

```sql
USE playground;
CREATE TABLE authors (
  author_id INT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL
);
CREATE TABLE books (
  book_id   INT PRIMARY KEY,
  title     VARCHAR(200) NOT NULL,
  author_id INT NOT NULL,
  CONSTRAINT fk_books_author FOREIGN KEY (author_id)
    REFERENCES authors (author_id)
    ON DELETE CASCADE          -- or RESTRICT (default) / SET NULL
    ON UPDATE CASCADE
);
INSERT INTO authors VALUES (1, 'Ada');
INSERT INTO books VALUES (10, 'Notes on the Analytical Engine', 1);
-- INSERT INTO books VALUES (11, 'Ghost book', 99);   -- fails: author 99 does not exist
DELETE FROM authors WHERE author_id = 1;             -- CASCADE removes book 10 too
SELECT * FROM books;
```

## 4.2 Normalisation

Normalisation removes **redundancy** so that each fact is stored exactly once. Redundant
data leads to **anomalies**:

- **Update anomaly:** a customer's city is stored on every invoice line, and one copy gets changed but the others don't.
- **Insert anomaly:** you can't record a new product until someone orders it.
- **Delete anomaly:** deleting the last order for a product also deletes the only record of its price.

Look at the legacy import:

```sql
SELECT invoice_no, customer_name, customer_phones, customer_city, product_name, product_category, sales_rep
FROM legacy_sales
ORDER BY invoice_no;
```

Nimal Perera is in *Colombo* on some rows and *Kandy* on others. Which one is true? That
is an update anomaly.

### The normal forms (the practical version)

| Form | Rule | Violation in `legacy_sales` | Fix |
|---|---|---|---|
| **1NF** | every column holds a single (atomic) value; no repeating groups | `customer_phones = '0771234567, 0112233445'` | a separate `customer_phones(customer_id, phone)` table |
| **2NF** | 1NF, and every non-key column depends on the **whole** key | with key (invoice_no, product_name), `invoice_date` depends on invoice_no only | move invoice facts to an `invoices` table |
| **3NF** | 2NF, and no non-key column depends on **another non-key** column | `sales_rep_office` depends on `sales_rep`, not on the invoice | a `sales_reps` table |

> Memory hook: every non-key column must depend on **the key (1NF), the whole key (2NF),
> and nothing but the key (3NF)**.

The normalised design for the legacy data:

```
customers(customer_id PK, name, email UNIQUE, city)
customer_phones(customer_id FK, phone, PK(customer_id, phone))
sales_reps(rep_id PK, name, office)
products(product_id PK, name, category_id FK)
invoices(invoice_no PK, invoice_date, customer_id FK, rep_id FK)
invoice_lines(invoice_no FK, product_id FK, qty, unit_price, PK(invoice_no, product_id))
```

Notice that `shopdb` itself follows this design: `orders` + `order_items` + `products` + `customers`.

**Denormalisation** (deliberately storing redundant data) is sometimes done for read
speed, as in reporting tables and data warehouses. Do it knowingly, and keep the copy in sync.

## 4.3 Constraints protect data quality

```sql
USE playground;
CREATE TABLE wallets (
  wallet_id INT PRIMARY KEY,
  owner     VARCHAR(50)   NOT NULL,
  balance   DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT chk_wallet_balance CHECK (balance >= 0)
);
INSERT INTO wallets VALUES (1, 'Alice', 10);
UPDATE wallets SET balance = balance - 50 WHERE wallet_id = 1;  -- rejected by the CHECK
```

Constraints are your last line of defence: application bugs come and go, but the database rules always apply.

## 4.4 Views

A view is a stored `SELECT` that you can query like a table. Use views to hide complexity,
provide a stable interface, or expose only some columns to a user.

```sql
CREATE OR REPLACE VIEW v_customer_spend AS
SELECT c.customer_id, CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
       COUNT(p.payment_id) AS orders_paid, SUM(p.amount) AS total_spend
FROM customers c
JOIN orders o   ON o.customer_id = c.customer_id
JOIN payments p ON p.order_id = o.order_id
GROUP BY c.customer_id, c.first_name, c.last_name;

SELECT * FROM v_customer_spend ORDER BY total_spend DESC LIMIT 10;
```

A view stores the *query*, not the data, so it is always up to date, and it is only as fast
as the query underneath. `shopdb` already contains a view, `v_order_summary`.

## 4.5 Indexes

Without an index, finding rows means reading the **whole table** (a *full table scan*).
An index is a sorted structure (a B-tree) that lets MySQL jump straight to matching rows,
much like the index at the back of a book.

| Type (InnoDB) | Description |
|---|---|
| **Clustered index** | the table *is* the primary key B-tree; rows are stored in PK order. One per table |
| **Secondary (non-clustered) index** | a separate B-tree of the indexed columns + the PK, pointing back to the row |
| **Composite index** | an index on several columns, e.g. `(customer_id, event_time)` |
| **Covering index** | contains **every** column the query needs, so the table itself is never read ("Using index") |
| **Unique index** | also enforces uniqueness |

### See the difference yourself

`web_events` has 200,000 rows and only a primary key:

```sql
EXPLAIN ANALYZE
SELECT * FROM web_events WHERE customer_id = 42 ORDER BY event_time;
```

Look for `Table scan on web_events` and the actual time. Now add an index and repeat:

```sql
CREATE INDEX idx_events_customer_time ON web_events (customer_id, event_time);
```

```sql
EXPLAIN ANALYZE
SELECT * FROM web_events WHERE customer_id = 42 ORDER BY event_time;
```

Now it reads `Index lookup on web_events using idx_events_customer_time`, and there is no
sort step, because the index already stores the rows in `event_time` order for each customer.

### Composite index column order: the leftmost-prefix rule

An index on `(a, b, c)` can serve filters on `a`, on `a, b`, or on `a, b, c`, but **not**
`b` alone or `c` alone. It's like a phone book sorted by (last name, first name): easy to
find "Smith", useless for finding everyone called "John".

Rules of thumb:
1. Put **equality** columns first (`status = ?`), then **range or sort** columns (`order_date >= ?`, `ORDER BY event_time`).
2. Prefer columns that are **selective** (they narrow the result a lot).
3. For a covering index, add the remaining columns the query reads.

```sql
CREATE INDEX idx_events_type_customer ON web_events (event_type, customer_id);
EXPLAIN
SELECT customer_id, COUNT(*) FROM web_events WHERE event_type = 'purchase' GROUP BY customer_id;
-- Extra: "Using index" means covering: the table rows are never touched
```

### Indexes are not free

- Every INSERT, UPDATE and DELETE must also update every index, so writes get slower.
- Indexes use disk and memory.
- Low-selectivity columns alone (e.g. `is_active` with two values) rarely help.
- Index the columns you actually filter, join and sort on, and check with EXPLAIN.

```sql
SHOW INDEX FROM web_events;
DROP INDEX idx_events_type_customer ON web_events;
```

## 4.6 Reading execution plans

| Tool | What it shows |
|---|---|
| `EXPLAIN <query>` | the *estimated* plan (table form) |
| `EXPLAIN FORMAT=TREE <query>` | the plan as a tree of steps |
| `EXPLAIN ANALYZE <query>` | **runs** the query and shows actual time and rows per step |

Key columns in classic `EXPLAIN` output:

| Column | Good | Bad |
|---|---|---|
| `type` | `const`, `eq_ref`, `ref`, `range` | `ALL` (full scan), `index` (full index scan) |
| `key` | the index you expected | NULL (no index used) |
| `rows` | small | close to the table size |
| `Extra` | `Using index` | `Using filesort`, `Using temporary` on big tables |

```sql
EXPLAIN
SELECT o.order_id, c.email
FROM orders o JOIN customers c ON c.customer_id = o.customer_id
WHERE o.order_date >= '2024-12-01';
```

## 4.7 Query optimisation techniques

**1. Keep predicates sargable** (Search-ARGument-able). Wrapping the column in a function hides it from the index:

```sql
-- not sargable: YEAR() has to be computed for every row
SELECT order_id FROM orders WHERE YEAR(order_date) = 2024 AND MONTH(order_date) = 2;
-- sargable: the index on order_date can be range-scanned
SELECT order_id FROM orders WHERE order_date >= '2024-02-01' AND order_date < '2024-03-01';
```

The same applies to `WHERE LOWER(email) = ...`, `WHERE price * 1.2 > 100` and
`WHERE CONCAT(first_name, last_name) = ...`. Transform the *constant*, not the column.
(MySQL 8 can also index expressions: `CREATE INDEX ix ON t ((LOWER(email)));`.)

**2. Select only the columns you need.** `SELECT *` defeats covering indexes and moves more data.

**3. Leading wildcards can't use an index:** `LIKE '%phone'` scans; `LIKE 'phone%'` can seek.

**4. Filter early, and aggregate before you join** when you are joining large *many* sides together.

**5. Prefer `EXISTS` over `IN` / `DISTINCT` + join** for "has any" questions. It stops at the first match.

**6. Avoid `OR` across different columns.** Consider `UNION ALL` of two indexed queries.

**7. Paginate with keys, not big OFFSETs:** `WHERE event_id > :last_seen ORDER BY event_id LIMIT 50`
instead of `LIMIT 50 OFFSET 100000`, which still reads 100,050 rows.

**8. Keep statistics fresh:** `ANALYZE TABLE web_events;`

**9. Measure, don't guess:** compare `EXPLAIN ANALYZE` before and after every change.

## Practice

Open **Practice → 4. Design & Performance** (8 exercises). Next: [5. Programmability & Administration](05-programmability-admin.md).

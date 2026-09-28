# 6. Cheat Sheet

## Query skeleton (in written order)

```sql
WITH cte AS (SELECT ...)                   -- optional named subqueries
SELECT DISTINCT col, expr AS alias, AGG(col),
       FN() OVER (PARTITION BY .. ORDER BY ..)
FROM t1
JOIN t2 ON t2.fk = t1.pk                   -- INNER / LEFT / RIGHT / CROSS
WHERE row_condition                        -- filter rows
GROUP BY col                               -- one row per group
HAVING AGG(col) > x                        -- filter groups
ORDER BY alias DESC, col                   -- sort (always add a tie-breaker)
LIMIT 10 OFFSET 20;                        -- page
```

Logical evaluation order: **FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT**.

## DDL / DML one-liners

```sql
CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE, price DECIMAL(10,2) DEFAULT 0 CHECK (price >= 0));
ALTER TABLE t ADD COLUMN c INT, MODIFY COLUMN name VARCHAR(100) NOT NULL, RENAME COLUMN c TO d, DROP COLUMN d;
ALTER TABLE t ADD CONSTRAINT fk FOREIGN KEY (x_id) REFERENCES x(id) ON DELETE CASCADE;
CREATE INDEX ix ON t (a, b);      DROP INDEX ix ON t;
TRUNCATE TABLE t;                 DROP TABLE IF EXISTS t;
INSERT INTO t (a, b) VALUES (1, 'x'), (2, 'y');
INSERT INTO t (a, b) SELECT a, b FROM s WHERE ...;
INSERT INTO t (id, qty) VALUES (1, 5) ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty);   -- "upsert"
UPDATE t SET a = a + 1 WHERE id = 1;
UPDATE t JOIN s ON s.id = t.s_id SET t.a = s.a WHERE ...;
DELETE FROM t WHERE ...;
```

## Operators & functions you will use daily

| Need | MySQL |
|---|---|
| NULL-safe default | `COALESCE(a, b)`, `IFNULL(a, b)` |
| avoid divide by zero | `x / NULLIF(y, 0)` |
| inline if | `IF(cond, a, b)`, `CASE WHEN ... THEN ... ELSE ... END` |
| text | `CONCAT`, `CONCAT_WS`, `SUBSTRING`, `SUBSTRING_INDEX`, `REPLACE`, `TRIM`, `UPPER`, `LOWER`, `LPAD`, `CHAR_LENGTH`, `REGEXP_LIKE` |
| list aggregation | `GROUP_CONCAT(x ORDER BY x SEPARATOR ', ')` |
| rounding | `ROUND(x, 2)`, `TRUNCATE(x, 2)`, `CEIL`, `FLOOR` |
| dates | `DATE`, `YEAR`, `MONTH`, `QUARTER`, `DAYNAME`, `DATE_FORMAT(d,'%Y-%m')`, `DATEDIFF`, `TIMESTAMPDIFF(unit,a,b)`, `d + INTERVAL 7 DAY`, `LAST_DAY` |
| type conversion | `CAST(x AS DECIMAL(10,2))`, `CAST(x AS CHAR)`, `STR_TO_DATE` |
| JSON | `JSON_EXTRACT(doc, '$.a')` or `doc->>'$.a'`, `JSON_OBJECT`, `JSON_ARRAYAGG` |

## Window functions

```sql
ROW_NUMBER() OVER (PARTITION BY g ORDER BY x DESC)       -- 1,2,3,4
RANK()       OVER (...)                                  -- 1,2,2,4
DENSE_RANK() OVER (...)                                  -- 1,2,2,3
NTILE(4)     OVER (ORDER BY x)                           -- quartiles
LAG(x, 1)  OVER (ORDER BY d)   LEAD(x) OVER (ORDER BY d) -- previous / next row
SUM(x) OVER (ORDER BY d)                                 -- running total
AVG(x) OVER (ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)  -- moving average
x / SUM(x) OVER (PARTITION BY g)                         -- share of group
```

## Join picker

| Question | Pattern |
|---|---|
| rows that match in both | `A JOIN B ON ...` |
| all of A, matching B if any | `A LEFT JOIN B ON ...` |
| A **without** a match in B | `A LEFT JOIN B ON ... WHERE B.pk IS NULL` or `NOT EXISTS` |
| does A have *any* B | `WHERE EXISTS (SELECT 1 FROM B WHERE ...)` |
| everything from both | `LEFT JOIN ... UNION ... RIGHT JOIN` (MySQL) |
| hierarchy (manager, parent) | self join, or `WITH RECURSIVE` for any depth |

## Transactions & security

```sql
START TRANSACTION;  ...  COMMIT;   -- or ROLLBACK;
SAVEPOINT s1;  ROLLBACK TO SAVEPOINT s1;
SELECT ... FOR UPDATE;                                -- lock rows you intend to change
CREATE ROLE r;  GRANT SELECT ON db.* TO r;  GRANT r TO 'u'@'%';  SET DEFAULT ROLE r TO 'u'@'%';
CREATE USER 'u'@'%' IDENTIFIED BY 'pw';  REVOKE ... FROM ...;  DROP USER 'u'@'%';
PREPARE s FROM 'SELECT ... WHERE id = ?';  SET @id = 5;  EXECUTE s USING @id;  DEALLOCATE PREPARE s;
```

## Performance checklist

1. `EXPLAIN ANALYZE` first. Look for `Table scan`, big `rows`, `Using filesort` / `Using temporary`.
2. Index the columns you filter, join and sort on. Put **equality columns first, then range/sort**.
3. Keep predicates sargable: no functions on indexed columns, no leading `%` in LIKE.
4. Select only the needed columns, which makes covering indexes possible.
5. Aggregate before joining big one-to-many tables, to avoid fan-out.
6. Paginate by key (`WHERE id > last ORDER BY id LIMIT n`), not by huge OFFSETs.
7. Re-measure after every change.

## MySQL vs PostgreSQL vs SQL Server (T-SQL)

| Feature | MySQL 8 | PostgreSQL | SQL Server |
|---|---|---|---|
| First *n* rows | `LIMIT n OFFSET m` | `LIMIT n OFFSET m` | `TOP n` / `OFFSET m ROWS FETCH NEXT n ROWS ONLY` |
| Auto id | `AUTO_INCREMENT` | `GENERATED ALWAYS AS IDENTITY` / `SERIAL` | `IDENTITY(1,1)` |
| String concat | `CONCAT(a, b)` | `a \|\| b` or `CONCAT` | `a + b` or `CONCAT` |
| Identifier quotes | `` `name` `` | `"name"` | `[name]` |
| Current time | `NOW()` | `NOW()` | `GETDATE()` / `SYSDATETIME()` |
| Date difference | `DATEDIFF(a, b)` (days) | `a - b` | `DATEDIFF(day, b, a)` |
| Date formatting | `DATE_FORMAT(d, '%Y-%m')` | `TO_CHAR(d, 'YYYY-MM')` | `FORMAT(d, 'yyyy-MM')` |
| If-null | `IFNULL` / `COALESCE` | `COALESCE` | `ISNULL` / `COALESCE` |
| FULL OUTER JOIN | emulate with UNION | yes | yes |
| Upsert | `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE` | `MERGE` |
| Procedures | `CREATE PROCEDURE ... BEGIN ... END` + `CALL` | `CREATE PROCEDURE/FUNCTION ... LANGUAGE plpgsql` + `CALL` | `CREATE PROCEDURE ... AS BEGIN ... END` + `EXEC` |
| Transactions | `START TRANSACTION` | `BEGIN` | `BEGIN TRAN` |
| Transactional DDL | no (implicit commit) | **yes** | mostly yes |
| Clustered index | always the PK (InnoDB) | none (heap + `CLUSTER` command) | choose any one index |

## Where to go next

- Rebuild a small real project (a library, a gym, your expenses) from an empty schema: design, seed, query.
- Read execution plans of the queries you write at work or in personal projects.
- Try the same exercises on PostgreSQL. The concepts transfer directly.
- Re-take the lab after two weeks without looking at your notes.

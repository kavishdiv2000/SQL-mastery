-- =====================================================================
-- 30 - Clickstream data: 200,000 rows in web_events (~1 year, 25k sessions)
-- Big enough that a missing index is noticeable in EXPLAIN / EXPLAIN ANALYZE.
-- =====================================================================
USE shopdb;
SET SESSION cte_max_recursion_depth = 1000000;

INSERT INTO web_events (customer_id, session_id, event_type, page_url, device, event_time)
WITH RECURSIVE seq (n) AS (
  SELECT 0 UNION ALL SELECT n + 1 FROM seq WHERE n < 199999
)
SELECT
  CASE WHEN MOD(FLOOR(n / 8), 10) < 3 THEN NULL                                  -- 30% anonymous sessions
       ELSE 1 + MOD(CRC32(CONCAT('sess-', FLOOR(n / 8))), 120) END,
  CONCAT('S', LPAD(FLOOR(n / 8), 6, '0')),
  ELT(1 + MOD(CRC32(CONCAT('evt-', n)), 10),
      'page_view', 'page_view', 'page_view', 'page_view', 'search',
      'search', 'add_to_cart', 'add_to_cart', 'checkout', 'purchase'),
  CONCAT('/products/', 1 + MOD(CRC32(CONCAT('url-', n)), 40)),
  ELT(1 + MOD(FLOOR(n / 8), 3), 'desktop', 'mobile', 'tablet'),
  TIMESTAMP('2024-01-01 00:00:00') + INTERVAL (FLOOR(n / 8) * 1260 + MOD(n, 8) * 40) SECOND
FROM seq;

ANALYZE TABLE web_events;

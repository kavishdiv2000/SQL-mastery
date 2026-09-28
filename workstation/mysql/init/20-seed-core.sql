-- =====================================================================
-- 20 - Seed data for ShopCo
-- Small reference tables are written by hand. Customers, orders, items,
-- payments and reviews are GENERATED with recursive CTEs + CRC32() so the
-- data is realistic-looking but 100% deterministic (same on every machine).
-- =====================================================================
USE shopdb;
SET SESSION cte_max_recursion_depth = 1000000;

-- ---------------------------------------------------------------------
-- Departments (Research has no employees -> useful for outer joins)
-- ---------------------------------------------------------------------
INSERT INTO departments (department_id, name, location, budget) VALUES
  (1, 'Executive',        'London',     500000.00),
  (2, 'Sales',            'London',     800000.00),
  (3, 'Marketing',        'Manchester', 300000.00),
  (4, 'Engineering',      'Bristol',   1200000.00),
  (5, 'Finance',          'London',     250000.00),
  (6, 'Customer Support', 'Leeds',      200000.00),
  (7, 'Research',         'Cambridge',  400000.00);

-- ---------------------------------------------------------------------
-- Employees (org chart via manager_id; Zoe is a contractor with no dept)
-- ---------------------------------------------------------------------
INSERT INTO employees
  (employee_id, first_name, last_name, email, job_title, department_id, manager_id, hire_date, salary, commission_pct) VALUES
  ( 1, 'Olivia',    'Bennett',  'olivia.bennett@shopco.com',   'Chief Executive Officer',  1, NULL, '2015-03-01', 250000.00, NULL),
  ( 2, 'James',     'Carter',   'james.carter@shopco.com',     'VP of Sales',              2,    1, '2016-06-15', 160000.00, NULL),
  ( 3, 'Sophia',    'Turner',   'sophia.turner@shopco.com',    'Head of Marketing',        3,    1, '2017-01-09', 120000.00, NULL),
  ( 4, 'Liam',      'Walker',   'liam.walker@shopco.com',      'Chief Technology Officer', 4,    1, '2015-09-01', 210000.00, NULL),
  ( 5, 'Emma',      'Hughes',   'emma.hughes@shopco.com',      'Finance Director',         5,    1, '2016-02-01', 140000.00, NULL),
  ( 6, 'Noah',      'Patel',    'noah.patel@shopco.com',       'Support Manager',          6,    1, '2018-04-23',  85000.00, NULL),
  ( 7, 'Ava',       'Robinson', 'ava.robinson@shopco.com',     'Sales Manager',            2,    2, '2017-08-14',  95000.00, 0.05),
  ( 8, 'Mason',     'Clarke',   'mason.clarke@shopco.com',     'Sales Executive',          2,    7, '2019-01-07',  52000.00, 0.10),
  ( 9, 'Isla',      'Wright',   'isla.wright@shopco.com',      'Sales Executive',          2,    7, '2019-05-20',  54000.00, 0.10),
  (10, 'Ethan',     'Green',    'ethan.green@shopco.com',      'Sales Executive',          2,    7, '2020-02-03',  48000.00, 0.08),
  (11, 'Mia',       'Hall',     'mia.hall@shopco.com',         'Sales Executive',          2,    7, '2021-07-12',  47000.00, 0.08),
  (12, 'Lucas',     'Young',    'lucas.young@shopco.com',      'Sales Executive',          2,    2, '2022-03-28',  45000.00, 0.07),
  (13, 'Amelia',    'King',     'amelia.king@shopco.com',      'Account Manager',          2,    2, '2020-10-19',  61000.00, 0.06),
  (14, 'Harper',    'Scott',    'harper.scott@shopco.com',     'Marketing Specialist',     3,    3, '2019-11-11',  51000.00, NULL),
  (15, 'Elijah',    'Adams',    'elijah.adams@shopco.com',     'Content Writer',           3,    3, '2021-09-06',  42000.00, NULL),
  (16, 'Charlotte', 'Baker',    'charlotte.baker@shopco.com',  'Senior Engineer',          4,    4, '2016-11-21', 115000.00, NULL),
  (17, 'Benjamin',  'Nelson',   'benjamin.nelson@shopco.com',  'Software Engineer',        4,   16, '2019-06-17',  82000.00, NULL),
  (18, 'Grace',     'Mitchell', 'grace.mitchell@shopco.com',   'Software Engineer',        4,   16, '2020-08-24',  78000.00, NULL),
  (19, 'Henry',     'Perez',    'henry.perez@shopco.com',      'Data Engineer',            4,   16, '2021-01-11',  88000.00, NULL),
  (20, 'Lily',      'Roberts',  'lily.roberts@shopco.com',     'QA Engineer',              4,   16, '2022-05-09',  65000.00, NULL),
  (21, 'Jack',      'Evans',    'jack.evans@shopco.com',       'DevOps Engineer',          4,    4, '2018-03-05',  95000.00, NULL),
  (22, 'Chloe',     'Morgan',   'chloe.morgan@shopco.com',     'Accountant',               5,    5, '2019-02-18',  58000.00, NULL),
  (23, 'Oscar',     'Lewis',    'oscar.lewis@shopco.com',      'Financial Analyst',        5,    5, '2021-10-04',  55000.00, NULL),
  (24, 'Ella',      'Cooper',   'ella.cooper@shopco.com',      'Support Agent',            6,    6, '2020-06-01',  32000.00, NULL),
  (25, 'Leo',       'Ward',     'leo.ward@shopco.com',         'Support Agent',            6,    6, '2022-11-14',  31000.00, NULL),
  (26, 'Zoe',       'Price',    'zoe.price@contractor.io',     'Contract Data Analyst', NULL, NULL, '2023-04-03',  60000.00, NULL);

-- ---------------------------------------------------------------------
-- Category tree (3 levels under Electronics)
-- ---------------------------------------------------------------------
INSERT INTO categories (category_id, name, parent_category_id) VALUES
  ( 1, 'Electronics',       NULL),
  ( 2, 'Computers',            1),
  ( 3, 'Laptops',              2),
  ( 4, 'Accessories',          2),
  ( 5, 'Phones',               1),
  ( 6, 'Audio',                1),
  ( 7, 'Home & Kitchen',    NULL),
  ( 8, 'Appliances',           7),
  ( 9, 'Cookware',             7),
  (10, 'Sports & Outdoors', NULL),
  (11, 'Fitness',             10),
  (12, 'Camping',             10),
  (13, 'Books',             NULL);

INSERT INTO suppliers (supplier_id, name, country, contact_email) VALUES
  (1, 'TechSource Ltd',          'UK',      'orders@techsource.co.uk'),
  (2, 'GlobalGadgets Inc',       'USA',     'sales@globalgadgets.com'),
  (3, 'Nordic Home AB',          'Sweden',  'hej@nordichome.se'),
  (4, 'Shenzhen Electronics Co', 'China',   NULL),
  (5, 'ActiveGear GmbH',         'Germany', 'vertrieb@activegear.de'),
  (6, 'PageTurner Publishing',   'UK',      'trade@pageturner.co.uk');

-- ---------------------------------------------------------------------
-- Products (37-40 are never ordered; 39 is discontinued)
-- ---------------------------------------------------------------------
INSERT INTO products (product_id, sku, name, category_id, supplier_id, unit_price, cost_price, stock_qty, is_active) VALUES
  ( 1, 'LAP-001', 'UltraBook 14',                 3, 1, 1199.00,  850.00,  25, 1),
  ( 2, 'LAP-002', 'ProBook 16',                   3, 2, 1899.00, 1350.00,  12, 1),
  ( 3, 'LAP-003', 'StudentBook 13',               3, 4,  549.00,  380.00,  40, 1),
  ( 4, 'ACC-001', 'Wireless Mouse',               4, 4,   24.99,    8.50, 300, 1),
  ( 5, 'ACC-002', 'Mechanical Keyboard',          4, 4,   89.99,   41.00, 150, 1),
  ( 6, 'ACC-003', 'USB-C Hub 7-in-1',             4, 4,   39.99,   14.00, 220, 1),
  ( 7, 'ACC-004', '27" 4K Monitor',               4, 2,  329.00,  210.00,  60, 1),
  ( 8, 'ACC-005', 'Laptop Stand',                 4, 1,   34.50,   12.00, 180, 1),
  ( 9, 'PHN-001', 'Pixel Phone X',                5, 2,  799.00,  560.00,  45, 1),
  (10, 'PHN-002', 'Galaxy Nova 5',                5, 4,  699.00,  470.00,  50, 1),
  (11, 'PHN-003', 'Budget Phone A1',              5, 4,  199.00,  120.00, 120, 1),
  (12, 'PHN-004', 'Phone Case Clear',             5, 4,   14.99,    2.50, 500, 1),
  (13, 'AUD-001', 'Noise-Cancelling Headphones',  6, 2,  279.00,  150.00,  70, 1),
  (14, 'AUD-002', 'Wireless Earbuds',             6, 4,  129.00,   60.00, 140, 1),
  (15, 'AUD-003', 'Bluetooth Speaker',            6, 4,   59.99,   25.00,  90, 1),
  (16, 'AUD-004', 'Studio Microphone',            6, 1,  149.00,   85.00,  30, 1),
  (17, 'APL-001', 'Espresso Machine',             8, 3,  449.00,  280.00,  20, 1),
  (18, 'APL-002', 'Air Fryer XL',                 8, 3,  119.00,   65.00,  75, 1),
  (19, 'APL-003', 'Robot Vacuum',                 8, 4,  299.00,  170.00,  35, 1),
  (20, 'APL-004', 'Smart Kettle',                 8, 3,   69.00,   30.00, 110, 1),
  (21, 'CKW-001', 'Cast Iron Skillet',            9, 3,   45.00,   18.00,  95, 1),
  (22, 'CKW-002', 'Non-Stick Pan Set',            9, 3,   89.00,   40.00,  60, 1),
  (23, 'CKW-003', 'Chef''s Knife 8"',             9, 3,   75.00,   28.00,  85, 1),
  (24, 'CKW-004', 'Bamboo Cutting Board',         9, 3,   22.00,    7.00, 200, 1),
  (25, 'FIT-001', 'Yoga Mat Pro',                11, 5,   39.00,   12.00, 160, 1),
  (26, 'FIT-002', 'Adjustable Dumbbells',        11, 5,  249.00,  140.00,  25, 1),
  (27, 'FIT-003', 'Resistance Bands Set',        11, 5,   19.99,    5.00, 260, 1),
  (28, 'FIT-004', 'Fitness Tracker Band',        11, 4,   89.00,   38.00, 130, 1),
  (29, 'CMP-001', '2-Person Tent',               12, 5,  159.00,   80.00,  40, 1),
  (30, 'CMP-002', 'Sleeping Bag -5C',            12, 5,   99.00,   45.00,  55, 1),
  (31, 'CMP-003', 'Camping Stove',               12, 5,   54.00,   22.00,  65, 1),
  (32, 'CMP-004', 'LED Headlamp',                12, 4,   24.00,    7.50, 210, 1),
  (33, 'BK-001',  'SQL for Humans',              13, 6,   34.99,   12.00, 120, 1),
  (34, 'BK-002',  'The Data Warehouse Handbook', 13, 6,   49.99,   18.00,  80, 1),
  (35, 'BK-003',  'Clean Architecture Notes',    13, 6,   29.99,   10.00,  90, 1),
  (36, 'BK-004',  'Mindful Cooking',             13, 6,   24.99,    8.00,  70, 1),
  (37, 'LAP-004', 'Gaming Laptop 17',             3, 2, 2499.00, 1800.00,   5, 1),
  (38, 'AUD-005', 'Vinyl Turntable',              6, 1,  219.00,  120.00,   0, 1),
  (39, 'APL-005', 'Smart Fridge',                 8, 4, 1599.00, 1100.00,   0, 0),
  (40, 'BK-005',  'Advanced Window Functions',   13, 6,   39.99,   14.00, 150, 1);

UPDATE products SET created_at = TIMESTAMP('2022-01-01 09:00:00') + INTERVAL (product_id * 9) DAY WHERE product_id <= 36;
UPDATE products SET created_at = TIMESTAMP('2025-01-15 09:00:00') + INTERVAL (product_id - 37) DAY WHERE product_id > 36;

-- ---------------------------------------------------------------------
-- Customers: 120 generated rows. 111-120 signed up recently and have
-- never ordered (useful for LEFT JOIN / NOT EXISTS exercises).
-- ---------------------------------------------------------------------
INSERT INTO customers (customer_id, first_name, last_name, email, phone, birth_date, city, country, signup_date)
WITH RECURSIVE seq (n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 120
),
names AS (
  SELECT n,
         ELT(1 + MOD(n - 1, 20), 'Aarav','Bella','Carlos','Diana','Ethan','Fatima','George','Hannah','Ivan','Julia',
                                 'Kenji','Laura','Mohammed','Nina','Omar','Priya','Quinn','Rosa','Samuel','Tara') AS first_name,
         ELT(1 + MOD(n * 7, 16), 'Smith','Johnson','Garcia','Brown','Silva','Khan','Nguyen','Rossi',
                                 'Fernando','Perera','Kowalski','Okafor','Dubois','Tanaka','Andersson','O''Brien') AS last_name,
         1 + MOD(n * 5, 12) AS loc
  FROM seq
)
SELECT n,
       first_name,
       last_name,
       LOWER(CONCAT(first_name, '.', REPLACE(last_name, '''', ''), n, '@example.com')),
       CASE WHEN MOD(n, 6) = 0 THEN NULL ELSE CONCAT('555-', LPAD(MOD(n * 7919, 10000), 4, '0')) END,
       DATE('1965-01-01') + INTERVAL MOD(n * 997, 14600) DAY,
       ELT(loc, 'London','Manchester','Colombo','Kandy','New York','Austin','Toronto','Berlin','Paris','Sydney','Mumbai','Singapore'),
       ELT(loc, 'UK','UK','Sri Lanka','Sri Lanka','USA','USA','Canada','Germany','France','Australia','India','Singapore'),
       CASE WHEN n <= 110 THEN DATE('2021-06-01') + INTERVAL MOD(n * 37, 570) DAY
            ELSE DATE('2025-01-01') + INTERVAL (n - 110) * 9 DAY END
FROM names;

-- ---------------------------------------------------------------------
-- Orders: 1,500 orders spread over 2023-01-01 .. 2024-12-31
-- ---------------------------------------------------------------------
INSERT INTO orders (order_id, customer_id, employee_id, order_date, shipped_date, status, ship_city, ship_country)
WITH RECURSIVE seq (n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1500
),
o AS (
  SELECT n,
         1 + MOD(CRC32(CONCAT('cust-', n)), 110) AS customer_id,
         CASE WHEN MOD(n, 9) = 0 THEN NULL ELSE 7 + MOD(n, 7) END AS employee_id,
         TIMESTAMP('2023-01-01 08:00:00')
           + INTERVAL FLOOR((n - 1) * 730 / 1500) DAY
           + INTERVAL MOD(n * 7, 12) HOUR
           + INTERVAL MOD(n * 13, 60) MINUTE AS order_date,
         CASE WHEN n > 1460        THEN 'pending'
              WHEN MOD(n, 23) = 0  THEN 'cancelled'
              WHEN MOD(n, 31) = 0  THEN 'returned'
              WHEN n > 1400        THEN 'shipped'
              ELSE 'delivered' END AS status
  FROM seq
)
SELECT o.n, o.customer_id, o.employee_id, o.order_date,
       CASE WHEN o.status IN ('shipped','delivered','returned')
            THEN DATE(o.order_date) + INTERVAL (1 + MOD(CRC32(CONCAT('ship-', o.n)), 5)) DAY END,
       o.status, c.city, c.country
FROM o
JOIN customers c ON c.customer_id = o.customer_id;

-- ---------------------------------------------------------------------
-- Order items: 1-4 distinct products per order (products 1-36 only)
-- ---------------------------------------------------------------------
INSERT INTO order_items (order_id, product_id, quantity, unit_price, discount)
WITH RECURSIVE k (k) AS (
  SELECT 1 UNION ALL SELECT k + 1 FROM k WHERE k < 4
)
SELECT x.order_id, x.product_id, x.quantity, p.unit_price, x.discount
FROM (
  SELECT o.order_id,
         1 + MOD(CRC32(CONCAT('prod-', o.order_id)) + k.k * 17, 36) AS product_id,
         ELT(1 + MOD(CRC32(CONCAT('qty-', o.order_id, '-', k.k)), 6), 1, 1, 1, 2, 2, 3) AS quantity,
         CASE MOD(CRC32(CONCAT('disc-', o.order_id, '-', k.k)), 10)
              WHEN 0 THEN 0.10 WHEN 1 THEN 0.05 ELSE 0.00 END AS discount
  FROM orders o
  CROSS JOIN k
  WHERE k.k <= 1 + MOD(CRC32(CONCAT('lines-', o.order_id)), 4)
) x
JOIN products p ON p.product_id = x.product_id
ORDER BY x.order_id, x.product_id;

-- ---------------------------------------------------------------------
-- Payments: one per order that was not cancelled and is not pending
-- ---------------------------------------------------------------------
INSERT INTO payments (order_id, payment_date, amount, method)
SELECT o.order_id,
       o.order_date + INTERVAL MOD(o.order_id, 3) DAY + INTERVAL 20 MINUTE,
       ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)), 2),
       ELT(1 + MOD(CRC32(CONCAT('pay-', o.order_id)), 5), 'card', 'card', 'paypal', 'bank_transfer', 'cash')
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status NOT IN ('cancelled', 'pending')
GROUP BY o.order_id, o.order_date
ORDER BY o.order_id;

-- Loyalty tier is derived from lifetime spend
UPDATE customers c
JOIN (
  SELECT o.customer_id, SUM(p.amount) AS spend
  FROM orders o
  JOIN payments p ON p.order_id = o.order_id
  GROUP BY o.customer_id
) s ON s.customer_id = c.customer_id
SET c.loyalty_tier = CASE WHEN s.spend >= 20000 THEN 'Platinum'
                          WHEN s.spend >= 15000 THEN 'Gold'
                          WHEN s.spend >= 10000 THEN 'Silver'
                          ELSE 'Bronze' END;

-- ---------------------------------------------------------------------
-- Product reviews: 500 generated reviews (some without text)
-- ---------------------------------------------------------------------
INSERT INTO product_reviews (product_id, customer_id, rating, review_text, review_date)
WITH RECURSIVE seq (n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 500
),
r AS (
  SELECT n,
         1 + MOD(CRC32(CONCAT('rp-', n)), 36) AS product_id,
         1 + MOD(CRC32(CONCAT('rc-', n)), 110) AS customer_id,
         ELT(1 + MOD(CRC32(CONCAT('rr-', n)), 10), 5, 5, 5, 4, 4, 4, 3, 3, 2, 1) AS rating
  FROM seq
)
SELECT product_id, customer_id, rating,
       CASE WHEN MOD(n, 7) = 0 THEN NULL
            ELSE ELT(rating,
                     'Terrible - stopped working after a week.',
                     'Disappointing quality for the price.',
                     'Average. It does the job.',
                     'Very good value for money.',
                     'Excellent! Highly recommend it.') END,
       DATE('2023-02-01') + INTERVAL MOD(CRC32(CONCAT('rd-', n)), 700) DAY
FROM r
ORDER BY n;

-- ---------------------------------------------------------------------
-- Legacy spreadsheet import (for the normalisation lessons)
-- Note Nimal Perera: different city/phones on different invoices -> update anomaly
-- ---------------------------------------------------------------------
INSERT INTO legacy_sales
  (invoice_no, invoice_date, customer_name, customer_email, customer_phones, customer_city,
   product_name, product_category, qty, unit_price, sales_rep, sales_rep_office) VALUES
  (1001, '2019-04-02', 'Nimal Perera', 'nimal@example.lk',       '0771234567, 0112233445', 'Colombo', 'UltraBook 14',         'Laptops',     1, 1150.00, 'Ava Robinson', 'London'),
  (1001, '2019-04-02', 'Nimal Perera', 'nimal@example.lk',       '0771234567, 0112233445', 'Colombo', 'Wireless Mouse',       'Accessories', 2,   22.00, 'Ava Robinson', 'London'),
  (1002, '2019-04-05', 'Sarah Jones',  'sarah.j@example.co.uk',  '07700900123',            'Leeds',   'Espresso Machine',     'Appliances',  1,  420.00, 'Mason Clarke', 'London'),
  (1002, '2019-04-05', 'Sarah Jones',  'sarah.j@example.co.uk',  '07700900123',            'Leeds',   'Chef''s Knife 8"',     'Cookware',    1,   70.00, 'Mason Clarke', 'London'),
  (1003, '2019-04-09', 'Nimal Perera', 'nimal@example.lk',       '0771234567, 0112233445', 'Colombo', 'SQL for Humans',       'Books',       3,   30.00, 'Mason Clarke', 'London'),
  (1004, '2019-04-11', 'Tom Becker',   'tom.becker@example.de',  NULL,                     'Berlin',  'Yoga Mat Pro',         'Fitness',     2,   35.00, 'Isla Wright',  'London'),
  (1004, '2019-04-11', 'Tom Becker',   'tom.becker@example.de',  NULL,                     'Berlin',  'Resistance Bands Set', 'Fitness',     1,   18.00, 'Isla Wright',  'London'),
  (1004, '2019-04-11', 'Tom Becker',   'tom.becker@example.de',  NULL,                     'Berlin',  'LED Headlamp',         'Camping',     4,   20.00, 'Isla Wright',  'London'),
  (1005, '2019-05-01', 'Sarah Jones',  'sarah.j@example.co.uk',  '07700900123',            'Leeds',   'Air Fryer XL',         'Appliances',  1,  110.00, 'Mason Clarke', 'London'),
  (1006, '2019-05-03', 'Nimal Perera', 'nimal@example.lk',       '0771234567',             'Kandy',   'Wireless Earbuds',     'Audio',       1,  120.00, 'Isla Wright',  'London'),
  (1006, '2019-05-03', 'Nimal Perera', 'nimal@example.lk',       '0771234567',             'Kandy',   'Phone Case Clear',     'Phones',      2,   12.00, 'Isla Wright',  'London'),
  (1007, '2019-05-10', 'Aiko Tanaka',  'aiko.t@example.jp',      '090-1234-5678',          'Tokyo',   'ProBook 16',           'Laptops',     1, 1799.00, 'Ava Robinson', 'London'),
  (1007, '2019-05-10', 'Aiko Tanaka',  'aiko.t@example.jp',      '090-1234-5678',          'Tokyo',   'USB-C Hub 7-in-1',     'Accessories', 1,   35.00, 'Ava Robinson', 'London'),
  (1008, '2019-05-18', 'Tom Becker',   'tom.becker@example.de',  '030 1234567',            'Berlin',  'Camping Stove',        'Camping',     1,   50.00, 'Mason Clarke', 'London');

-- =====================================================================
-- 10 - Schema for "ShopCo", a small online retailer
--
--   departments 1---* employees (self-referencing manager_id)
--   categories  (self-referencing parent_category_id -> tree)
--   suppliers   1---* products *---1 categories
--   customers   1---* orders *---1 employees (sales rep, optional)
--   orders      1---* order_items *---1 products
--   orders      1---* payments
--   products    1---* product_reviews *---1 customers
--   web_events  (200k rows, deliberately un-indexed -> performance lab)
--   legacy_sales (deliberately denormalised -> normalisation lab)
-- =====================================================================

DROP DATABASE IF EXISTS shopdb;
CREATE DATABASE shopdb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE shopdb;

CREATE TABLE departments (
  department_id INT           NOT NULL AUTO_INCREMENT,
  name          VARCHAR(50)   NOT NULL,
  location      VARCHAR(50)   NOT NULL,
  budget        DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (department_id),
  UNIQUE KEY uq_departments_name (name),
  CONSTRAINT chk_departments_budget CHECK (budget >= 0)
);

CREATE TABLE employees (
  employee_id    INT           NOT NULL AUTO_INCREMENT,
  first_name     VARCHAR(50)   NOT NULL,
  last_name      VARCHAR(50)   NOT NULL,
  email          VARCHAR(100)  NOT NULL,
  job_title      VARCHAR(80)   NOT NULL,
  department_id  INT           NULL,
  manager_id     INT           NULL,
  hire_date      DATE          NOT NULL,
  salary         DECIMAL(10,2) NOT NULL,
  commission_pct DECIMAL(4,2)  NULL,
  PRIMARY KEY (employee_id),
  UNIQUE KEY uq_employees_email (email),
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments (department_id),
  CONSTRAINT fk_employees_manager    FOREIGN KEY (manager_id)    REFERENCES employees (employee_id),
  CONSTRAINT chk_employees_salary CHECK (salary > 0)
);

CREATE TABLE categories (
  category_id        INT         NOT NULL AUTO_INCREMENT,
  name               VARCHAR(50) NOT NULL,
  parent_category_id INT         NULL,
  PRIMARY KEY (category_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_category_id) REFERENCES categories (category_id)
);

CREATE TABLE suppliers (
  supplier_id   INT          NOT NULL AUTO_INCREMENT,
  name          VARCHAR(80)  NOT NULL,
  country       VARCHAR(50)  NOT NULL,
  contact_email VARCHAR(100) NULL,
  PRIMARY KEY (supplier_id)
);

CREATE TABLE products (
  product_id  INT           NOT NULL AUTO_INCREMENT,
  sku         VARCHAR(20)   NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  category_id INT           NOT NULL,
  supplier_id INT           NULL,
  unit_price  DECIMAL(10,2) NOT NULL,
  cost_price  DECIMAL(10,2) NOT NULL,
  stock_qty   INT           NOT NULL DEFAULT 0,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  UNIQUE KEY uq_products_sku (sku),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (category_id),
  CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (supplier_id),
  CONSTRAINT chk_products_price CHECK (unit_price >= 0 AND cost_price >= 0),
  CONSTRAINT chk_products_stock CHECK (stock_qty >= 0)
);

CREATE TABLE customers (
  customer_id  INT          NOT NULL AUTO_INCREMENT,
  first_name   VARCHAR(50)  NOT NULL,
  last_name    VARCHAR(50)  NOT NULL,
  email        VARCHAR(100) NOT NULL,
  phone        VARCHAR(20)  NULL,
  birth_date   DATE         NULL,
  city         VARCHAR(50)  NOT NULL,
  country      VARCHAR(50)  NOT NULL,
  signup_date  DATE         NOT NULL,
  loyalty_tier ENUM('Bronze','Silver','Gold','Platinum') NOT NULL DEFAULT 'Bronze',
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customers_email (email)
);

CREATE TABLE orders (
  order_id     INT         NOT NULL AUTO_INCREMENT,
  customer_id  INT         NOT NULL,
  employee_id  INT         NULL COMMENT 'Sales rep; NULL = self-service web order',
  order_date   DATETIME    NOT NULL,
  shipped_date DATE        NULL,
  status       ENUM('pending','shipped','delivered','cancelled','returned') NOT NULL DEFAULT 'pending',
  ship_city    VARCHAR(50) NOT NULL,
  ship_country VARCHAR(50) NOT NULL,
  PRIMARY KEY (order_id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
  CONSTRAINT fk_orders_employee FOREIGN KEY (employee_id) REFERENCES employees (employee_id)
);

CREATE TABLE order_items (
  order_item_id INT           NOT NULL AUTO_INCREMENT,
  order_id      INT           NOT NULL,
  product_id    INT           NOT NULL,
  quantity      INT           NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL COMMENT 'Price at time of sale',
  discount      DECIMAL(4,2)  NOT NULL DEFAULT 0.00 COMMENT '0.10 = 10% off',
  PRIMARY KEY (order_item_id),
  UNIQUE KEY uq_order_items_order_product (order_id, product_id),
  CONSTRAINT fk_order_items_order   FOREIGN KEY (order_id)   REFERENCES orders (order_id),
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (product_id),
  CONSTRAINT chk_order_items_qty CHECK (quantity > 0),
  CONSTRAINT chk_order_items_discount CHECK (discount BETWEEN 0 AND 1)
);

CREATE TABLE payments (
  payment_id   INT           NOT NULL AUTO_INCREMENT,
  order_id     INT           NOT NULL,
  payment_date DATETIME      NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  method       ENUM('card','paypal','bank_transfer','cash') NOT NULL,
  PRIMARY KEY (payment_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE TABLE product_reviews (
  review_id   INT          NOT NULL AUTO_INCREMENT,
  product_id  INT          NOT NULL,
  customer_id INT          NOT NULL,
  rating      TINYINT      NOT NULL,
  review_text VARCHAR(255) NULL,
  review_date DATE         NOT NULL,
  PRIMARY KEY (review_id),
  CONSTRAINT fk_reviews_product  FOREIGN KEY (product_id)  REFERENCES products (product_id),
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES customers (customer_id),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
);

-- Clickstream table: intentionally has ONLY a primary key so you can
-- practise adding indexes and compare EXPLAIN plans before/after.
CREATE TABLE web_events (
  event_id    BIGINT       NOT NULL AUTO_INCREMENT,
  customer_id INT          NULL COMMENT 'NULL = anonymous visitor',
  session_id  VARCHAR(20)  NOT NULL,
  event_type  VARCHAR(20)  NOT NULL,
  page_url    VARCHAR(200) NOT NULL,
  device      VARCHAR(10)  NOT NULL,
  event_time  DATETIME     NOT NULL,
  PRIMARY KEY (event_id)
);

-- A spreadsheet export from the old system. Intentionally BAD design:
-- repeating customer data, comma-separated phone numbers (breaks 1NF),
-- product/category/rep facts repeated on every line (breaks 2NF/3NF).
CREATE TABLE legacy_sales (
  line_id          INT           NOT NULL AUTO_INCREMENT,
  invoice_no       INT           NOT NULL,
  invoice_date     DATE          NOT NULL,
  customer_name    VARCHAR(100)  NOT NULL,
  customer_email   VARCHAR(100)  NOT NULL,
  customer_phones  VARCHAR(100)  NULL,
  customer_city    VARCHAR(50)   NOT NULL,
  product_name     VARCHAR(100)  NOT NULL,
  product_category VARCHAR(50)   NOT NULL,
  qty              INT           NOT NULL,
  unit_price       DECIMAL(10,2) NOT NULL,
  sales_rep        VARCHAR(100)  NOT NULL,
  sales_rep_office VARCHAR(50)   NOT NULL,
  PRIMARY KEY (line_id)
);

-- =====================================================================
-- 50 - playground database: your scratch space for DDL, transactions
-- and security experiments. Break it freely - "Reset" rebuilds it.
-- =====================================================================
DROP DATABASE IF EXISTS playground;
CREATE DATABASE playground CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE playground;

-- Bank accounts for the transactions lessons (no CHECK constraint on purpose)
CREATE TABLE accounts (
  account_id INT           NOT NULL PRIMARY KEY,
  owner      VARCHAR(50)   NOT NULL,
  balance    DECIMAL(12,2) NOT NULL
);

INSERT INTO accounts (account_id, owner, balance) VALUES
  (1, 'Alice',   1000.00),
  (2, 'Bob',      500.00),
  (3, 'Charlie', 2500.00),
  (4, 'Dana',       0.00);

CREATE TABLE transfers (
  transfer_id    INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  from_account   INT           NOT NULL,
  to_account     INT           NOT NULL,
  amount         DECIMAL(12,2) NOT NULL,
  transferred_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users table for the SQL-injection lesson (passwords stored as SHA2 hashes)
CREATE TABLE app_users (
  user_id       INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash CHAR(64)     NOT NULL,
  is_admin      TINYINT(1)   NOT NULL DEFAULT 0
);

INSERT INTO app_users (username, password_hash, is_admin) VALUES
  ('admin', SHA2('S3cure!Admin', 256), 1),
  ('alice', SHA2('wonderland', 256),   0),
  ('bob',   SHA2('builder123', 256),   0);

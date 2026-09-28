-- =====================================================================
-- 40 - Demo view, stored procedure and function (read these as examples!)
-- DELIMITER is a *client* command: it tells the mysql CLI (and the
-- learning app) where a statement ends, so the ';' inside BEGIN...END
-- blocks are not treated as the end of CREATE PROCEDURE.
-- =====================================================================
USE shopdb;

-- A view: a saved SELECT you can query like a table
CREATE OR REPLACE VIEW v_order_summary AS
SELECT o.order_id,
       o.order_date,
       o.status,
       o.customer_id,
       CONCAT(c.first_name, ' ', c.last_name)                          AS customer_name,
       COUNT(oi.order_item_id)                                         AS line_count,
       ROUND(SUM(oi.quantity * oi.unit_price * (1 - oi.discount)), 2)  AS order_total
FROM orders o
JOIN customers   c  ON c.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
GROUP BY o.order_id, o.order_date, o.status, o.customer_id, c.first_name, c.last_name;

DROP PROCEDURE IF EXISTS sp_customer_summary;
DROP FUNCTION  IF EXISTS fn_price_with_tax;

DELIMITER $$

-- Usage: CALL sp_customer_summary(42);
CREATE PROCEDURE sp_customer_summary(IN p_customer_id INT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_id = p_customer_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer not found';
  END IF;

  SELECT c.customer_id,
         CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
         c.loyalty_tier,
         COUNT(o.order_id)                      AS orders_placed,
         MIN(o.order_date)                      AS first_order,
         MAX(o.order_date)                      AS last_order
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.customer_id
  WHERE c.customer_id = p_customer_id
  GROUP BY c.customer_id, c.first_name, c.last_name, c.loyalty_tier;
END$$

-- Usage: SELECT name, unit_price, fn_price_with_tax(unit_price, 0.20) FROM products;
CREATE FUNCTION fn_price_with_tax(p_price DECIMAL(10,2), p_rate DECIMAL(4,2))
RETURNS DECIMAL(10,2)
DETERMINISTIC
NO SQL
BEGIN
  RETURN ROUND(p_price * (1 + p_rate), 2);
END$$

DELIMITER ;

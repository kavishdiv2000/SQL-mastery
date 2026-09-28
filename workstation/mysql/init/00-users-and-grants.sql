-- =====================================================================
-- 00 - Users & grants (runs once, as root, on first container start)
-- The 'learner' user is created by the MySQL image (MYSQL_USER).
-- Here we give it rights on the two practice databases plus the few
-- global privileges needed for the security / administration lessons.
-- NOTE: the learning app's "Reset database" skips files starting with 00-
-- =====================================================================

CREATE DATABASE IF NOT EXISTS shopdb     CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS playground CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

GRANT ALL PRIVILEGES ON `shopdb`.*     TO 'learner'@'%' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON `playground`.* TO 'learner'@'%' WITH GRANT OPTION;

-- Needed for the security module (users, roles) and SHOW PROCESSLIST
GRANT CREATE USER, CREATE ROLE, DROP ROLE, PROCESS, SHOW DATABASES ON *.* TO 'learner'@'%';
GRANT ROLE_ADMIN ON *.* TO 'learner'@'%';

-- Lets the learner inspect grants stored in the system schema (mysql.user, mysql.db ...)
GRANT SELECT ON `mysql`.* TO 'learner'@'%';

FLUSH PRIVILEGES;

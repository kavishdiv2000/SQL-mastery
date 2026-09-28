#!/usr/bin/env bash
# Dumps shopdb and playground (with routines, triggers, views) to workstation/backups/.
source "$(dirname "$0")/scripts/lib.sh"

assert_docker
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups
docker exec -e "MYSQL_PWD=$(env_value MYSQL_ROOT_PASSWORD rootpass)" sqlm-mysql \
  mysqldump -uroot --routines --triggers --events --single-transaction --databases shopdb playground \
  > "backups/backup-$stamp.sql"
echo "Backup written to backups/backup-$stamp.sql"
echo "Restore with: ./restore.sh backups/backup-$stamp.sql"

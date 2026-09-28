#!/usr/bin/env bash
# Restores a .sql dump into the workstation MySQL:  ./restore.sh backups/backup-XXXX.sql
source "$(dirname "$0")/scripts/lib.sh"

[ $# -eq 1 ] || { echo "Usage: $0 <dump.sql>" >&2; exit 1; }
assert_docker
docker exec -i -e "MYSQL_PWD=$(env_value MYSQL_ROOT_PASSWORD rootpass)" sqlm-mysql mysql -uroot < "$1"
echo "Restored $1"

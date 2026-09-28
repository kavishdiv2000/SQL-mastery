#!/usr/bin/env bash
# Opens the mysql client inside the container.
#   ./mysql-cli.sh               -> learner @ shopdb
#   ./mysql-cli.sh playground    -> learner @ playground
#   ./mysql-cli.sh --root        -> root @ shopdb
source "$(dirname "$0")/scripts/lib.sh"

assert_docker
user=learner; pw="$(env_value MYSQL_PASSWORD learnerpass)"; db=shopdb
for arg in "$@"; do
  case "$arg" in
    --root) user=root; pw="$(env_value MYSQL_ROOT_PASSWORD rootpass)" ;;
    *) db="$arg" ;;
  esac
done
docker exec -it -e "MYSQL_PWD=$pw" sqlm-mysql mysql "-u$user" --default-character-set=utf8mb4 "$db"

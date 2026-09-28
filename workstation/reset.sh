#!/usr/bin/env bash
# Wipes the MySQL data volume and re-seeds everything. Pass --force to skip the prompt.
source "$(dirname "$0")/scripts/lib.sh"

assert_docker
if [ "${1:-}" != "--force" ]; then
  read -r -p "This deletes ALL data in the workstation database (including your own tables). Type YES to continue: " answer
  [ "$answer" = "YES" ] || { echo "Cancelled."; exit 0; }
fi

init_env_file
docker compose down -v
docker compose up -d --build
wait_for_mysql && show_urls

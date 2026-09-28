#!/usr/bin/env bash
# Builds and starts the SQL Mastery workstation (MySQL + Adminer + learning app).
source "$(dirname "$0")/scripts/lib.sh"

assert_docker
init_env_file
docker compose up -d --build
wait_for_mysql && show_urls

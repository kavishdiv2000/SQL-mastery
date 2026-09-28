#!/usr/bin/env bash
# Stops the workstation (data is kept). Pass --remove to also remove the containers.
source "$(dirname "$0")/scripts/lib.sh"

assert_docker
if [ "${1:-}" = "--remove" ]; then docker compose down; else docker compose stop; fi

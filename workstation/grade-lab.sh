#!/usr/bin/env bash
# Auto-grades lab/answer-sheet.sql (or another file in lab/) against the live database.
#   ./grade-lab.sh
#   ./grade-lab.sh my-attempt-2.sql
source "$(dirname "$0")/scripts/lib.sh"

assert_docker
docker exec sqlm-app node scripts/grade-lab.js "/content/lab/${1:-answer-sheet.sql}"

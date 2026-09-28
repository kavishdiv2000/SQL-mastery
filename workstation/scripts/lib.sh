# Shared helpers for the bash workstation scripts (sourced).
set -euo pipefail
# Git Bash on Windows rewrites arguments like /content/lab/... into Windows paths;
# container paths must be passed through untouched. (No effect on Linux/macOS.)
export MSYS_NO_PATHCONV=1
WORKSTATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WORKSTATION_DIR"

assert_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker was not found. Install Docker: https://docs.docker.com/get-docker/" >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but not running. Start it and try again." >&2
    exit 1
  fi
}

init_env_file() {
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  fi
}

env_value() { # env_value NAME DEFAULT
  local v=""
  if [ -f .env ]; then
    v="$(grep -E "^\s*$1\s*=" .env | tail -n1 | cut -d= -f2- | tr -d '\r' | xargs || true)"
  fi
  echo "${v:-$2}"
}

wait_for_mysql() {
  printf "Waiting for MySQL to become healthy (the first start seeds ~210k rows and takes 1-3 minutes)"
  local status="" i
  for i in $(seq 1 120); do
    sleep 3
    printf "."
    status="$(docker inspect -f '{{.State.Health.Status}}' sqlm-mysql 2>/dev/null || true)"
    [ "$status" = "healthy" ] && break
  done
  echo
  if [ "$status" != "healthy" ]; then
    echo "MySQL is not healthy yet (status: $status). Check the logs with: docker logs sqlm-mysql" >&2
    return 1
  fi
}

show_urls() {
  local pw; pw="$(env_value MYSQL_PASSWORD learnerpass)"
  echo
  echo "SQL Mastery workstation is ready"
  echo "  Learning app : http://localhost:$(env_value APP_PORT 3000)"
  echo "  Adminer GUI  : http://localhost:$(env_value ADMINER_PORT 8081)   (server: mysql, user: learner, password: $pw)"
  echo "  MySQL        : localhost:$(env_value MYSQL_PORT 3306)            (user: learner, password: $pw, database: shopdb)"
  echo
}

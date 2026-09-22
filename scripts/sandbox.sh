#!/bin/sh
# Prepares the volumes the way the integration does inside Gladys, then runs
# docker compose with the sandbox file. Usage: ./scripts/sandbox.sh up|down|logs
set -e
cd "$(dirname "$0")/.."

mkdir -p sandbox-data/containers/mealie/app/data sandbox-data/containers/bonap/data
# Same as prepareMealieDataDir(): Mealie runs as capability-less root.
chmod 777 sandbox-data/containers/mealie/app/data

case "${1:-up}" in
  up) docker compose -f docker-compose.sandbox.yml up -d --build mealie && echo "Mealie: http://localhost:9000 (changeme@example.com / MyPassword), create an API token in Profile" ;;
  bonap) docker compose -f docker-compose.sandbox.yml up -d --build bonap && echo "Bonap: http://localhost:8080" ;;
  down) docker compose -f docker-compose.sandbox.yml down ;;
  logs) docker compose -f docker-compose.sandbox.yml logs -f ;;
  *) echo "usage: $0 up|bonap|down|logs" && exit 1 ;;
esac

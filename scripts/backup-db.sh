#!/bin/bash
set -e
source .env

BACKUP_PATH="${BACKUP_DIR}/db_backup_$(date +%F_%H-%M-%S).sql"
mkdir -p $(dirname "${BACKUP_PATH}")

echo "Backing up Airport PostgreSQL database to ${BACKUP_PATH}..."
docker exec -t airport-postgres pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > "${BACKUP_PATH}"
echo "PostgreSQL backup completed successfully."

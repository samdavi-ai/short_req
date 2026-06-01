#!/bin/bash
set -e
source .env

if [ -z "$1" ]; then
    echo "Usage: ./scripts/restore-db.sh <backup_file_path>"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Backup file ${BACKUP_FILE} not found."
    exit 1
fi

echo "Restoring PostgreSQL database from ${BACKUP_FILE}..."
docker exec -i airport-postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < "${BACKUP_FILE}"
echo "Database restored successfully."

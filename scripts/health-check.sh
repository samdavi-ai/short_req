#!/bin/bash
echo "=== System Health Status ==="

check_container() {
    NAME=$1
    STATUS=$(docker inspect -f '{{.State.Status}}' $NAME 2>/dev/null || echo "not found")
    if [ "$STATUS" = "running" ]; then
        echo -e "   [OK]  $NAME is running"
    else
        echo -e "   [ERR] $NAME is $STATUS"
    fi
}

echo "Checking core services..."
check_container airport-postgres
check_container airport-redis
check_container milvus-etcd
check_container milvus-minio
check_container airport-milvus
check_container airport-backend
check_container airport-celery
check_container airport-frontend
check_container airport-video-processor

echo "=== Check complete ==="

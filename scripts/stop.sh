#!/bin/bash
echo "Shutting down all Airport Security Surveillance System containers..."

# Include all files to ensure complete teardown
docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.monitoring.yml down --remove-orphans

echo "Shutdown complete."

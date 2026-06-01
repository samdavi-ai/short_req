#!/bin/bash
set -e

echo "Starting Airport Security Surveillance System..."

# Determine mode
GPU_FLAG=""
if [ -f "docker-compose.gpu.yml" ] && [ "$1" != "--cpu" ]; then
    if command -v nvidia-smi &> /dev/null; then
        echo "NVIDIA GPU detected. Launching in GPU-accelerated mode..."
        GPU_FLAG="-f docker-compose.yml -f docker-compose.gpu.yml"
    else
        echo "No NVIDIA GPU detected or driver missing. Use ./scripts/start.sh --cpu to force CPU."
        echo "Defaulting to standard CPU mode..."
        GPU_FLAG="-f docker-compose.yml"
    fi
else
    echo "Launching in CPU-only mode..."
    GPU_FLAG="-f docker-compose.yml"
fi

# Optional monitoring
MONITORING_FLAG=""
if [ "$2" == "--monitoring" ] || [ "$1" == "--monitoring" ]; then
    echo "Including Monitoring stack (Prometheus & Grafana)..."
    MONITORING_FLAG="-f docker-compose.monitoring.yml"
fi

docker compose $GPU_FLAG $MONITORING_FLAG up -d

echo "Services started! You can check the dashboard at http://localhost"
echo "API backend docs are available at http://localhost:8000/docs"

#!/bin/bash
set -e

echo "=== System Setup for Airport Security Intelligent Surveillance & Tracking ==="

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN"
esac

echo "Detected OS: ${MACHINE}"

if [ "${MACHINE}" = "Linux" ]; then
    echo "Updating package list..."
    sudo apt-get update -y
    
    echo "Checking Docker..."
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
    else
        echo "Docker is already installed."
    fi

    echo "Checking NVIDIA Container Toolkit..."
    if dpkg -l | grep -q nvidia-container-toolkit; then
        echo "NVIDIA Container Toolkit is installed."
    else
        echo "NVIDIA Container Toolkit not found. Please install it to use GPU acceleration:"
        echo "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html"
    fi
elif [ "${MACHINE}" = "Mac" ]; then
    echo "Checking Docker Desktop..."
    if ! command -v docker &> /dev/null; then
        echo "Docker not found. Please install Docker Desktop for Mac."
    else
        echo "Docker is installed."
    fi
fi

# Create standard shared directories
mkdir -p backend/assets/crops backend/assets/alerts backend/assets/layouts
mkdir -p models config/prometheus config/grafana/provisioning config/grafana/dashboards config/nginx config/redis config/postgresql config/milvus scripts docs tests/unit tests/integration tests/e2e tests/load

echo "Local environment setup complete! Please check .env and models/README.md next."

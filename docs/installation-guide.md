# Installation and Deployment Guide

This system runs completely locally on a dedicated workstation or server utilizing **Docker Compose**.

## Hardware Requirements
- **CPU**: Intel Core i7/i9 or AMD Ryzen 7/9 (minimum 8 cores)
- **RAM**: 32 GB minimum
- **Storage**: 1 TB NVMe SSD
- **GPU**: NVIDIA RTX 3080/3090, RTX 4080/4090 (minimum 12 GB VRAM)
- **OS**: Ubuntu 22.04 LTS (Recommended) or macOS (CPU-only test mode)

## Quick Start
1. Setup environment: `./scripts/setup-local.sh`
2. Configure `.env`
3. Download weights: `./scripts/download-models.sh`
4. Start stack: `make start-gpu`

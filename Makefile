# Makefile for Airport Security Surveillance System

.PHONY: setup start start-gpu start-monitoring stop restart logs ps clean test download-models generate-trt status

# Setup environment
setup:
	cp -n .env.example .env || true
	./scripts/setup-local.sh

# Start CPU-only mode
start:
	docker compose up -d

# Start GPU-accelerated mode
start-gpu:
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# Start with Monitoring
start-monitoring:
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.monitoring.yml up -d

# Stop all services
stop:
	docker compose -f docker-compose.yml -f docker-compose.gpu.yml -f docker-compose.monitoring.yml down --remove-orphans

# Restart services
restart: stop start-gpu

# View service logs
logs:
	docker compose logs -f

# View running container status
ps:
	docker compose ps

# System status check
status:
	./scripts/health-check.sh

# Clean docker volumes and caches
clean:
	docker compose down -v --remove-orphans
	docker system prune -f

# Run tests
test:
	docker compose exec backend pytest tests/unit

# Download models
download-models:
	./scripts/download-models.sh

# Compile TensorRT engines
generate-trt:
	./scripts/generate-trt-engines.sh

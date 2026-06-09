FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Set non-interactive to avoid timezone prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY processing/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY processing/ .
COPY backend/app ./app

# Run the camera pipeline coordinator as the main entrypoint
CMD ["python3", "-m", "pipeline.camera_pipeline"]

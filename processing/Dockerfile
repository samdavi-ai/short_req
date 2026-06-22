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
RUN pip3 install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
RUN pip3 install --no-cache-dir insightface --no-deps

# Copy local pre-downloaded models to bypass slow downloads during build
COPY processing/models /root/.insightface/models
COPY processing/checkpoints /root/.cache/torch/hub/checkpoints

# Initialize FaceAnalysis, ResNet50, and MobileNetV3 to pre-warm the model caching
RUN python3 -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_l')" \
    && python3 -c "from torchvision.models import resnet50, ResNet50_Weights; resnet50(weights=ResNet50_Weights.IMAGENET1K_V1)" \
    && python3 -c "from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights; mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1)"

COPY processing/ .
COPY backend/app ./app

# Run the camera pipeline coordinator as the main entrypoint
CMD ["python3", "-m", "pipeline.pipeline_manager"]

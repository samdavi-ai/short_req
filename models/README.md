# Models Configuration & Download Links

In a fully functional deployment, replace these stubs with the real models:

1. **YOLOv8l (ONNX)**: Custom trained on airport CCTV datasets for head and person detection.
   - Source: `https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8l.onnx`
2. **SCRFD Face Detector (ONNX)**: Robust facing & head orientation camera detector.
   - Source: InsightFace SCRFD model zoo
3. **ArcFace Face Embedder (ONNX)**: ResNet100 model trained on MS1MV3.
   - Source: InsightFace ArcFace
4. **TransReID (ONNX)**: Transformer-based Body ReID model optimized for top-down perspective cameras.
5. **Head-Top EfficientNet (ONNX)**: Custom classification model using clothing color and hair/head patterns for head-down overhead viewpoints.

To download the actual files for security clearance, run the official secure download script with your keys.

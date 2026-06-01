import onnxruntime as ort
import numpy as np

class ONNXRuntimeSession:
    def __init__(self, model_path: str, use_gpu: bool = False):
        self.model_path = model_path
        self.use_gpu = use_gpu
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if use_gpu else ['CPUExecutionProvider']
        
        try:
            self.session = ort.InferenceSession(model_path, providers=providers)
        except Exception:
            # Stub session since ONNX files might be placeholders
            self.session = None
            print(f"Warning: ONNX placeholder model stub initialized for {model_path}")
            
    def run_inference(self, blob: np.ndarray):
        if not self.session:
            return []
        input_name = self.session.get_inputs()[0].name
        return self.session.run(None, {input_name: blob})

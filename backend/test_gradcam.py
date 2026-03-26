import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from app.models import chest_ct
from app.utils.explainability import compute_gradcam
import logging

logging.basicConfig(level=logging.INFO)

chest_ct.load()
model = chest_ct._model
img = np.random.rand(1, 224, 224, 3).astype(np.float32)

print("Running Grad-CAM...")
res = compute_gradcam(model, img)
if res:
    print("Grad-CAM succeeded, base64 length:", len(res))
    import base64
    with open("test_heatmap.png", "wb") as f:
        f.write(base64.b64decode(res))
    print("Saved to test_heatmap.png")
else:
    print("Grad-CAM failed or returned empty.")


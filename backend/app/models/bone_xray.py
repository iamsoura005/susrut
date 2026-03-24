"""
Bone X-Ray fracture detection module.
Model: bone_xray_model.h5 (EfficientNetB0, trained via build_models.py)
Classes: fractured | normal
"""
import logging
from pathlib import Path

import numpy as np

from app.preprocessing.image_utils import load_image_as_array
from app.utils.explainability import compute_gradcam
from app.utils.uncertainty import entropy_uncertainty
from app.utils.calibration import calibrate_result

logger = logging.getLogger("radiai.bone_xray")

MODEL_PATH = Path(__file__).parent.parent.parent.parent / "bone_xray_model.h5"
# alphabetical order (ImageDataGenerator / image_dataset_from_directory)
CLASSES = ["fractured", "normal"]

_model = None
_input_size = (224, 224)


def load():
    global _model, _input_size
    if MODEL_PATH.exists():
        try:
            import tensorflow as tf
            _model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
            shape = _model.input_shape
            _input_size = (int(shape[1]), int(shape[2]))
            logger.info(f"✅ BoneXray model loaded — input size: {_input_size}")
        except Exception as e:
            logger.error(f"Failed to load BoneXray model: {e}")
    else:
        logger.warning("⚠️  bone_xray_model.h5 not found — run build_models.py to generate it")


def predict(file_bytes: bytes) -> dict:
    if _model is None:
        return _stub_result()

    img_array = load_image_as_array(file_bytes, target_size=_input_size)

    try:
        raw_probs  = _model.predict(img_array, verbose=0)[0]
        cal        = calibrate_result(raw_probs)
        probs      = cal["probs"]
        pred_idx   = int(np.argmax(probs))
        pred_label = CLASSES[pred_idx]
        confidence = cal["confidence"]
        uncertainty = entropy_uncertainty(probs)
        heatmap_b64 = compute_gradcam(_model, img_array, pred_index=pred_idx)
        severity = _severity(pred_label, confidence)

        return {
            "modality": "bone_xray",
            "prediction": pred_label.replace("_", " ").title(),
            "confidence": round(confidence, 4),
            "class_probabilities": {
                c.replace("_", " ").title(): round(float(p), 4)
                for c, p in zip(CLASSES, probs)
            },
            "severity": severity,
            "uncertainty": uncertainty,
            "calibrated": True,
            "calibration_temperature": cal["temperature"],
            "explainability": {
                "type": "gradcam_overlay",
                "image_b64": heatmap_b64,
                "description": "Grad-CAM heatmap highlighting fracture-relevant regions",
            },
            "stub": False,
        }
    except Exception as e:
        logger.error(f"BoneXray inference error: {e}")
        return {"error": str(e), "modality": "bone_xray", "stub": False}


def _severity(label: str, confidence: float) -> dict:
    if label == "fractured":
        level = "High" if confidence > 0.75 else "Medium"
        score = 0.80 * confidence
        desc = f"Bone fracture detected with {confidence:.0%} confidence. Clinical review advised."
    else:
        level, score = "Low", 0.05
        desc = "No fracture detected in this X-ray."
    return {"level": level, "score": round(score, 3), "description": desc}


def _stub_result() -> dict:
    return {
        "modality": "bone_xray",
        "prediction": "Unknown",
        "confidence": 0.0,
        "class_probabilities": {"Fractured": 0.5, "Normal": 0.5},
        "severity": {"level": "Unknown", "score": 0.0, "description": "Model weights not loaded."},
        "uncertainty": {"is_uncertain": True, "flag": "Model not loaded", "normalized_entropy": 1.0},
        "explainability": {"type": "none", "image_b64": "", "description": "Model unavailable"},
        "stub": True,
        "todo": "Run build_models.py in the project root to train and generate bone_xray_model.h5",
    }

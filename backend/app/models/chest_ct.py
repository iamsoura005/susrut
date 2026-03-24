"""
Chest CT classification module.
Model: BEST_MODEL_EfficientNetB3_ChestCT.h5 (Keras EfficientNetB3)
"""
import logging
from pathlib import Path

import numpy as np

from app.preprocessing.image_utils import load_image_as_array
from app.utils.explainability import compute_gradcam
from app.utils.uncertainty import entropy_uncertainty
from app.utils.calibration import calibrate_result

logger = logging.getLogger("radiai.chest_ct")

MODEL_PATH = Path(__file__).parent.parent.parent.parent / "BEST_MODEL_EfficientNetB3_ChestCT.h5"
# EfficientNetB3 default input size
CLASSES = ["COVID-19", "Lung Opacity", "Normal", "Viral Pneumonia"]

_model = None
_input_size = (224, 224)  # updated after load from model.input_shape


def load():
    global _model, _input_size
    try:
        import tensorflow as tf
        if MODEL_PATH.exists():
            _model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
            shape = _model.input_shape
            _input_size = (int(shape[1]), int(shape[2]))
            logger.info(f"✅ ChestCT model loaded — input size: {_input_size}")
        else:
            logger.warning(f"⚠️  ChestCT model not found at {MODEL_PATH}")
    except Exception as e:
        logger.error(f"Failed to load ChestCT model: {e}")


def predict(file_bytes: bytes) -> dict:
    if _model is None:
        return _stub_result()

    img_array = load_image_as_array(file_bytes, target_size=_input_size)

    try:
        raw_probs = _model.predict(img_array, verbose=0)[0]
        if len(raw_probs) == 1:
            p = float(raw_probs[0])
            raw_probs = np.array([1 - p, p])
            labels = ["Normal", "Abnormal"]
        else:
            labels = CLASSES[:len(raw_probs)]

        cal        = calibrate_result(raw_probs)
        probs      = cal["probs"]
        pred_idx   = int(np.argmax(probs))
        pred_label = labels[pred_idx]
        confidence = cal["confidence"]
        uncertainty = entropy_uncertainty(probs)
        heatmap_b64 = compute_gradcam(_model, img_array, pred_index=pred_idx)
        severity = _severity(pred_label, confidence)

        return {
            "modality": "chest_ct",
            "prediction": pred_label,
            "confidence": round(confidence, 4),
            "class_probabilities": {cls: round(float(p), 4) for cls, p in zip(labels, probs)},
            "severity": severity,
            "uncertainty": uncertainty,
            "calibrated": True,
            "calibration_temperature": cal["temperature"],
            "explainability": {
                "type": "gradcam_overlay",
                "image_b64": heatmap_b64,
                "description": "Grad-CAM heatmap over chest CT identifying pathological regions",
            },
            "stub": False,
        }
    except Exception as e:
        logger.error(f"ChestCT inference error: {e}")
        return {"error": str(e), "modality": "chest_ct", "stub": False}


def _severity(label: str, confidence: float) -> dict:
    severity_map = {
        "COVID-19": ("High", 0.80),
        "Lung Opacity": ("Medium", 0.60),
        "Viral Pneumonia": ("Medium", 0.55),
        "Normal": ("Low", 0.05),
        "Abnormal": ("Medium", 0.60),
    }
    level, base = severity_map.get(label, ("Unknown", 0.50))
    return {
        "level": level,
        "score": round(base * confidence, 3),
        "description": f"Chest CT finding: {label}",
    }


def _stub_result() -> dict:
    return {
        "modality": "chest_ct",
        "prediction": "Normal",
        "confidence": 0.0,
        "class_probabilities": {},
        "severity": {"level": "Unknown", "score": 0.0, "description": "Model not loaded"},
        "uncertainty": {"is_uncertain": True, "flag": "Model not loaded", "normalized_entropy": 1.0},
        "explainability": {"type": "none", "image_b64": "", "description": "Model unavailable"},
        "stub": True,
        "todo": "Place BEST_MODEL_EfficientNetB3_ChestCT.h5 in project root.",
    }

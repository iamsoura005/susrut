"""
Head CT hemorrhage detection module.
Model: BEST_CustomCNN_HeadCT_Hemorrhage.h5 (Keras CustomCNN)
Binary classification: hemorrhage / no hemorrhage
Threshold sourced from headCT.csv (CustomCNN row = 0.52)
"""
import logging
from pathlib import Path

import numpy as np

from app.preprocessing.image_utils import load_image_as_array
from app.utils.explainability import compute_gradcam
from app.utils.uncertainty import entropy_uncertainty
from app.utils.calibration import calibrate_result

logger = logging.getLogger("radiai.head_ct")

MODEL_PATH = Path(__file__).parent.parent.parent.parent / "BEST_CustomCNN_HeadCT_Hemorrhage.h5"
THRESHOLD = 0.52  # from headCT.csv — CustomCNN row
CLASSES = ["No Hemorrhage", "Hemorrhage"]

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
            logger.info(f"✅ HeadCT model loaded — input size: {_input_size}")
        else:
            logger.warning(f"⚠️  HeadCT model not found at {MODEL_PATH}")
    except Exception as e:
        logger.error(f"Failed to load HeadCT model: {e}")


def predict(file_bytes: bytes) -> dict:
    if _model is None:
        return _stub_result()

    img_array = load_image_as_array(file_bytes, target_size=_input_size)

    try:
        raw_out = _model.predict(img_array, verbose=0)[0]
        if len(raw_out) == 1:
            p_hem = float(raw_out[0])
            raw_probs = np.array([1 - p_hem, p_hem])
        else:
            raw_probs = np.array(raw_out, dtype=np.float32)

        cal   = calibrate_result(raw_probs)
        probs = cal["probs"]
        p_hemorrhage = float(probs[1])
        pred_label   = "Hemorrhage" if p_hemorrhage >= THRESHOLD else "No Hemorrhage"
        confidence   = p_hemorrhage if pred_label == "Hemorrhage" else (1.0 - p_hemorrhage)
        uncertainty  = entropy_uncertainty(probs)
        pred_idx     = 1 if pred_label == "Hemorrhage" else 0
        heatmap_b64  = compute_gradcam(_model, img_array, pred_index=pred_idx)
        severity     = _severity(pred_label, p_hemorrhage)

        return {
            "modality": "head_ct",
            "prediction": pred_label,
            "confidence": round(confidence, 4),
            "class_probabilities": {
                "No Hemorrhage": round(float(probs[0]), 4),
                "Hemorrhage":    round(float(probs[1]), 4),
            },
            "hemorrhage_probability": round(p_hemorrhage, 4),
            "threshold_used": THRESHOLD,
            "severity": severity,
            "uncertainty": uncertainty,
            "calibrated": True,
            "calibration_temperature": cal["temperature"],
            "explainability": {
                "type": "gradcam_overlay",
                "image_b64": heatmap_b64,
                "description": "Grad-CAM heatmap highlighting hemorrhagic regions in head CT",
            },
            "stub": False,
        }
    except Exception as e:
        logger.error(f"HeadCT inference error: {e}")
        return {"error": str(e), "modality": "head_ct", "stub": False}


def _severity(label: str, p_hem: float) -> dict:
    if label == "Hemorrhage":
        if p_hem > 0.85:
            level, score = "Critical", 0.95
        elif p_hem > 0.65:
            level, score = "High", 0.75
        else:
            level, score = "Medium", 0.55
        desc = f"Hemorrhage detected with {p_hem:.0%} confidence. Urgent imaging review advised."
    else:
        level, score = "Low", 0.05
        desc = "No intracranial hemorrhage detected."
    return {"level": level, "score": round(score, 3), "description": desc}


def _stub_result() -> dict:
    return {
        "modality": "head_ct",
        "prediction": "No Hemorrhage",
        "confidence": 0.0,
        "class_probabilities": {"No Hemorrhage": 0.5, "Hemorrhage": 0.5},
        "severity": {"level": "Unknown", "score": 0.0, "description": "Model not loaded"},
        "uncertainty": {"is_uncertain": True, "flag": "Model not loaded", "normalized_entropy": 1.0},
        "explainability": {"type": "none", "image_b64": "", "description": "Model unavailable"},
        "stub": True,
        "todo": "Place BEST_CustomCNN_HeadCT_Hemorrhage.h5 in project root.",
    }

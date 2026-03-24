"""
Brain MRI tumor classification module.
Model: BrainMRI.h5 (Keras)
Classes: glioma, meningioma, pituitary_tumor, no_tumor
"""
import logging
from pathlib import Path
from typing import Optional

import numpy as np

from app.preprocessing.image_utils import load_image_as_array
from app.utils.explainability import compute_gradcam
from app.utils.uncertainty import entropy_uncertainty
from app.utils.calibration import calibrate_result

logger = logging.getLogger("radiai.brain_mri")

MODEL_PATH = Path(__file__).parent.parent.parent.parent / "BrainMRI.h5"
CLASSES = ["glioma", "meningioma", "no_tumor", "pituitary_tumor"]

_model = None
_input_size = (224, 224)  # updated after load from model.input_shape


def load():
    global _model, _input_size
    try:
        import tensorflow as tf
        if MODEL_PATH.exists():
            _model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
            # Read actual input shape from model — (None, H, W, C)
            shape = _model.input_shape
            _input_size = (int(shape[1]), int(shape[2]))
            logger.info(f"✅ BrainMRI model loaded — input size: {_input_size}")
        else:
            logger.warning(f"⚠️  BrainMRI model not found at {MODEL_PATH}")
    except Exception as e:
        logger.error(f"Failed to load BrainMRI model: {e}")


def predict(file_bytes: bytes) -> dict:
    if _model is None:
        return _stub_result()

    img_array = load_image_as_array(file_bytes, target_size=_input_size)

    try:
        raw_probs = _model.predict(img_array, verbose=0)[0]
        cal       = calibrate_result(raw_probs)
        probs     = cal["probs"]
        pred_idx  = int(np.argmax(probs))
        pred_label = CLASSES[pred_idx]
        confidence = cal["confidence"]
        uncertainty = entropy_uncertainty(probs)
        # Pass original bytes for full-res overlay
        heatmap_b64 = compute_gradcam(_model, img_array, pred_index=pred_idx, original_img_bytes=file_bytes)
        severity = _severity(pred_label, confidence)

        return {
            "modality": "brain_mri",
            "prediction": pred_label,
            "confidence": round(confidence, 4),
            "class_probabilities": {cls: round(float(p), 4) for cls, p in zip(CLASSES, probs)},
            "severity": severity,
            "uncertainty": uncertainty,
            "calibrated": True,
            "calibration_temperature": cal["temperature"],
            "explainability": {
                "type": "gradcam_overlay",
                "image_b64": heatmap_b64,
                "description": "Grad-CAM activation heatmap highlighting tumor-relevant regions",
            },
            "stub": False,
        }
    except Exception as e:
        logger.error(f"Brain MRI inference error: {e}")
        return {"error": str(e), "modality": "brain_mri", "stub": False}


def _severity(label: str, confidence: float) -> dict:
    level_map = {
        "glioma": "High",
        "meningioma": "Medium",
        "pituitary_tumor": "Medium",
        "no_tumor": "Low",
    }
    score_map = {
        "glioma": 0.85,
        "meningioma": 0.55,
        "pituitary_tumor": 0.50,
        "no_tumor": 0.05,
    }
    level = level_map.get(label, "Unknown")
    base_score = score_map.get(label, 0.5)
    return {
        "level": level,
        "score": round(base_score * confidence, 3),
        "description": _severity_desc(label),
    }


def _severity_desc(label: str) -> str:
    descs = {
        "glioma": "Malignant brain tumor — immediate clinical follow-up recommended.",
        "meningioma": "Typically benign meningeal tumor — monitoring advised.",
        "pituitary_tumor": "Pituitary region mass — endocrine evaluation advised.",
        "no_tumor": "No tumor detected in this scan.",
    }
    return descs.get(label, "Unknown findings.")


def _stub_result() -> dict:
    return {
        "modality": "brain_mri",
        "prediction": "no_tumor",
        "confidence": 0.0,
        "class_probabilities": {c: 0.25 for c in CLASSES},
        "severity": {"level": "Unknown", "score": 0.0, "description": "Model weights not loaded."},
        "uncertainty": {"is_uncertain": True, "flag": "Model not loaded", "normalized_entropy": 1.0},
        "explainability": {"type": "none", "image_b64": "", "description": "Model unavailable"},
        "stub": True,
        "todo": "Place BrainMRI.h5 in the project root to enable brain MRI inference.",
    }

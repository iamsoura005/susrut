"""
ML-based modality classifier.
Uses modality_classifier.h5 (EfficientNetB0) when available.
Falls back to keyword/extension heuristics when the model is not trained yet.
"""
import logging
from pathlib import Path
from typing import Optional

import numpy as np

from app.preprocessing.image_utils import load_image_as_array

logger = logging.getLogger("radiai.modality_classifier")

MODEL_PATH       = Path(__file__).parent.parent.parent.parent / "modality_classifier.h5"
CLASS_NAMES_FILE = Path(__file__).parent.parent.parent.parent / "modality_class_names.json"
INPUT_SIZE  = (224, 224)

# Default alphabetical order — overwritten from JSON after build_models.py runs
CLASS_NAMES = ["bone_xray", "brain_mri", "chest_ct", "ecg", "head_ct"]

_model = None


def load():
    global _model, CLASS_NAMES
    # Load class name order from JSON written by build_models.py
    if CLASS_NAMES_FILE.exists():
        import json
        with open(CLASS_NAMES_FILE) as f:
            CLASS_NAMES = json.load(f)
        logger.info(f"Modality classes loaded from JSON: {CLASS_NAMES}")
    if MODEL_PATH.exists():
        try:
            import tensorflow as tf
            _model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
            logger.info(f"✅ Modality classifier loaded — {len(CLASS_NAMES)} classes: {CLASS_NAMES}")
        except Exception as e:
            logger.warning(f"⚠️  Modality classifier failed to load: {e} — using heuristics")
    else:
        logger.info("ℹ️  modality_classifier.h5 not found — using keyword heuristics")


ML_CONFIDENCE_THRESHOLD = 0.72  # below this, heuristics win

def classify(file_bytes: bytes, filename: str, content_type: str) -> tuple[str, float]:
    """
    Detect modality and return (modality_name, confidence).
    Priority:
      1. File extension shortcut (CSV/DAT/EDF → ECG always)
      2. ML classifier (EfficientNetB0) — only trusted if confidence ≥ threshold
      3. Keyword + dimension heuristics
    """
    ext = Path(filename).suffix.lower()
    if ext in {".csv", ".dat", ".edf", ".txt"}:
        print(f"[RadiAI] Detected modality: ecg (1.00) — ECG file extension")
        return "ecg", 1.0

    if _model is not None:
        modality, confidence = _ml_classify(file_bytes)
        print(f"[RadiAI] ML classifier: {modality} ({confidence:.2f})")
        if confidence >= ML_CONFIDENCE_THRESHOLD:
            print(f"[RadiAI] Detected modality: {modality} ({confidence:.2f}) — ML classifier")
            return modality, confidence
        # ML not confident — fall through to heuristics
        logger.info(f"ML confidence {confidence:.2f} < {ML_CONFIDENCE_THRESHOLD} — using heuristics")

    result = _heuristic_classify(filename, content_type, file_bytes)
    print(f"[RadiAI] Detected modality: {result} (heuristic) — keyword/dimension rules")
    return result, 0.0


def _ml_classify(file_bytes: bytes) -> tuple[str, float]:
    """Run image through EfficientNetB0 classifier."""
    try:
        img_array = load_image_as_array(file_bytes, target_size=INPUT_SIZE)
        probs = _model.predict(img_array, verbose=0)[0]
        idx   = int(np.argmax(probs))
        return CLASS_NAMES[idx], float(probs[idx])
    except Exception as e:
        logger.error(f"ML modality classify failed: {e}")
        return "chest_ct", 0.0


def _heuristic_classify(filename: str, content_type: str, file_bytes: bytes) -> str:
    """Keyword-based heuristic fallback (no ML required)."""
    name = filename.lower()

    KEYWORDS = {
        "brain_mri": ["brain", "mri", "tumor", "glioma", "meningioma", "pituitary", "flair", "t1", "t2"],
        "head_ct":   ["head", "headct", "hemorrhage", "intracranial", "skull", "cranial", "bleed"],
        "chest_ct":  ["chest", "lung", "covid", "pneumonia", "opacity", "chestct", "thorax", "pulmon"],
        "ecg":       ["ecg", "ekg", "cardiac", "heart", "ptbxl", "arrhythmia", "rhythm"],
        "bone_xray": ["bone", "fracture", "xray", "x-ray", "skeletal", "ortho", "mura", "wrist", "elbow", "knee", "femur", "tibia"],
    }

    for modality, kws in KEYWORDS.items():
        if any(k in name for k in kws):
            return modality

    # Image dimension heuristic — improved, less aggressive bone_xray assignment
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(file_bytes))
        w, h = img.size
        ratio = w / h if h > 0 else 1.0

        # Only classify as bone_xray if clearly landscape AND small resolution typical of X-rays
        if ratio > 1.5 and w < 800:
            return "bone_xray"
        # Very small square or near-square images are usually brain MRI slices
        if ratio < 1.2 and w < 300:
            return "brain_mri"
        # Large near-square: likely chest CT
        if ratio < 1.2 and w >= 300:
            return "chest_ct"
    except Exception:
        pass

    # Safe final fallback — chest_ct is the most common modality in datasets
    return "chest_ct"

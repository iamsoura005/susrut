"""
ECG arrhythmia classification module.
Model: ECG PTBXL.h5 (Keras)
Accepts: CSV ECG signal or raw signal file.
"""
import logging
from pathlib import Path

import numpy as np

from app.preprocessing.ecg_utils import parse_ecg_csv, normalize_signal, signal_to_waveform_b64
from app.utils.uncertainty import entropy_uncertainty

logger = logging.getLogger("radiai.ecg")

MODEL_PATH = Path(__file__).parent.parent.parent.parent / "ECG PTBXL.h5"
# PTB-XL dataset has 5 superclasses
CLASSES = ["NORM", "MI", "STTC", "CD", "HYP"]
CLASS_FULL = {
    "NORM": "Normal Sinus Rhythm",
    "MI": "Myocardial Infarction",
    "STTC": "ST/T Change",
    "CD": "Conduction Disturbance",
    "HYP": "Hypertrophy",
}
INPUT_LENGTH = 1000

_model = None
_input_shape = None


def load():
    global _model, _input_shape
    try:
        import tensorflow as tf
        if MODEL_PATH.exists():
            _model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
            _input_shape = _model.input_shape
            logger.info(f"✅ ECG model loaded from {MODEL_PATH} — input shape: {_input_shape}")
        else:
            logger.warning(f"⚠️  ECG model not found at {MODEL_PATH}")
    except Exception as e:
        logger.error(f"Failed to load ECG model: {e}")


def predict(file_bytes: bytes, filename: str = "") -> dict:
    signal_raw = parse_ecg_csv(file_bytes)
    waveform_b64 = signal_to_waveform_b64(signal_raw, title="ECG Signal")
    signal_norm = normalize_signal(signal_raw, target_length=INPUT_LENGTH)

    if _model is None:
        return _stub_result(waveform_b64)

    try:
        # Build input tensor to match model's expected shape
        x = _build_input(signal_norm)
        if x is None:
            return _stub_result(waveform_b64, reason="Input shape mismatch — check model architecture")

        probs = _model.predict(x, verbose=0)[0]
        labels = CLASSES[:len(probs)]

        pred_idx = int(np.argmax(probs))
        pred_short = labels[pred_idx]
        pred_label = CLASS_FULL.get(pred_short, pred_short)
        confidence = float(probs[pred_idx])
        uncertainty = entropy_uncertainty(probs)
        severity = _severity(pred_short, confidence)

        return {
            "modality": "ecg",
            "prediction": pred_label,
            "prediction_code": pred_short,
            "confidence": round(confidence, 4),
            "class_probabilities": {
                CLASS_FULL.get(c, c): round(float(p), 4) for c, p in zip(labels, probs)
            },
            "severity": severity,
            "uncertainty": uncertainty,
            "explainability": {
                "type": "waveform",
                "image_b64": waveform_b64,
                "description": "ECG signal waveform visualization",
            },
            "stub": False,
        }
    except Exception as e:
        logger.error(f"ECG inference error: {e}")
        return {"error": str(e), "modality": "ecg", "stub": False, "explainability": {"image_b64": waveform_b64}}


def _build_input(signal: np.ndarray):
    """Reshape signal to match model input shape."""
    if _input_shape is None:
        return None
    shape = _input_shape[1:]  # drop batch dim

    if len(shape) == 1:
        # (1000,)
        return signal.reshape(1, INPUT_LENGTH)
    elif len(shape) == 2:
        # (1000, 1) or (12, 1000) — try common layouts
        if shape == (INPUT_LENGTH, 1):
            return signal.reshape(1, INPUT_LENGTH, 1)
        elif shape[1] == INPUT_LENGTH:
            # multi-lead: replicate single lead
            n_leads = shape[0]
            return np.tile(signal, (1, n_leads, 1)).reshape(1, n_leads, INPUT_LENGTH)
    return None


def _severity(code: str, confidence: float) -> dict:
    sev_map = {
        "NORM": ("Low", 0.05, "Normal cardiac activity."),
        "MI": ("Critical", 0.90, "Myocardial Infarction pattern detected. Immediate referral advised."),
        "STTC": ("High", 0.70, "ST/T wave changes detected — possible ischemia or electrolyte imbalance."),
        "CD": ("Medium", 0.55, "Conduction disturbance detected — arrhythmia risk."),
        "HYP": ("Medium", 0.50, "Hypertrophy pattern detected."),
    }
    level, base, desc = sev_map.get(code, ("Unknown", 0.5, "Pattern detected."))
    return {"level": level, "score": round(base * confidence, 3), "description": desc}


def _stub_result(waveform_b64: str = "", reason: str = "") -> dict:
    return {
        "modality": "ecg",
        "prediction": "Unknown",
        "confidence": 0.0,
        "class_probabilities": {},
        "severity": {"level": "Unknown", "score": 0.0, "description": "Model not loaded"},
        "uncertainty": {"is_uncertain": True, "flag": "Model not loaded", "normalized_entropy": 1.0},
        "explainability": {
            "type": "waveform",
            "image_b64": waveform_b64,
            "description": "ECG signal waveform (model unavailable for classification)",
        },
        "stub": True,
        "todo": reason or "Place 'ECG PTBXL.h5' in project root.",
    }

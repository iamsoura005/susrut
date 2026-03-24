"""
Central model registry — single source of truth for all modality models.
Models are loaded ONCE at startup and cached here.
"""
import logging
from pathlib import Path

logger = logging.getLogger("radiai.registry")

# Root directory where .h5 files live
_ROOT = Path(__file__).parent.parent.parent.parent

MODEL_CONFIG = {
    "brain_mri": {
        "file": _ROOT / "BrainMRI.h5",
        "description": "Brain tumor classifier (glioma / meningioma / pituitary / no_tumor)",
    },
    "chest_ct": {
        "file": _ROOT / "BEST_MODEL_EfficientNetB3_ChestCT.h5",
        "description": "Chest CT disease classifier (EfficientNetB3)",
    },
    "head_ct": {
        "file": _ROOT / "BEST_CustomCNN_HeadCT_Hemorrhage.h5",
        "description": "Head CT hemorrhage detector (CustomCNN)",
    },
    "ecg": {
        "file": _ROOT / "ECG PTBXL.h5",
        "description": "ECG arrhythmia classifier (PTB-XL 5-class)",
    },
    "bone_xray": {
        "file": None,  # TODO: place bone_xray_model.h5 in project root
        "description": "Bone fracture detector — STUB (no weights available)",
    },
}


def get_status() -> dict:
    """Return the load status and input sizes of all registered models."""
    from app.models import brain_mri, chest_ct, head_ct, ecg, bone_xray
    modules = {
        "brain_mri": brain_mri,
        "chest_ct":  chest_ct,
        "head_ct":   head_ct,
        "ecg":       ecg,
        "bone_xray": bone_xray,
    }
    result = {}
    for name, mod in modules.items():
        loaded = getattr(mod, "_model", None) is not None
        cfg    = MODEL_CONFIG[name]
        size   = getattr(mod, "_input_size", None) or getattr(mod, "_input_shape", None)
        result[name] = {
            "loaded":      loaded,
            "file":        str(cfg["file"]) if cfg["file"] else "none",
            "stub":        not loaded,
            "input_size":  list(size) if size else None,
            "description": cfg["description"],
        }
    return result

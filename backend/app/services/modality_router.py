"""
Modality router — detects the correct ML pipeline from file metadata.
Strategy: filename keywords → MIME/extension → image dimensions → fallback.
"""
import logging
import mimetypes
from pathlib import Path

logger = logging.getLogger("radiai.modality_router")

# Keyword rules applied to the original filename (case-insensitive)
_FILENAME_KEYWORDS = {
    "brain_mri": ["brain", "mri", "tumor", "glioma", "meningioma", "pituitary"],
    "head_ct": ["head", "headct", "hemorrhage", "intracranial", "skull", "cranial"],
    "chest_ct": ["chest", "lung", "covid", "pneumonia", "opacity", "chestct"],
    "ecg": ["ecg", "ekg", "ecg_signal", "cardiac", "heart", "ptbxl", "arrhythmia"],
    "bone_xray": ["bone", "fracture", "xray", "x-ray", "xr_", "skeletal", "ortho"],
}

# Extension-based hints
_CSV_MODALITY = "ecg"  # CSV files are treated as ECG signals by default


def detect_modality(filename: str, content_type: str, file_bytes: bytes) -> str:
    """
    Return the detected modality string.
    Options: brain_mri | head_ct | chest_ct | ecg | bone_xray
    """
    name_lower = filename.lower()

    # 1. CSV / signal file → ECG
    ext = Path(filename).suffix.lower()
    if ext in {".csv", ".txt", ".dat", ".edf"}:
        logger.info(f"Modality: ecg (file extension '{ext}')")
        return "ecg"

    # 2. Keyword match on filename
    for modality, keywords in _FILENAME_KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            logger.info(f"Modality: {modality} (keyword match in filename)")
            return modality

    # 3. Image: try to infer from dimensions
    if ext in {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".dcm", ".dicom"}:
        modality = _infer_from_image(file_bytes)
        if modality:
            logger.info(f"Modality: {modality} (image dimension heuristic)")
            return modality

    # 4. Fallback: arbitrary image → chest_ct (most general)
    logger.warning(f"Modality detection uncertain for '{filename}' — defaulting to chest_ct")
    return "chest_ct"


def _infer_from_image(file_bytes: bytes) -> str | None:
    """
    Use image aspect ratio / size heuristic.
    Brain MRI: roughly square, 200-600px
    Chest CT: large square or slightly wide
    Head CT: small-medium square
    """
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(file_bytes))
        w, h = img.size
        ratio = w / h if h > 0 else 1.0

        if 0.95 <= ratio <= 1.05:  # square-ish
            if w < 300:
                return "brain_mri"
            elif w < 600:
                return "head_ct"
            else:
                return "chest_ct"
        elif ratio > 1.3:  # landscape
            return "bone_xray"
    except Exception:
        pass
    return None

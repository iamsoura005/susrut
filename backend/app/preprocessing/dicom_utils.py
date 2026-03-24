"""
DICOM file parser — extracts pixel array and converts to RGB numpy image.
Handles windowing, modality-specific normalisation, and multi-frame DICOMs.
"""
import logging
import numpy as np

logger = logging.getLogger("radiai.dicom")

_PYDICOM_AVAILABLE = False
try:
    import pydicom
    from pydicom.pixel_data_handlers.util import apply_voi_lut
    _PYDICOM_AVAILABLE = True
except ImportError:
    logger.warning("pydicom not installed — DICOM support disabled. Run: pip install pydicom")


def is_dicom(file_bytes: bytes) -> bool:
    """Detect DICOM by magic bytes at offset 128 ('DICM') or zero-offset start."""
    return (len(file_bytes) > 132 and file_bytes[128:132] == b"DICM") or \
           file_bytes[:4] in (b"\x08\x00\x00\x00", b"\x02\x00\x00\x00")


def dicom_to_rgb(file_bytes: bytes, target_size: tuple[int, int] = (224, 224)) -> np.ndarray:
    """
    Parse a DICOM file and return a normalised uint8 RGB image (H, W, 3).
    Applies DICOM windowing (VOI LUT) so the image resembles what a radiologist sees.
    """
    if not _PYDICOM_AVAILABLE:
        raise RuntimeError("pydicom is required for DICOM support. Run: pip install pydicom")

    import io
    ds = pydicom.dcmread(io.BytesIO(file_bytes), force=True)

    # Extract pixel data
    try:
        pixel_array = ds.pixel_array.astype(np.float64)
    except Exception as e:
        raise ValueError(f"Cannot read DICOM pixel data: {e}")

    # Handle multi-frame: take middle frame
    if pixel_array.ndim == 3 and pixel_array.shape[0] > 1:
        mid = pixel_array.shape[0] // 2
        pixel_array = pixel_array[mid]
    elif pixel_array.ndim == 3 and pixel_array.shape[2] == 3:
        # Already RGB (colour DICOM)
        pixel_array = pixel_array.astype(np.float64)

    # Apply VOI LUT / windowing if available
    try:
        pixel_array = apply_voi_lut(pixel_array.astype(np.int32), ds, index=0)
        pixel_array = pixel_array.astype(np.float64)
    except Exception:
        pass

    # Apply rescale slope/intercept (Hounsfield units for CT)
    slope     = float(getattr(ds, "RescaleSlope",     1))
    intercept = float(getattr(ds, "RescaleIntercept", 0))
    pixel_array = pixel_array * slope + intercept

    # Normalize to [0, 255]
    p_min, p_max = pixel_array.min(), pixel_array.max()
    if p_max > p_min:
        pixel_array = (pixel_array - p_min) / (p_max - p_min) * 255.0
    else:
        pixel_array = np.zeros_like(pixel_array)

    img_uint8 = pixel_array.astype(np.uint8)

    # Ensure 2-D grayscale → RGB
    import cv2
    if img_uint8.ndim == 2:
        img_rgb = cv2.cvtColor(img_uint8, cv2.COLOR_GRAY2RGB)
    elif img_uint8.ndim == 3 and img_uint8.shape[2] == 3:
        img_rgb = img_uint8
    else:
        img_rgb = cv2.cvtColor(img_uint8[:, :, 0], cv2.COLOR_GRAY2RGB)

    # Resize using letterbox (preserves aspect ratio)
    from app.preprocessing.image_utils import letterbox_resize
    img_rgb = letterbox_resize(img_rgb, target_size)

    return img_rgb


def extract_metadata(file_bytes: bytes) -> dict:
    """Extract useful DICOM metadata for the report (best-effort)."""
    if not _PYDICOM_AVAILABLE:
        return {}
    try:
        import io
        ds = pydicom.dcmread(io.BytesIO(file_bytes), force=True, stop_before_pixels=True)
        return {
            "patient_id":      str(getattr(ds, "PatientID",             "")),
            "patient_name":    str(getattr(ds, "PatientName",           "")),
            "study_date":      str(getattr(ds, "StudyDate",             "")),
            "modality_tag":    str(getattr(ds, "Modality",              "")),
            "institution":     str(getattr(ds, "InstitutionName",       "")),
            "series_desc":     str(getattr(ds, "SeriesDescription",     "")),
            "study_desc":      str(getattr(ds, "StudyDescription",      "")),
        }
    except Exception:
        return {}

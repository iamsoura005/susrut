"""
Image preprocessing utilities — supports standard images AND DICOM.
"""
import io
import numpy as np
import cv2
from PIL import Image


def load_image_as_array(file_bytes: bytes, target_size: tuple = (224, 224)) -> np.ndarray:
    """
    Load image from bytes, resize to target_size, normalize to [0,1].
    Automatically handles DICOM (.dcm) files via pydicom.
    Uses letterbox padding to preserve aspect ratio.

    Returns:
        np.ndarray of shape (1, H, W, 3)
    """
    # ── DICOM path ────────────────────────────────────────────────────────────
    try:
        from app.preprocessing.dicom_utils import is_dicom, dicom_to_rgb
        if is_dicom(file_bytes):
            img_rgb = dicom_to_rgb(file_bytes, target_size=target_size)
            arr = img_rgb.astype(np.float32) / 255.0
            return np.expand_dims(arr, axis=0)
    except ImportError:
        pass

    # ── Standard image path ───────────────────────────────────────────────────
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        pil_img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    padded  = letterbox_resize(img_rgb, target_size)
    arr     = padded.astype(np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


def letterbox_resize(image: np.ndarray, target_size: tuple) -> np.ndarray:
    """
    Resize image to target_size with aspect-ratio-preserving letterbox padding.
    Pads with black — avoids distortion on non-square medical images.
    """
    th, tw = target_size
    h, w = image.shape[:2]
    scale = min(tw / w, th / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    canvas = np.zeros((th, tw, 3), dtype=np.uint8)
    x_off = (tw - new_w) // 2
    y_off = (th - new_h) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized
    return canvas


# Keep old name as alias for backwards-compat
_letterbox = letterbox_resize


def load_image_pil(file_bytes: bytes, target_size: tuple = (224, 224)) -> Image.Image:
    """Return a resized PIL Image (simple resize, no padding)."""
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return img.resize(target_size, Image.LANCZOS)


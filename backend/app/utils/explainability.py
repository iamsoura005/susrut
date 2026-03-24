"""
Grad-CAM explainability for Keras CNN models.
Returns a base64-encoded PNG of the heatmap overlaid on the input image.
Automatically skips non-CNN models (e.g. ECG LSTM).
"""
import io
import base64
import logging
from typing import Optional

import numpy as np
import cv2

logger = logging.getLogger("radiai.explainability")


def _encode_image_to_b64(img_array: np.ndarray) -> str:
    """Encode an OpenCV BGR image to base64 PNG string."""
    _, buffer = cv2.imencode(".png", img_array)
    return base64.b64encode(buffer).decode("utf-8")


def _find_last_conv_layer(model) -> Optional[str]:
    """
    Recursively search model (and sub-models) for the last Conv2D layer.
    Needed because EfficientNet/MobileNet wrap conv layers inside a sub-model.
    """
    import tensorflow as tf

    last_name = None

    def _search(m):
        nonlocal last_name
        for layer in m.layers:
            # Recurse into nested sub-models (e.g. EfficientNet backbone)
            if hasattr(layer, 'layers'):
                _search(layer)
            # Check output shape: (batch, H, W, C) = 4D = Conv layer
            try:
                out_shape = layer.output_shape
                if isinstance(out_shape, list):
                    out_shape = out_shape[0]
                if len(out_shape) == 4:
                    last_name = layer.name
            except Exception:
                pass

    _search(model)
    return last_name


def _is_cnn_model(model) -> bool:
    """Returns True if the model has any 4D (Conv2D) layers."""
    return _find_last_conv_layer(model) is not None


def compute_gradcam(
    model,
    img_array: np.ndarray,
    last_conv_layer_name: Optional[str] = None,
    pred_index: Optional[int] = None,
    original_img_bytes: Optional[bytes] = None,
) -> str:
    """
    Compute Grad-CAM heatmap and return base64 overlay.

    Args:
        model:                 Keras model
        img_array:             preprocessed input array (1, H, W, C)
        last_conv_layer_name:  name of the last conv layer (auto-detected if None)
        pred_index:            class index to highlight (uses argmax if None)
        original_img_bytes:    raw image bytes for full-res overlay (optional)

    Returns:
        Base64-encoded PNG string of the overlay
    """
    try:
        import tensorflow as tf

        # Skip Grad-CAM for non-CNN models (e.g. ECG LSTM/dense-only models)
        if not _is_cnn_model(model):
            logger.info("Model has no Conv2D layers — skipping Grad-CAM")
            return ""

        # Auto-detect last conv layer (recurses into sub-models)
        if last_conv_layer_name is None:
            last_conv_layer_name = _find_last_conv_layer(model)
            if last_conv_layer_name is None:
                logger.warning("No Conv2D layer found — returning plain image")
                return _plain_image_b64(img_array)

        logger.info(f"Grad-CAM using layer: {last_conv_layer_name}")

        # Build gradient model — search all layers including nested ones
        conv_layer = _get_layer_by_name(model, last_conv_layer_name)
        if conv_layer is None:
            logger.warning(f"Layer '{last_conv_layer_name}' not found in model")
            return _plain_image_b64(img_array)

        grad_model = tf.keras.models.Model(
            inputs=model.inputs,
            outputs=[conv_layer.output, model.output],
        )

        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(img_array, training=False)
            if pred_index is None:
                pred_index = int(tf.argmax(predictions[0]))
            class_channel = predictions[:, pred_index]

        grads = tape.gradient(class_channel, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]
        heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap).numpy()

        # Proper normalization
        heatmap = np.maximum(heatmap, 0)
        max_val = heatmap.max()
        if max_val > 1e-8:
            heatmap = heatmap / max_val
        else:
            logger.warning("Grad-CAM heatmap is all zeros — returning plain image")
            return _plain_image_b64(img_array)

        # Determine the original image for overlay
        if original_img_bytes is not None:
            try:
                nparr = np.frombuffer(original_img_bytes, np.uint8)
                orig_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if orig_bgr is None:
                    raise ValueError("cv2 decode returned None")
            except Exception:
                orig_bgr = _img_array_to_bgr(img_array)
        else:
            orig_bgr = _img_array_to_bgr(img_array)

        h, w = orig_bgr.shape[:2]
        heatmap_resized = cv2.resize(heatmap, (w, h))
        heatmap_uint8   = np.uint8(255 * heatmap_resized)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

        # 60/40 blend: more original image visible
        superimposed = cv2.addWeighted(orig_bgr, 0.6, heatmap_colored, 0.4, 0)
        return _encode_image_to_b64(superimposed)

    except Exception as e:
        logger.error(f"Grad-CAM failed: {e}", exc_info=True)
        return _plain_image_b64(img_array)


def _get_layer_by_name(model, name: str):
    """Search all layers (including nested sub-models) by name."""
    for layer in model.layers:
        if layer.name == name:
            return layer
        if hasattr(layer, 'layers'):
            result = _get_layer_by_name(layer, name)
            if result is not None:
                return result
    return None


def _img_array_to_bgr(img_array: np.ndarray) -> np.ndarray:
    """Convert preprocessed img_array (1, H, W, C) to OpenCV BGR."""
    orig = (img_array[0] * 255).astype(np.uint8)
    if orig.shape[-1] == 1:
        orig = cv2.cvtColor(orig, cv2.COLOR_GRAY2BGR)
    else:
        orig = cv2.cvtColor(orig, cv2.COLOR_RGB2BGR)
    return orig


def _plain_image_b64(img_array: np.ndarray) -> str:
    """Fallback: return the input image as base64 without overlay."""
    return _encode_image_to_b64(_img_array_to_bgr(img_array))

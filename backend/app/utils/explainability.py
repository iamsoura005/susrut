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
                out_shape = getattr(layer, 'output_shape', None)
                if out_shape is None and hasattr(layer, 'output'):
                    out_shape = layer.output.shape
                
                if out_shape is not None:
                    # Depending on Keras version, shape could be a TensorShape or list/tuple
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

        # Build gradient model
        last_layer = model.layers[-1]
        original_activation = getattr(last_layer, 'activation', None)
        has_softmax = original_activation is not None and getattr(original_activation, '__name__', '') == 'softmax'

        try:
            # Re-assign activation to linear to compute gradient w.r.t logits (dramatically improves localization)
            if has_softmax:
                import tensorflow as tf
                last_layer.activation = tf.keras.activations.linear

            grad_model = tf.keras.models.Model(
                inputs=model.inputs,
                outputs=[_get_layer_by_name(model, last_conv_layer_name).output, model.output],
            )

            with tf.GradientTape() as tape:
                conv_outputs, predictions = grad_model(img_array, training=False)
                
                # If model only has 1 output node (sigmoid), force pred_index to 0 to avoid IndexError
                if predictions.shape[-1] == 1:
                    pred_index = 0
                elif pred_index is None:
                    pred_index = int(tf.argmax(predictions[0]))
                    
                class_channel = predictions[:, pred_index]

            grads = tape.gradient(class_channel, conv_outputs)
        finally:
            if has_softmax:
                last_layer.activation = original_activation

        # Prevent None grads if disconnected
        if grads is None:
            logger.warning("Grad-CAM: Gradients are None. Returning plain image.")
            return _plain_image_b64(img_array)

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]
        heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap).numpy()

        # Proper normalization (ReLU)
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
                    
                # Unpad heatmap from letterbox coordinates back to original aspect ratio
                th, tw = img_array.shape[1:3]
                h, w = orig_bgr.shape[:2]
                scale = min(tw / w, th / h)
                new_w, new_h = int(w * scale), int(h * scale)
                x_off = (tw - new_w) // 2
                y_off = (th - new_h) // 2
                
                # Resize low-res heatmap to padded tw, th first
                heatmap_padded = cv2.resize(heatmap, (tw, th))
                
                # Crop to image area
                heatmap_cropped = heatmap_padded[y_off:y_off + new_h, x_off:x_off + new_w]
                
                # Resize cropped heatmap to exactly the original w, h
                heatmap_resized = cv2.resize(heatmap_cropped, (w, h))

            except Exception as ex:
                logger.warning(f"Failed to unpad heatmap: {ex}")
                orig_bgr = _img_array_to_bgr(img_array)
                h, w = orig_bgr.shape[:2]
                heatmap_resized = cv2.resize(heatmap, (w, h))
        else:
            orig_bgr = _img_array_to_bgr(img_array)
            h, w = orig_bgr.shape[:2]
            heatmap_resized = cv2.resize(heatmap, (w, h))

        # Apply colormap
        heatmap_uint8   = np.uint8(255 * heatmap_resized)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

        # Use heatmap intensity as alpha mask so background (0) is fully transparent
        # and doesn't tint the medical image dark blue
        alpha = heatmap_resized[..., np.newaxis] * 0.6  # max 60% opacity
        superimposed = (orig_bgr * (1 - alpha) + heatmap_colored * alpha).astype(np.uint8)
        
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

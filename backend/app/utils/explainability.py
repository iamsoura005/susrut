"""
Grad-CAM explainability for Keras CNN models.
Returns a base64-encoded PNG of the heatmap overlaid on the input image.
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


def compute_gradcam(
    model,
    img_array: np.ndarray,
    last_conv_layer_name: Optional[str] = None,
    pred_index: Optional[int] = None,
) -> str:
    """
    Compute Grad-CAM heatmap and return base64 overlay.
    
    Args:
        model: Keras model
        img_array: preprocessed input array (1, H, W, C)
        last_conv_layer_name: name of the last conv layer (auto-detected if None)
        pred_index: class index to highlight (uses argmax if None)
    
    Returns:
        Base64-encoded PNG string of the overlay
    """
    try:
        import tensorflow as tf

        # Auto-detect last conv layer
        if last_conv_layer_name is None:
            for layer in reversed(model.layers):
                if isinstance(layer, (tf.keras.layers.Conv2D,)):
                    last_conv_layer_name = layer.name
                    break
            if last_conv_layer_name is None:
                logger.warning("No Conv2D layer found — returning plain image")
                return _plain_image_b64(img_array)

        # Build gradient model
        grad_model = tf.keras.models.Model(
            inputs=model.inputs,
            outputs=[model.get_layer(last_conv_layer_name).output, model.output],
        )

        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(img_array, training=False)
            if pred_index is None:
                pred_index = tf.argmax(predictions[0])
            class_channel = predictions[:, pred_index]

        grads = tape.gradient(class_channel, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]
        heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-8)
        heatmap = heatmap.numpy()

        # Original image for overlay
        orig = (img_array[0] * 255).astype(np.uint8)
        if orig.shape[-1] == 1:
            orig = cv2.cvtColor(orig, cv2.COLOR_GRAY2BGR)
        orig_bgr = cv2.cvtColor(orig, cv2.COLOR_RGB2BGR)

        h, w = orig_bgr.shape[:2]
        heatmap_resized = cv2.resize(heatmap, (w, h))
        heatmap_uint8 = np.uint8(255 * heatmap_resized)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
        superimposed = cv2.addWeighted(orig_bgr, 0.6, heatmap_colored, 0.4, 0)
        return _encode_image_to_b64(superimposed)

    except Exception as e:
        logger.error(f"Grad-CAM failed: {e}")
        return _plain_image_b64(img_array)


def _plain_image_b64(img_array: np.ndarray) -> str:
    """Fallback: return the input image as base64 without overlay."""
    orig = (img_array[0] * 255).astype(np.uint8)
    if orig.shape[-1] == 1:
        orig = cv2.cvtColor(orig, cv2.COLOR_GRAY2BGR)
    orig_bgr = cv2.cvtColor(orig, cv2.COLOR_RGB2BGR)
    return _encode_image_to_b64(orig_bgr)

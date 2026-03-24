"""
Confidence calibration — temperature scaling.

Raw softmax outputs from neural networks are often overconfident
(e.g. 98% for what should be 72%). Temperature scaling divides the
logits by T before softmax, pulling probabilities toward uniform.

T = 1.0  → no change (original softmax)
T > 1.0  → softer / more uncertain (recommended: 1.3–2.0)
T < 1.0  → harder / more confident (not recommended for medical use)

We apply calibration on the post-softmax probabilities using
the inverse-softmax → scale → re-softmax trick, since we don't
have direct access to logits after model.predict().
"""
import numpy as np

DEFAULT_TEMPERATURE = 1.5   # conservative default for medical AI


def calibrate_probs(probs: np.ndarray, temperature: float = DEFAULT_TEMPERATURE) -> np.ndarray:
    """
    Apply temperature scaling to a softmax probability vector.

    Args:
        probs:       1-D numpy array of softmax probabilities (sum ≈ 1.0)
        temperature: scaling factor T>1 reduces overconfidence

    Returns:
        Calibrated probability array (same shape, still sums to 1.0)
    """
    probs = np.asarray(probs, dtype=np.float64)
    probs = np.clip(probs, 1e-10, 1.0)          # avoid log(0)

    # Inverse softmax → log-space logits
    logits = np.log(probs)

    # Scale by temperature
    logits_scaled = logits / temperature

    # Re-apply softmax
    logits_shifted = logits_scaled - np.max(logits_scaled)
    exp_l = np.exp(logits_shifted)
    calibrated = exp_l / exp_l.sum()

    return calibrated.astype(np.float32)


def calibrate_result(probs: np.ndarray, temperature: float = DEFAULT_TEMPERATURE) -> dict:
    """
    Calibrate and return both the calibrated probs and key stats.

    Returns:
        {
          "probs": calibrated probability array,
          "confidence": float (max calibrated prob),
          "temperature": float,
          "calibrated": True
        }
    """
    cal = calibrate_probs(probs, temperature)
    return {
        "probs":       cal,
        "confidence":  float(np.max(cal)),
        "temperature": temperature,
        "calibrated":  True,
    }

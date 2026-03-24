"""
Uncertainty estimation from softmax probability distributions.
"""
import numpy as np


def entropy_uncertainty(probs: np.ndarray) -> dict:
    """
    Compute Shannon entropy as uncertainty measure.

    Args:
        probs: 1-D array of softmax probabilities

    Returns:
        dict with keys: entropy, normalized_entropy, is_uncertain, flag
    """
    probs = np.array(probs, dtype=np.float64)
    probs = np.clip(probs, 1e-9, 1.0)
    n = len(probs)
    raw_entropy = float(-np.sum(probs * np.log(probs)))
    max_entropy = float(np.log(n)) if n > 1 else 1.0
    normalized = raw_entropy / max_entropy if max_entropy > 0 else 0.0
    is_uncertain = normalized > 0.65  # threshold at 65 % of max entropy

    return {
        "entropy": round(raw_entropy, 4),
        "normalized_entropy": round(normalized, 4),
        "is_uncertain": is_uncertain,
        "flag": "⚠️ High Uncertainty — Consider Clinical Review" if is_uncertain else "✅ Confident Prediction",
    }

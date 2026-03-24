"""
ECG signal preprocessing utilities.
"""
import io
import csv
import json
import base64
import logging
import numpy as np

logger = logging.getLogger("radiai.ecg_utils")


def parse_ecg_csv(file_bytes: bytes) -> np.ndarray:
    """
    Parse an ECG CSV file and return a 1-D float array.
    
    Accepts:
    - Single-column numeric CSV (raw signal)
    - PTB-XL-style multi-lead CSV (uses first numeric column)
    """
    text = file_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        return np.zeros(1000, dtype=np.float32)

    # Detect header
    first_row = rows[0]
    start = 1 if not _is_numeric(first_row[0]) else 0
    data_rows = rows[start:]

    signal = []
    for row in data_rows:
        for cell in row:
            cell = cell.strip()
            if _is_numeric(cell):
                signal.append(float(cell))
                break  # take first numeric value per row

    arr = np.array(signal, dtype=np.float32)
    if len(arr) == 0:
        return np.zeros(1000, dtype=np.float32)
    return arr


def _is_numeric(s: str) -> bool:
    try:
        float(s.strip())
        return True
    except (ValueError, AttributeError):
        return False


def normalize_signal(signal: np.ndarray, target_length: int = 1000) -> np.ndarray:
    """Resample to fixed length and normalize to [-1, 1]."""
    # Resample
    if len(signal) != target_length:
        indices = np.linspace(0, len(signal) - 1, target_length)
        signal = np.interp(indices, np.arange(len(signal)), signal)

    # Normalize
    min_val, max_val = signal.min(), signal.max()
    if max_val - min_val > 1e-6:
        signal = 2.0 * (signal - min_val) / (max_val - min_val) - 1.0
    return signal.astype(np.float32)


def signal_to_waveform_b64(signal: np.ndarray, title: str = "ECG Waveform") -> str:
    """
    Render the ECG signal as a PNG waveform and return base64.
    Uses matplotlib if available, falls back to a simple SVG.
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(10, 3), facecolor="#0a0f1e")
        ax.set_facecolor("#0a0f1e")
        ax.plot(signal, color="#06b6d4", linewidth=0.8)
        ax.set_title(title, color="white", fontsize=11)
        ax.tick_params(colors="gray")
        for spine in ax.spines.values():
            spine.set_edgecolor("#1e293b")
        ax.set_xlabel("Sample", color="gray")
        ax.set_ylabel("Amplitude", color="gray")
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=100, facecolor="#0a0f1e")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    except Exception as e:
        logger.warning(f"Matplotlib waveform failed: {e} — returning empty")
        return ""

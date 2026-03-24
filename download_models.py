#!/usr/bin/env python3
"""
Script to download model weights from a remote source or Google Drive.
Place your model URLs here after uploading them to a file host.

Usage:
  pip install gdown requests
  python download_models.py
"""
import os

# ────────────────────────────────────────────────────────────────────────────
# Add your model download URLs below.
# Example using gdown for Google Drive files:
#   gdown.download(id="<DRIVE_FILE_ID>", output="BrainMRI.h5", quiet=False)
# ────────────────────────────────────────────────────────────────────────────

MODELS = {
    # "BrainMRI.h5":                     "https://your-storage/BrainMRI.h5",
    # "BEST_MODEL_EfficientNetB3_ChestCT.h5": "...",
    # "BEST_CustomCNN_HeadCT_Hemorrhage.h5": "...",
    # "bone_xray_model.h5":              "...",
    # "ECG PTBXL.h5":                   "...",
    # "modality_classifier.h5":         "...",
}

def main():
    if not MODELS:
        print("⚠️  No model URLs configured. Edit download_models.py and add your URLs.")
        return

    try:
        import requests
    except ImportError:
        print("Run: pip install requests")
        return

    for filename, url in MODELS.items():
        if os.path.exists(filename):
            print(f"✅ {filename} already exists, skipping.")
            continue
        print(f"⬇ Downloading {filename}…")
        r = requests.get(url, stream=True)
        r.raise_for_status()
        with open(filename, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"✅ {filename} downloaded.")

if __name__ == "__main__":
    main()

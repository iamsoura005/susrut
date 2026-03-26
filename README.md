---
title: Radiai Backend
emoji: 🚀
colorFrom: blue
colorTo: red
sdk: docker
pinned: false
---
# 🩻 RadiAI — Radiology Intelligence Platform

> A unified multi-modal AI platform for radiology analysis. Upload a medical image or ECG signal, receive an AI prediction with confidence, severity, Grad-CAM explainability, and a downloadable PDF report — all from one interface.

---

## Supported Modalities

| Modality | Model File | Classes |
|---|---|---|
| 🧠 Brain MRI | `BrainMRI.h5` | Glioma, Meningioma, Pituitary Tumor, No Tumor |
| 🫁 Chest CT | `BEST_MODEL_EfficientNetB3_ChestCT.h5` | COVID-19, Lung Opacity, Normal, Viral Pneumonia |
| 💀 Head CT | `BEST_CustomCNN_HeadCT_Hemorrhage.h5` | Hemorrhage, No Hemorrhage |
| 💓 ECG | `ECG PTBXL.h5` | NORM, MI, STTC, CD, HYP |
| 🦴 Bone X-Ray | *(stub — no weights)*| Normal, Fractured |

---

## Project Structure

```
Susrut Project/
├── BrainMRI.h5                     # Keras model — Brain MRI
├── BEST_MODEL_EfficientNetB3_ChestCT.h5
├── BEST_CustomCNN_HeadCT_Hemorrhage.h5
├── ECG PTBXL.h5
├── evaluation_summaryBrainMRI.csv
├── evaluation_summaryCHESTCT.csv
├── headCT.csv
│
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app entry point
│   │   ├── api/routes.py          # All API endpoints
│   │   ├── models/                # One module per modality
│   │   │   ├── brain_mri.py
│   │   │   ├── chest_ct.py
│   │   │   ├── head_ct.py
│   │   │   ├── ecg.py
│   │   │   └── bone_xray.py       # Stub
│   │   ├── preprocessing/
│   │   │   ├── image_utils.py
│   │   │   └── ecg_utils.py
│   │   ├── services/
│   │   │   ├── modality_router.py
│   │   │   ├── history_store.py
│   │   │   ├── report_generator.py
│   │   │   └── gemini_service.py    # NEW — Gemini AI explanation layer
│   │   └── utils/
│   │       ├── explainability.py  # Grad-CAM
│   │       └── uncertainty.py     # Shannon entropy
│   ├── data/                      # history.json stored here
│   ├── outputs/                   # Generated PDFs
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts                 # API types + fetch helpers
    │   └── components/
    │       ├── UploadZone.tsx
    │       ├── ResultCard.tsx
    │       ├── ExplainabilityPanel.tsx
    │       ├── HistoryPage.tsx
    │       ├── Navbar.tsx
    │       └── ModelsStatusPage.tsx
    └── .env.example
```

---

## Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend

```powershell
cd backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1     # Windows
# source venv/bin/activate      # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy env file (optional — defaults work out of the box)
copy .env.example .env

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

> **Note:** Models are loaded from the parent directory (`../`). The .h5 files must stay in the `Susrut Project/` root.

---

## ✨ Gemini AI Integration

RadiAI uses **Google Gemini 1.5 Flash** as a natural-language *explanation layer* on top of existing ML predictions.

> Gemini is **not** used for classification. The ML model is the sole source of the prediction. Gemini only explains, summarizes, and provides a risk assessment in plain language.

### Setup

1. Get a free API key at **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**
2. Open `backend/.env` and set:
   ```
   GEMINI_API_KEY=your_actual_key_here
   ```
3. Ensure the SDK is installed (already in `requirements.txt`):
   ```powershell
   pip install google-generativeai
   ```

### What Gemini adds

| Feature | Where |
|---|---|
| Detailed explanation of the condition | API response + PDF report |
| Quick one-sentence summary | API response + PDF (highlighted box) |
| Risk level (Low / Medium / High) | API response + PDF badge + Frontend card |
| Key findings bullet list | API response + PDF + Frontend |

### Fallback behaviour

If `GEMINI_API_KEY` is not set, or the Gemini API call fails for any reason, the pipeline continues normally — the ML prediction is returned unchanged with a stub `gemini` object. **The API never returns a 500 error due to Gemini failure.**


### 2. Frontend

```powershell
cd frontend

# Copy env (optional)
copy .env.example .env.local

# Install and start
npm install
npm run dev
```

Open `http://localhost:5173`

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Service health check |
| `/api/analyze` | POST | Upload file + get full analysis JSON |
| `/api/report/{id}` | GET | Download PDF report |
| `/api/history` | GET | List past analyses |
| `/api/history` | DELETE | Clear all history |
| `/api/models/status` | GET | Check loaded model status |

### Example: Analyze a file

```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "file=@brain_scan.jpg" | python -m json.tool
```

With modality override:
```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "file=@scan.jpg" \
  -F "modality_override=head_ct"
```

### Response shape

```json
{
  "modality": "brain_mri",
  "prediction": "glioma",
  "confidence": 0.9231,
  "class_probabilities": { "glioma": 0.9231, "meningioma": 0.04, ... },
  "severity": { "level": "High", "score": 0.784, "description": "..." },
  "uncertainty": { "is_uncertain": false, "normalized_entropy": 0.21, "flag": "✅ Confident Prediction" },
  "explainability": { "type": "gradcam_overlay", "image_b64": "...", "description": "..." },
  "gemini": {
    "detailed_explanation": "Glioma is a type of tumour that arises from glial cells...",
    "short_summary": "High-confidence glioma detected; prompt specialist review advised.",
    "risk_level": "High",
    "key_findings": ["Irregular mass in right temporal lobe", "High signal intensity", "Surrounding oedema"]
  },
  "stub": false,
  "report_id": "abc-123-...",
  "report_url": "/api/report/abc-123-..."
}
```

---

## Modality Auto-Detection

The system detects modality from:
1. **Filename keywords** — e.g. `brain_mri_001.jpg` → `brain_mri`
2. **File extension** — `.csv`, `.dat`, `.edf` → `ecg`
3. **Image dimensions** — square small → `brain_mri`, large → `chest_ct`, landscape → `bone_xray`
4. **User override** — pills in the UI or `modality_override` form field

---

## Known Limitations & TODOs

| Item | Status |
|---|---|
| Bone X-Ray model | ⚠ Stub — needs `bone_xray_model.h5` in project root |
| Brain MRI segmentation | Grad-CAM used as proxy (no Swin-UNet weights locally) |
| ECG input shape | Auto-detected but may need adjusting for custom PTB-XL builds |
| MongoDB history | Falls back to `data/history.json` — MongoDB not required |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: tensorflow` | Run `pip install tensorflow` inside the venv |
| `CORS error` in browser | Ensure backend is on port 8000; check `.env.local` `VITE_API_URL` |
| `Model not found` warning | Confirm .h5 files are in the `Susrut Project/` root, not inside `backend/` |
| Port conflict | Change `--port 8000` to any free port and update `VITE_API_URL` |
| `fpdf2` ImportError | Run `pip install fpdf2` |
| Gemini not responding | Check `GEMINI_API_KEY` in `backend/.env`; get key from [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| Gemini output missing from PDF | Ensure Gemini returns valid JSON — check backend logs for `Gemini Error:` |

---

## Disclaimer

This project is for **research and educational purposes only**. It does not constitute medical advice and must not be used for clinical diagnosis or treatment. Always consult a qualified healthcare professional.

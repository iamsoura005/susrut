"""
RadiAI API routes — all endpoints.
"""
import asyncio
import logging
import os
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from app.models import brain_mri, chest_ct, head_ct, ecg, bone_xray
from app.services.modality_classifier import classify as classify_modality
from app.services.report_generator import generate_report
from app.services import history_store

logger = logging.getLogger("radiai.routes")

router = APIRouter()

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024
MAX_BATCH_FILES  = int(os.getenv("MAX_BATCH_FILES", "20"))
OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"

_SUPPORTED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif",
    ".dcm", ".dicom",
    ".csv", ".txt", ".dat", ".edf",
}


# ── Health ────────────────────────────────────────────────────────────────────
@router.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "RadiAI API", "version": "1.1.0"}


# ── Models Status ──────────────────────────────────────────────────────────────
@router.get("/models/status", tags=["System"])
def models_status():
    import tensorflow as tf
    from app.models.registry import get_status
    return {
        "models": get_status(),
        "tensorflow_version": tf.__version__,
    }


# ── Single Analyze ─────────────────────────────────────────────────────────────
@router.post("/analyze", tags=["Inference"])
async def analyze(
    file: UploadFile = File(...),
    modality_override: Optional[str] = Form(None),
    patient_id:        Optional[str] = Form(None),
    radiologist_name:  Optional[str] = Form(None),
    clinical_notes:    Optional[str] = Form(None),
):
    """
    Upload any supported file and receive a full analysis result.
    Modality is auto-detected unless modality_override is provided.
    Optional patient metadata is included in the PDF report.
    """
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_BYTES // (1024*1024)} MB limit")

    ext = Path(file.filename or "").suffix.lower()
    if ext and ext not in _SUPPORTED_EXTENSIONS:
        raise HTTPException(
            415,
            f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(_SUPPORTED_EXTENSIONS))}",
        )

    if not content:
        raise HTTPException(400, "Empty file uploaded")

    # Auto-extract DICOM metadata to pre-populate patient fields
    dicom_meta = {}
    if ext in {".dcm", ".dicom"}:
        try:
            from app.preprocessing.dicom_utils import extract_metadata
            dicom_meta = extract_metadata(content)
        except Exception:
            pass

    patient_meta = {
        "patient_id":       patient_id       or dicom_meta.get("patient_id", ""),
        "radiologist_name": radiologist_name or "",
        "clinical_notes":   clinical_notes  or "",
        "dicom_meta":       dicom_meta,
    }

    # Detect modality
    if modality_override:
        modality, modality_confidence = modality_override, 1.0
    else:
        modality, modality_confidence = classify_modality(
            content, file.filename or "upload", file.content_type or ""
        )

    # Run inference
    try:
        result = _run_inference(modality, content, file.filename or "upload")
    except Exception as e:
        logger.exception(f"Inference failed: {e}")
        raise HTTPException(500, f"Inference failed: {str(e)}")

    result["modality_confidence"] = round(modality_confidence, 4)

    # Generate structured PDF report
    report_id, report_path = generate_report(result, file.filename or "upload", patient_meta)
    result["report_id"]  = report_id
    result["report_url"] = f"/api/report/{report_id}"

    history_store.add_record(result, file.filename or "upload", report_path)
    return result


# ── Batch Analyze ──────────────────────────────────────────────────────────────
@router.post("/analyze/batch", tags=["Inference"])
async def analyze_batch(
    files: List[UploadFile] = File(...),
    modality_override: Optional[str] = Form(None),
    patient_id:        Optional[str] = Form(None),
    radiologist_name:  Optional[str] = Form(None),
):
    """
    Analyze multiple files simultaneously.
    Returns a list of results — errors are isolated per-file.
    """
    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(400, f"Maximum {MAX_BATCH_FILES} files per batch")

    async def _process_one(upload: UploadFile) -> dict:
        try:
            content = await upload.read()
            if not content or len(content) > MAX_UPLOAD_BYTES:
                return {"filename": upload.filename, "error": "File too large or empty", "stub": True}

            if modality_override:
                modality = modality_override
                mod_conf = 1.0
            else:
                modality, mod_conf = classify_modality(
                    content, upload.filename or "upload", upload.content_type or ""
                )

            result = _run_inference(modality, content, upload.filename or "upload")
            result["filename"] = upload.filename
            result["modality_confidence"] = round(mod_conf, 4)

            patient_meta = {
                "patient_id": patient_id or "",
                "radiologist_name": radiologist_name or "",
                "clinical_notes": "",
            }
            report_id, report_path = generate_report(result, upload.filename or "upload", patient_meta)
            result["report_id"]  = report_id
            result["report_url"] = f"/api/report/{report_id}"
            history_store.add_record(result, upload.filename or "upload", report_path)
            return result
        except Exception as e:
            logger.error(f"Batch error for {upload.filename}: {e}")
            return {"filename": upload.filename, "error": str(e), "stub": True}

    results = await asyncio.gather(*[_process_one(f) for f in files])

    severity_counts = {}
    for r in results:
        s = r.get("severity", {}).get("level", "Unknown")
        severity_counts[s] = severity_counts.get(s, 0) + 1

    return {
        "total":           len(results),
        "severity_counts": severity_counts,
        "results":         results,
    }


# ── Internal inference router ─────────────────────────────────────────────────
def _run_inference(modality: str, content: bytes, filename: str) -> dict:
    if modality == "brain_mri":
        return brain_mri.predict(content)
    elif modality == "chest_ct":
        return chest_ct.predict(content)
    elif modality == "head_ct":
        return head_ct.predict(content)
    elif modality == "ecg":
        return ecg.predict(content, filename=filename)
    elif modality == "bone_xray":
        return bone_xray.predict(content)
    else:
        raise ValueError(f"Unknown modality: {modality}")


# ── Report Download ───────────────────────────────────────────────────────────
@router.get("/report/{report_id}", tags=["Reports"])
def download_report(report_id: str):
    safe_id  = "".join(c for c in report_id if c.isalnum() or c == "-")
    pdf_path = OUTPUTS_DIR / f"report_{safe_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(404, f"Report '{report_id}' not found")
    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=f"radiai_report_{safe_id[:8]}.pdf",
    )


# ── History ───────────────────────────────────────────────────────────────────
@router.get("/history", tags=["History"])
def get_history(limit: int = 50):
    records = history_store.get_all(limit=min(limit, 100))
    return {"total": len(records), "records": records}


@router.delete("/history", tags=["History"])
def clear_history():
    history_store._save_all([])
    return {"message": "History cleared"}


@router.get("/history/trends", tags=["History"])
def history_trends(patient_id: str = ""):
    """
    Return time-series data for confidence + severity score.
    If patient_id is provided, filter to that patient's records only.
    """
    if patient_id:
        records = history_store.get_by_patient_id(patient_id)
    else:
        records = list(reversed(history_store.get_all(limit=200)))

    points = []
    for r in records:
        points.append({
            "timestamp":     r.get("timestamp", ""),
            "modality":      r.get("modality", ""),
            "prediction":    r.get("prediction", ""),
            "confidence":    round(r.get("confidence", 0.0) * 100, 1),  # as %
            "severity_score":round(r.get("severity_score", 0.0), 3),
            "severity_level":r.get("severity_level", "Unknown"),
            "filename":      r.get("filename", ""),
        })

    return {
        "patient_id": patient_id or "all",
        "total":      len(points),
        "points":     points,
    }


# ── Feedback ──────────────────────────────────────────────────────────────────
@router.post("/feedback", tags=["Feedback"])
async def submit_feedback(
    report_id:          str = Form(...),
    was_correct:        bool = Form(...),
    original_modality:  str = Form(""),
    original_prediction:str = Form(""),
    correct_modality:   str = Form(""),
    correct_label:      str = Form(""),
    comment:            str = Form(""),
):
    """Save user feedback on a prediction to feedback.jsonl for future fine-tuning."""
    feedback_id = history_store.save_feedback({
        "report_id":           report_id,
        "was_correct":         was_correct,
        "original_modality":   original_modality,
        "original_prediction": original_prediction,
        "correct_modality":    correct_modality,
        "correct_label":       correct_label,
        "comment":             comment,
    })
    return {"feedback_id": feedback_id, "message": "Feedback saved — thank you!"}


@router.get("/feedback", tags=["Feedback"])
def get_feedback():
    """Return all collected feedback entries (for admin review)."""
    entries = history_store.get_all_feedback()
    return {"total": len(entries), "entries": entries}


# ── Debug ─────────────────────────────────────────────────────────────────────
@router.get("/debug", tags=["System"])
def debug_info():
    """
    Returns full system state for debugging:
    - Model load statuses
    - Modality classifier state
    - Class names & model path
    - Environment info
    """
    import sys
    import tensorflow as tf
    from app.models.registry import get_status
    from app.services import modality_classifier as mc

    return {
        "status": "ok",
        "python_version": sys.version,
        "tensorflow_version": tf.__version__,
        "models": get_status(),
        "modality_classifier": {
            "model_path": str(mc.MODEL_PATH),
            "model_exists": mc.MODEL_PATH.exists(),
            "model_loaded": mc._model is not None,
            "class_names": mc.CLASS_NAMES,
            "confidence_threshold": mc.ML_CONFIDENCE_THRESHOLD,
        },
        "outputs_dir": str(OUTPUTS_DIR),
        "outputs_dir_exists": OUTPUTS_DIR.exists(),
    }

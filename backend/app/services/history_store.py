"""
History store — JSON-based local storage for analysis records.
Also houses the feedback store (JSONL append-only file).
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("radiai.history")

DATA_DIR     = Path(__file__).parent.parent.parent / "data"
HISTORY_FILE = DATA_DIR / "history.json"
FEEDBACK_FILE = DATA_DIR / "feedback.jsonl"


def _load_all() -> list[dict]:
    try:
        if HISTORY_FILE.exists():
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read history: {e}")
    return []


def _save_all(records: list[dict]):
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Failed to save history: {e}")


def add_record(analysis_result: dict, filename: str, report_path: str = "",
               patient_id: str = "") -> str:
    """Persist a new analysis to history. Returns the generated record ID."""
    records = _load_all()
    record_id = str(uuid.uuid4())
    record = {
        "id":             record_id,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "filename":       filename,
        "patient_id":     patient_id or "",
        "modality":       analysis_result.get("modality", "unknown"),
        "prediction":     analysis_result.get("prediction", ""),
        "confidence":     analysis_result.get("confidence", 0.0),
        "severity_level": analysis_result.get("severity", {}).get("level", "Unknown"),
        "severity_score": analysis_result.get("severity", {}).get("score", 0.0),
        "is_uncertain":   analysis_result.get("uncertainty", {}).get("is_uncertain", False),
        "stub":           analysis_result.get("stub", False),
        "report_path":    report_path,
        "report_id":      analysis_result.get("report_id", ""),
    }
    records.insert(0, record)
    records = records[:200]     # keep last 200
    _save_all(records)
    return record_id


def get_all(limit: int = 50) -> list[dict]:
    """Return most recent analyses."""
    return _load_all()[:limit]


def get_by_id(record_id: str) -> dict | None:
    for r in _load_all():
        if r.get("id") == record_id:
            return r
    return None


def get_by_patient_id(patient_id: str) -> list[dict]:
    """Return all records for a given patient ID, oldest first (for charting)."""
    pid = patient_id.strip().lower()
    return [r for r in reversed(_load_all()) if r.get("patient_id", "").lower() == pid]


def save_feedback(feedback: dict) -> str:
    """
    Append a feedback entry to feedback.jsonl.
    Returns the feedback ID.
    """
    feedback_id = str(uuid.uuid4())
    entry = {
        "id":               feedback_id,
        "timestamp":        datetime.now(timezone.utc).isoformat(),
        "report_id":        feedback.get("report_id", ""),
        "was_correct":      feedback.get("was_correct", None),
        "correct_modality": feedback.get("correct_modality", ""),
        "correct_label":    feedback.get("correct_label", ""),
        "comment":          feedback.get("comment", ""),
        "original_modality":   feedback.get("original_modality", ""),
        "original_prediction": feedback.get("original_prediction", ""),
    }
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        logger.info(f"✅ Feedback saved: {feedback_id}")
    except Exception as e:
        logger.error(f"Failed to save feedback: {e}")
    return feedback_id


def get_all_feedback() -> list[dict]:
    """Return all feedback entries."""
    entries = []
    try:
        if FEEDBACK_FILE.exists():
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        entries.append(json.loads(line))
    except Exception as e:
        logger.error(f"Failed to read feedback: {e}")
    return entries


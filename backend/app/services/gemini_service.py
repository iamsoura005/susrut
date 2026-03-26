"""
Gemini AI service — explanation & report generation layer.

This module NEVER classifies or diagnoses.
It uses Gemini 2.0 Flash to generate human-readable explanations of
existing ML predictions. All errors are contained here: the pipeline
continues with a graceful stub if Gemini is unavailable or misconfigured.
"""
import io
import json
import logging
import os
import re

logger = logging.getLogger("radiai.gemini")

# ── Lazy initialisation so import doesn't crash if SDK is absent ──────────────
_sdk_available = False

try:
    from google import genai
    from google.genai import types
    from PIL import Image as PILImage
    _sdk_available = True
except ImportError:
    logger.warning(
        "google-genai or Pillow not installed — Gemini service disabled. "
        "Run: pip install google-genai pillow"
    )


def _build_prompt(prediction_data: dict) -> str:
    label      = prediction_data.get("prediction") or prediction_data.get("label", "Unknown")
    confidence = prediction_data.get("confidence", 0.0)
    modality   = prediction_data.get("modality", "Unknown").replace("_", " ")
    severity   = ""
    sev_obj    = prediction_data.get("severity")
    if isinstance(sev_obj, dict):
        severity = f"\nSeverity: {sev_obj.get('level', '')} ({sev_obj.get('description', '')})"

    return f"""You are a medical AI assistant writing a report for a radiologist to review.
The following prediction was made by a validated ML model — treat it as accurate.

Prediction : {label}
Confidence : {confidence:.1%}
Modality   : {modality}{severity}

Your tasks:
1. Explain what this condition means in simple, clear language (3-5 sentences).
2. Describe what findings might be visible on such an image for this condition.
3. Assess risk level as exactly one of: Low | Medium | High
4. List 3-5 concise key findings (bullet points).
5. Provide a one-sentence quick summary suitable for a non-specialist.

Respond ONLY with valid JSON — no markdown fences, no extra text — in this exact shape:
{{
  "detailed_explanation": "...",
  "short_summary": "...",
  "risk_level": "Low|Medium|High",
  "key_findings": ["...", "...", "..."]
}}"""


def _parse_gemini_response(text: str) -> dict:
    """Extract and parse JSON from Gemini response text."""
    text = re.sub(r"```(?:json)?", "", text).strip()
    json_start = text.find("{")
    json_end   = text.rfind("}") + 1
    if json_start == -1 or json_end == 0:
        raise ValueError("No JSON object found in Gemini response")
    return json.loads(text[json_start:json_end])


def _fallback(reason: str = "Gemini analysis unavailable") -> dict:
    return {
        "detailed_explanation": reason,
        "short_summary":        "AI explanation unavailable for this analysis.",
        "risk_level":           "Unknown",
        "key_findings":         [],
    }


def generate_gemini_report(image_bytes: bytes, prediction_data: dict) -> dict:
    """
    Generate a Gemini-powered explanation for an ML prediction.

    Args:
        image_bytes:     Raw bytes of the uploaded medical image file.
        prediction_data: Dict containing at minimum: prediction/label, confidence, modality.
                         Optionally: severity dict.

    Returns:
        Dict with keys: detailed_explanation, short_summary, risk_level, key_findings.
        Always returns a valid dict — never raises.
    """
    if not _sdk_available:
        return _fallback("Gemini SDK not installed")

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — skipping Gemini analysis")
        return _fallback("GEMINI_API_KEY not configured")

    try:
        client = genai.Client(api_key=api_key)
        prompt = _build_prompt(prediction_data)

        # Build content parts — try multimodal first, fall back to text-only
        content_parts = [prompt]
        try:
            pil_image = PILImage.open(io.BytesIO(image_bytes))
            if pil_image.mode not in ("RGB", "L"):
                pil_image = pil_image.convert("RGB")
            content_parts = [prompt, pil_image]
        except Exception:
            pass  # CSV/ECG — text-only prompt

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=content_parts,
        )

        parsed = _parse_gemini_response(response.text)

        # Ensure all keys present
        for key in ("detailed_explanation", "short_summary", "risk_level", "key_findings"):
            if key not in parsed:
                parsed[key] = "" if key != "key_findings" else []

        # Normalise risk level
        rl = str(parsed.get("risk_level", "")).strip().title()
        if rl not in ("Low", "Medium", "High"):
            rl = "Unknown"
        parsed["risk_level"] = rl

        logger.info(f"Gemini report generated — risk_level={parsed['risk_level']}")
        return parsed

    except Exception as exc:
        logger.error(f"Gemini generation failed: {exc}")
        return _fallback(f"Gemini analysis failed: {type(exc).__name__}")

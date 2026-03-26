"""
PDF report generator — structured A4 medical report with patient metadata.
"""
import base64
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger("radiai.report")

OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"

try:
    from fpdf import FPDF, XPos, YPos
    _FPDF_AVAILABLE = True
except ImportError:
    _FPDF_AVAILABLE = False
    logger.warning("fpdf2 not installed — PDF generation disabled. Run: pip install fpdf2")


def generate_report(
    analysis: dict,
    filename: str,
    patient_meta: dict | None = None,
) -> tuple[str, str]:
    """
    Generate a structured A4 PDF report.

    Args:
        analysis:     Result dict from any model module.
        filename:     Original uploaded filename.
        patient_meta: Optional dict with patient_id, radiologist_name, clinical_notes, dicom_meta.

    Returns:
        (report_id, absolute_path_to_pdf)
    """
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    report_id   = str(uuid.uuid4())
    report_path = OUTPUTS_DIR / f"report_{report_id}.pdf"
    meta        = patient_meta or {}

    if not _FPDF_AVAILABLE:
        logger.error("fpdf2 not installed — cannot generate PDF")
        return report_id, ""

    try:
        pdf = FPDF(format="A4")
        pdf.set_margins(15, 15, 15)
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=20)

        # ── Header banner ──────────────────────────────────────────────────────
        pdf.set_fill_color(10, 15, 30)
        pdf.rect(0, 0, 210, 44, "F")

        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(6, 182, 212)
        pdf.set_xy(15, 9)
        pdf.cell(130, 10, "RadiAI — Radiology Intelligence Report")

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(150, 160, 180)
        timestamp = datetime.now(timezone.utc).strftime("%d %b %Y  %H:%M UTC")
        pdf.set_xy(15, 22)
        pdf.cell(0, 5, f"Report ID: {report_id[:8]}   |   Generated: {timestamp}")
        pdf.set_xy(15, 29)
        pdf.cell(0, 5, f"File: {filename}")

        # Version watermark top-right
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(80, 90, 110)
        pdf.set_xy(150, 9)
        pdf.cell(45, 5, "For research use only", align="R")
        pdf.set_xy(150, 15)
        pdf.cell(45, 5, "Not for clinical diagnosis", align="R")

        pdf.ln(20)  # after header

        # ── Patient Information block ──────────────────────────────────────────
        pid   = meta.get("patient_id", "").strip()
        rname = meta.get("radiologist_name", "").strip()
        notes = meta.get("clinical_notes", "").strip()
        dmeta = meta.get("dicom_meta", {})

        has_patient_info = any([pid, rname, notes, dmeta])
        if has_patient_info:
            _section(pdf, "Patient Information")
            _two_col_row(pdf, "Patient ID",       pid   or "—",
                              "Radiologist",      rname or "—")
            if dmeta.get("patient_name"):
                _two_col_row(pdf, "Patient Name",  str(dmeta["patient_name"]),
                                  "Study Date",   dmeta.get("study_date", "—"))
            if dmeta.get("institution"):
                _two_col_row(pdf, "Institution",  dmeta.get("institution", "—"),
                                  "Modality Tag", dmeta.get("modality_tag", "—"))
            if dmeta.get("series_desc"):
                _kv(pdf, "Series Description", dmeta["series_desc"])
            if notes:
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(80, 80, 100)
                pdf.cell(55, 6, "Clinical Notes:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(20, 20, 40)
                pdf.multi_cell(0, 6, notes)
            pdf.ln(2)

        # ── Analysis Summary ───────────────────────────────────────────────────
        _section(pdf, "Analysis Summary")
        modality   = analysis.get("modality", "unknown").replace("_", " ").upper()
        prediction = analysis.get("prediction", "N/A")
        confidence = analysis.get("confidence", 0.0)
        calibrated = analysis.get("calibrated", False)
        cal_temp   = analysis.get("calibration_temperature", "N/A")
        mod_conf   = analysis.get("modality_confidence", None)
        stub       = analysis.get("stub", False)

        conf_label = f"{confidence:.1%}"
        if calibrated:
            conf_label += f"  (calibrated, T={cal_temp})"

        _two_col_row(pdf, "Modality", modality, "Prediction", prediction)
        _two_col_row(pdf, "Confidence", conf_label,
                          "Modality Detected At", f"{mod_conf:.0%}" if mod_conf is not None else "—")
        if stub:
            _kv(pdf, "⚠ Status", "STUB — Model weights not loaded")

        # ── Severity ───────────────────────────────────────────────────────────
        sev = analysis.get("severity", {})
        if sev:
            pdf.ln(3)
            _section(pdf, "Severity Assessment")
            _two_col_row(pdf, "Level", sev.get("level", "Unknown"),
                              "Score", f"{sev.get('score', 0):.3f}")
            _kv(pdf, "Description", sev.get("description", ""))

        # ── Uncertainty ────────────────────────────────────────────────────────
        unc = analysis.get("uncertainty", {})
        if unc:
            pdf.ln(3)
            _section(pdf, "Uncertainty")
            _two_col_row(pdf, "Flag",              unc.get("flag", ""),
                              "Normalized Entropy", f"{unc.get('normalized_entropy', 0):.4f}")

        # ── Class Probabilities ────────────────────────────────────────────────
        cp = analysis.get("class_probabilities", {})
        if cp:
            pdf.ln(3)
            _section(pdf, "Class Probabilities")
            items = list(cp.items())
            for i in range(0, len(items), 2):
                if i + 1 < len(items):
                    _two_col_row(pdf,
                        items[i][0],   f"{items[i][1]:.2%}",
                        items[i+1][0], f"{items[i+1][1]:.2%}")
                else:
                    _kv(pdf, items[i][0], f"{items[i][1]:.2%}")

        # ── Explainability image ───────────────────────────────────────────────
        expl    = analysis.get("explainability", {})
        img_b64 = expl.get("image_b64", "")
        if img_b64:
            try:
                img_bytes = base64.b64decode(img_b64)
                img_path  = OUTPUTS_DIR / f"heatmap_{report_id}.png"
                img_path.write_bytes(img_bytes)
                pdf.ln(3)
                _section(pdf, f"Explainability — {expl.get('type','').replace('_',' ').title()}")
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(100, 100, 130)
                pdf.multi_cell(0, 5, expl.get("description", ""))
                pdf.ln(2)
                y = pdf.get_y()
                if y > 230:
                    pdf.add_page()
                    y = pdf.get_y()
                pdf.image(str(img_path), x=15, y=y, w=85)
                pdf.ln(90)
                img_path.unlink(missing_ok=True)
            except Exception as img_err:
                logger.warning(f"Could not embed heatmap: {img_err}")

        # ── Gemini AI Explanation ──────────────────────────────────────────────
        gemini = analysis.get("gemini", {})
        g_explanation = gemini.get("detailed_explanation", "") if gemini else ""
        g_is_real = g_explanation and "failed" not in g_explanation.lower() and "unavailable" not in g_explanation.lower()
        if g_is_real:
            pdf.ln(4)
            _section(pdf, "AI Detailed Explanation  (Gemini 1.5 Flash)")

            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(20, 20, 40)
            pdf.multi_cell(0, 6, g_explanation)
            pdf.ln(3)

            # Key findings as bullet list
            findings = gemini.get("key_findings", [])
            if findings:
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(6, 182, 212)
                pdf.cell(0, 6, "Key Findings:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(20, 20, 40)
                for finding in findings:
                    pdf.cell(5, 5, "")
                    pdf.multi_cell(0, 5, f"\u2022  {finding}")

            # Risk level badge (coloured pill)
            risk = gemini.get("risk_level", "Unknown")
            pdf.ln(3)
            risk_colors = {
                "Low":     (16, 185, 129),   # emerald-500
                "Medium":  (245, 158, 11),   # amber-500
                "High":    (239, 68, 68),    # red-500
                "Unknown": (107, 114, 128),  # gray-500
            }
            r, g, b = risk_colors.get(risk, risk_colors["Unknown"])
            pdf.set_fill_color(r, g, b)
            pdf.set_text_color(255, 255, 255)
            pdf.set_font("Helvetica", "B", 9)
            risk_label = f"  Risk Level: {risk}  "
            pdf.cell(len(risk_label) * 2.4, 7, risk_label, fill=True,
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.ln(5)

            # Quick Summary — highlighted pale-blue box
            summary = gemini.get("short_summary", "")
            if summary:
                _section(pdf, "Quick Summary")
                import math
                summary_y = pdf.get_y()
                estimated_lines = max(2, math.ceil(len(summary) / 85))
                box_h = estimated_lines * 6 + 8
                if summary_y + box_h > 270:
                    pdf.add_page()
                    summary_y = pdf.get_y()
                pdf.set_fill_color(224, 247, 255)
                pdf.rect(15, summary_y, 180, box_h, "F")
                pdf.set_xy(18, summary_y + 3)
                pdf.set_text_color(5, 80, 120)
                pdf.set_font("Helvetica", "I", 9)
                pdf.multi_cell(174, 6, summary)
                pdf.ln(3)

        # ── Page number footer ─────────────────────────────────────────────────
        pdf.set_y(-25)
        pdf.set_draw_color(30, 40, 60)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(2)
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(140, 140, 160)
        pdf.multi_cell(
            0, 4,
            "DISCLAIMER: This report is generated by an AI system for research and educational purposes only. "
            "It does not constitute medical advice and must not be used for clinical diagnosis or treatment. "
            "Always consult a qualified healthcare professional.",
        )

        pdf.output(str(report_path))
        logger.info(f"✅ Report saved: {report_path}")
        return report_id, str(report_path)

    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        return report_id, ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _section(pdf, title: str):
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(6, 182, 212)
    pdf.cell(0, 8, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_draw_color(6, 182, 212)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(2)
    pdf.set_text_color(20, 20, 40)


def _kv(pdf, key: str, value: str):
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(80, 80, 100)
    pdf.cell(55, 6, f"{key}:", new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(20, 20, 40)
    pdf.multi_cell(0, 6, str(value), new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def _two_col_row(pdf, k1: str, v1: str, k2: str, v2: str):
    """Render two key-value pairs side-by-side in a two-column layout."""
    col_w = 85
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(80, 80, 100)
    pdf.cell(30, 6, f"{k1}:", new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(20, 20, 40)
    pdf.cell(col_w - 30, 6, str(v1)[:50], new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(80, 80, 100)
    pdf.cell(30, 6, f"{k2}:", new_x=XPos.RIGHT, new_y=YPos.LAST)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(20, 20, 40)
    pdf.cell(0, 6, str(v2)[:50], new_x=XPos.LMARGIN, new_y=YPos.NEXT)

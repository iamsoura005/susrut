"""
Professional medical PDF report generator — built with ReportLab.
Produces a structured A4 report with header, patient info, prediction
results, severity (color-coded), Grad-CAM heatmap, and disclaimer.
"""
import base64
import logging
import os
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

logger = logging.getLogger("radiai.report")

OUTPUTS_DIR = Path(__file__).parent.parent.parent / "outputs"

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.utils import ImageReader
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Image,
        Table, TableStyle, HRFlowable,
    )
    _RL_AVAILABLE = True
except ImportError:
    _RL_AVAILABLE = False
    logger.warning("reportlab not installed — PDF generation disabled. Run: pip install reportlab")


# ─── Colour palette ───────────────────────────────────────────────────────────
_DARK_NAVY   = colors.HexColor("#0A0F1E")
_CYAN        = colors.HexColor("#06B6D4")
_WHITE       = colors.white
_LIGHT_GREY  = colors.HexColor("#F8F9FA")
_BORDER_GREY = colors.HexColor("#CBD5E1")
_TEXT_DARK   = colors.HexColor("#1E293B")
_TEXT_DIM    = colors.HexColor("#64748B")

_SEVERITY_COLOR = {
    "low":      colors.HexColor("#16A34A"),
    "medium":   colors.HexColor("#D97706"),
    "high":     colors.HexColor("#DC2626"),
    "critical": colors.HexColor("#7C3AED"),
}


def generate_report(
    analysis: dict,
    filename: str,
    patient_meta: dict | None = None,
) -> tuple[str, str]:
    """
    Generate a professional A4 PDF report.

    Args:
        analysis:     Result dict from any model module.
        filename:     Original uploaded filename.
        patient_meta: Optional dict with patient_id, radiologist_name,
                      clinical_notes, dicom_meta.

    Returns:
        (report_id, absolute_path_to_pdf)
    """
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    report_id   = str(uuid.uuid4())
    report_path = OUTPUTS_DIR / f"report_{report_id}.pdf"
    meta        = patient_meta or {}

    if not _RL_AVAILABLE:
        logger.error("reportlab not installed — cannot generate PDF")
        return report_id, ""

    try:
        doc = SimpleDocTemplate(
            str(report_path),
            pagesize=A4,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.75 * inch,
        )

        styles  = getSampleStyleSheet()
        elems   = []

        # ── Styles ────────────────────────────────────────────────────────────
        title_style = ParagraphStyle(
            "RadiAITitle",
            parent=styles["Title"],
            fontSize=20,
            textColor=_DARK_NAVY,
            spaceAfter=2,
        )
        subtitle_style = ParagraphStyle(
            "RadiAISub",
            parent=styles["Normal"],
            fontSize=9,
            textColor=_TEXT_DIM,
            spaceAfter=12,
        )
        section_style = ParagraphStyle(
            "Section",
            parent=styles["Heading2"],
            fontSize=12,
            textColor=_CYAN,
            spaceBefore=12,
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=9,
            textColor=_TEXT_DARK,
            leading=14,
        )

        # ── Header ────────────────────────────────────────────────────────────
        elems.append(Paragraph("🩻 RadiAI — AI Radiology Diagnostic Report", title_style))
        ts = datetime.now(timezone.utc).strftime("%d %B %Y  •  %H:%M UTC")
        elems.append(Paragraph(
            f"Report ID: <b>{report_id[:12]}…</b>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;"
            f"Generated: {ts}&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;"
            f"File: <i>{filename}</i>",
            subtitle_style,
        ))
        elems.append(HRFlowable(width="100%", thickness=2, color=_CYAN, spaceAfter=10))

        # ── Patient Information ────────────────────────────────────────────────
        pid   = meta.get("patient_id",       "").strip()
        rname = meta.get("radiologist_name", "").strip()
        notes = meta.get("clinical_notes",   "").strip()
        dmeta = meta.get("dicom_meta",       {})

        if any([pid, rname, notes, dmeta]):
            elems.append(Paragraph("Patient Information", section_style))
            rows = []
            if pid or rname:
                rows.append([_bold("Patient ID"), pid or "—", _bold("Radiologist"), rname or "—"])
            if dmeta.get("patient_name"):
                rows.append([_bold("Patient Name"), str(dmeta["patient_name"]),
                             _bold("Study Date"),   dmeta.get("study_date", "—")])
            if rows:
                pt = Table(rows, colWidths=[1.1*inch, 2.5*inch, 1.1*inch, 2.5*inch])
                pt.setStyle(_base_table_style())
                elems.append(pt)
            if notes:
                elems.append(Spacer(1, 6))
                elems.append(Paragraph(f"<b>Clinical Notes:</b> {notes}", body_style))

        # ── Scan Details ───────────────────────────────────────────────────────
        elems.append(Paragraph("Scan Details", section_style))
        modality_display = analysis.get("modality", "unknown").replace("_", " ").upper()
        mod_conf = analysis.get("modality_confidence")
        mod_conf_str = f"{mod_conf:.0%}" if mod_conf is not None else "—"
        scan_rows = [
            [_bold("Filename"),         filename,         _bold("Modality"),      modality_display],
            [_bold("Auto-detected at"), mod_conf_str,     _bold("Stub mode"),     "Yes" if analysis.get("stub") else "No"],
        ]
        st = Table(scan_rows, colWidths=[1.1*inch, 2.5*inch, 1.1*inch, 2.5*inch])
        st.setStyle(_base_table_style())
        elems.append(st)

        # ── AI Prediction Result ───────────────────────────────────────────────
        elems.append(Paragraph("AI Prediction Result", section_style))
        prediction = analysis.get("prediction", "N/A")
        confidence = analysis.get("confidence", 0.0)
        sev        = analysis.get("severity", {})
        sev_level  = sev.get("level", "Unknown")
        sev_score  = sev.get("score", 0.0)
        sev_color  = _SEVERITY_COLOR.get(sev_level.lower(), _TEXT_DARK)

        conf_str = f"{confidence:.1%}"
        if analysis.get("calibrated"):
            conf_str += f"  (calibrated T={analysis.get('calibration_temperature', '?')})"

        result_data = [
            [_bold("Prediction"),  Paragraph(f"<b>{prediction.upper()}</b>", body_style),
             _bold("Confidence"),  conf_str],
            [_bold("Severity"),    Paragraph(f"<font color='#{_hex(sev_color)}'><b>{sev_level}</b></font>", body_style),
             _bold("Sev. Score"),  f"{sev_score:.3f}"],
        ]
        rt = Table(result_data, colWidths=[1.1*inch, 2.5*inch, 1.1*inch, 2.5*inch])
        rt.setStyle(_base_table_style())
        elems.append(rt)

        if sev.get("description"):
            elems.append(Spacer(1, 4))
            elems.append(Paragraph(f"<i>{sev['description']}</i>", body_style))

        # ── Uncertainty ────────────────────────────────────────────────────────
        unc = analysis.get("uncertainty", {})
        if unc:
            elems.append(Paragraph("Uncertainty Assessment", section_style))
            unc_rows = [[
                _bold("Flag"), unc.get("flag", "—"),
                _bold("Norm. Entropy"), f"{unc.get('normalized_entropy', 0):.4f}",
            ]]
            ut = Table(unc_rows, colWidths=[1.1*inch, 2.5*inch, 1.1*inch, 2.5*inch])
            ut.setStyle(_base_table_style())
            elems.append(ut)

        # ── Class Probabilities ────────────────────────────────────────────────
        cp = analysis.get("class_probabilities", {})
        if cp:
            elems.append(Paragraph("Class Probabilities", section_style))
            items = list(cp.items())
            cp_rows = [[_bold(k), f"{v:.2%}"] for k, v in items]
            cpt = Table(cp_rows, colWidths=[2.5*inch, 4.75*inch])
            cpt.setStyle(_base_table_style())
            elems.append(cpt)

        # ── Grad-CAM Image ─────────────────────────────────────────────────────
        expl    = analysis.get("explainability", {})
        img_b64 = expl.get("image_b64", "")
        expl_type = expl.get("type", "")

        elems.append(Paragraph("Explainability — Grad-CAM Heatmap", section_style))
        if img_b64:
            try:
                img_bytes  = base64.b64decode(img_b64)
                img_reader = ImageReader(BytesIO(img_bytes))
                img_w, img_h = img_reader.getSize()
                # Fit into max 4.0" x 3.5" box keeping aspect ratio
                max_w, max_h = 4.0 * inch, 3.5 * inch
                scale = min(max_w / img_w, max_h / img_h)
                rl_img = Image(BytesIO(img_bytes), width=img_w * scale, height=img_h * scale)
                elems.append(rl_img)
            except Exception as img_err:
                logger.warning(f"Could not embed heatmap: {img_err}")
                elems.append(Paragraph("Heatmap could not be embedded.", body_style))
        elif expl_type == "not_applicable":
            elems.append(Paragraph(
                "Grad-CAM is not applicable for this modality (ECG / non-image model).", body_style
            ))
        else:
            elems.append(Paragraph("Grad-CAM not available for this scan.", body_style))

        if expl.get("description"):
            elems.append(Spacer(1, 4))
            elems.append(Paragraph(f"<i>{expl['description']}</i>", body_style))

        # ── AI Interpretation ──────────────────────────────────────────────────
        ai_desc = expl.get("description") or sev.get("description") or "No additional interpretation provided."
        if ai_desc:
            elems.append(Paragraph("AI Interpretation", section_style))
            elems.append(Paragraph(ai_desc, body_style))

        # ── Disclaimer ─────────────────────────────────────────────────────────
        elems.append(Spacer(1, 16))
        elems.append(HRFlowable(width="100%", thickness=1, color=_BORDER_GREY, spaceBefore=4))
        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=styles["Normal"],
            fontSize=7.5,
            textColor=_TEXT_DIM,
            leading=10,
        )
        elems.append(Paragraph(
            "⚠ DISCLAIMER: This report is generated by an AI system for research and educational "
            "purposes only. It does not constitute medical advice and must not be used for clinical "
            "diagnosis or treatment. Always consult a qualified healthcare professional.",
            disclaimer_style,
        ))

        doc.build(elems)
        logger.info(f"✅ Report saved: {report_path}")
        return report_id, str(report_path)

    except Exception as e:
        logger.error(f"Report generation failed: {e}", exc_info=True)
        return report_id, ""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _bold(text: str) -> Paragraph:
    """Return a bolded Paragraph for use inside Table cells."""
    from reportlab.lib.styles import getSampleStyleSheet
    styles = getSampleStyleSheet()
    s = ParagraphStyle("CellBold", parent=styles["Normal"], fontSize=9,
                       textColor=_TEXT_DIM, fontName="Helvetica-Bold")
    return Paragraph(text, s)


def _base_table_style():
    return TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0), _LIGHT_GREY),
        ("BOX",         (0, 0), (-1, -1), 0.75, _BORDER_GREY),
        ("INNERGRID",   (0, 0), (-1, -1), 0.4,  _BORDER_GREY),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [_WHITE, _LIGHT_GREY]),
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ])


def _hex(color) -> str:
    """Convert a ReportLab color to a 6-char hex string (no leading #)."""
    try:
        r, g, b = int(color.red * 255), int(color.green * 255), int(color.blue * 255)
        return f"{r:02X}{g:02X}{b:02X}"
    except Exception:
        return "1E293B"

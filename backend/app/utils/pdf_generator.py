"""
PDF generator for quotation documents.
Uses reportlab to produce a professional quotation PDF.
"""

from __future__ import annotations

from io import BytesIO
from typing import TYPE_CHECKING

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)

if TYPE_CHECKING:
    from app.models.quotation import Quotation


def generate_quotation_pdf(quotation: "Quotation") -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    title_style = ParagraphStyle("Title", parent=styles["Title"], textColor=colors.HexColor("#1e3a5f"), fontSize=18)
    story.append(Paragraph("SUCCESS SOLAR CARE", title_style))
    story.append(Paragraph("Trichy, Tamil Nadu | Solar Energy Solutions", styles["Normal"]))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1e3a5f")))
    story.append(Spacer(1, 6 * mm))

    # ── Quotation Info ────────────────────────────────────────────────────────
    info_data = [
        ["Quotation No:", quotation.quotation_number, "Date:", quotation.date],
        ["Customer:", quotation.customer_name, "Valid Until:", quotation.valid_until or "—"],
        ["Site:", quotation.site or "—", "Prepared By:", quotation.prepared_by],
        ["Revision:", str(quotation.revision_number), "Status:", quotation.status],
    ]
    info_table = Table(info_data, colWidths=[35 * mm, 65 * mm, 25 * mm, 55 * mm])
    info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 6 * mm))

    # ── Line Items ────────────────────────────────────────────────────────────
    headers = ["#", "Product", "Qty", "Unit", "Unit Price", "Discount%", "GST%", "Labour", "Total"]
    rows = [headers]
    for idx, item in enumerate(quotation.line_items, 1):
        rows.append([
            str(idx),
            item.product,
            str(item.quantity),
            item.unit,
            f"₹{item.unit_price:,.2f}",
            f"{item.discount}%",
            f"{item.gst_percent}%",
            f"₹{item.labour_charge:,.2f}",
            f"₹{item.line_total:,.2f}",
        ])

    col_widths = [8 * mm, 45 * mm, 12 * mm, 10 * mm, 22 * mm, 16 * mm, 12 * mm, 18 * mm, 22 * mm]
    line_table = Table(rows, colWidths=col_widths, repeatRows=1)
    line_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d0d7e0")),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(line_table)
    story.append(Spacer(1, 6 * mm))

    # ── Totals ────────────────────────────────────────────────────────────────
    totals_data = [
        ["Subtotal:", f"₹{quotation.subtotal:,.2f}"],
        ["Discount:", f"- ₹{quotation.discount_total:,.2f}"],
        ["GST:", f"+ ₹{quotation.tax_total:,.2f}"],
        ["Labour:", f"+ ₹{quotation.labour_total:,.2f}"],
        ["Other Charges:", f"+ ₹{quotation.other_charges:,.2f}"],
        ["GRAND TOTAL:", f"₹{quotation.grand_total:,.2f}"],
        ["Advance ({}%):".format(quotation.advance_percentage), f"₹{quotation.advance_amount:,.2f}"],
        ["Balance:", f"₹{quotation.balance_amount:,.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[40 * mm, 40 * mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("LINEABOVE", (0, 5), (-1, 5), 1, colors.black),
        ("LINEBELOW", (0, 5), (-1, 5), 1, colors.black),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(totals_table)

    # ── Terms ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    if quotation.payment_terms:
        story.append(Paragraph(f"<b>Payment Terms:</b> {quotation.payment_terms}", styles["Normal"]))
    if quotation.warranty_terms:
        story.append(Paragraph(f"<b>Warranty:</b> {quotation.warranty_terms}", styles["Normal"]))
    if quotation.notes:
        story.append(Paragraph(f"<b>Notes:</b> {quotation.notes}", styles["Normal"]))

    story.append(Spacer(1, 12 * mm))
    story.append(Paragraph("Authorised Signatory", styles["Normal"]))
    story.append(Paragraph("Success Solar Care", styles["Normal"]))

    doc.build(story)
    return buffer.getvalue()

"""
Quotation total computation — mirrors QuotationBuilder.tsx exactly.
Always called server-side; client-submitted totals are discarded.

Formula:
  lineBase        = qty * unitPrice
  lineDiscount    = lineBase * (discount / 100)
  lineTax         = (lineBase - lineDiscount) * (gst / 100)
  lineLabour      = labourCharge

  subtotal        = sum(lineBase)
  discountTotal   = sum(lineDiscount)
  taxTotal        = sum(lineTax)
  labourTotal     = sum(lineLabour)
  grandTotal      = round(subtotal - discountTotal + taxTotal + labourTotal + otherCharges)
  advanceAmount   = round(grandTotal * advancePercentage / 100)
  balanceAmount   = grandTotal - advanceAmount
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import List


@dataclass
class LineItemInput:
    quantity: Decimal
    unit_price: Decimal
    discount: Decimal        # percentage 0–100
    gst_percent: Decimal     # percentage 0–100
    labour_charge: Decimal


@dataclass
class LineItemResult:
    line_base: Decimal
    line_discount_amount: Decimal
    line_tax_amount: Decimal
    line_labour: Decimal
    line_total: Decimal


@dataclass
class QuotationTotals:
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    labour_total: Decimal
    other_charges: Decimal
    grand_total: Decimal
    advance_amount: Decimal
    balance_amount: Decimal
    line_results: List[LineItemResult]


def _d(v) -> Decimal:
    return Decimal(str(v))


def compute_line_item(item: LineItemInput) -> LineItemResult:
    line_base = (item.quantity * item.unit_price).quantize(Decimal("0.01"))
    line_discount = (line_base * item.discount / _d(100)).quantize(Decimal("0.01"))
    line_tax = ((line_base - line_discount) * item.gst_percent / _d(100)).quantize(Decimal("0.01"))
    line_labour = item.labour_charge.quantize(Decimal("0.01"))
    line_total = (line_base - line_discount + line_tax + line_labour).quantize(Decimal("0.01"))
    return LineItemResult(
        line_base=line_base,
        line_discount_amount=line_discount,
        line_tax_amount=line_tax,
        line_labour=line_labour,
        line_total=line_total,
    )


def compute_quotation_totals(
    line_items: List[LineItemInput],
    advance_percentage: Decimal,
    other_charges: Decimal = Decimal("0"),
) -> QuotationTotals:
    line_results = [compute_line_item(item) for item in line_items]

    subtotal = sum((r.line_base for r in line_results), Decimal("0"))
    discount_total = sum((r.line_discount_amount for r in line_results), Decimal("0"))
    tax_total = sum((r.line_tax_amount for r in line_results), Decimal("0"))
    labour_total = sum((r.line_labour for r in line_results), Decimal("0"))

    grand_total = (subtotal - discount_total + tax_total + labour_total + other_charges).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    advance_amount = (grand_total * advance_percentage / _d(100)).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    balance_amount = grand_total - advance_amount

    return QuotationTotals(
        subtotal=subtotal,
        discount_total=discount_total,
        tax_total=tax_total,
        labour_total=labour_total,
        other_charges=other_charges,
        grand_total=grand_total,
        advance_amount=advance_amount,
        balance_amount=balance_amount,
        line_results=line_results,
    )

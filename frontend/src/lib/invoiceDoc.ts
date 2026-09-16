import type { Invoice, Quotation } from '../types/models'
import { formatINR, formatDate } from './utils'
import headerImg from '../assets/header_pdf_qu.png'
import homeImg from '../assets/Home_page _quo.png'

function formatAddress(addr: string): string {
  if (!addr) return ''
  const regex = /^(.*?)(?:,\s*|\s+)([a-zA-Z\s\.]+(?:\s*-\s*|\s+)\d{6})\s*$/i
  const match = addr.match(regex)
  if (match) {
    const before = match[1].trim()
    const cityPin = match[2].trim()
    const separator = before.endsWith(',') ? ' ' : ', '
    return `${before}${separator}<br/>${cityPin}`
  }

  const pinRegex = /^(.*?)(?:,\s*|\s+)(\d{6})\s*$/
  const pinMatch = addr.match(pinRegex)
  if (pinMatch) {
    const before = pinMatch[1].trim()
    const pin = pinMatch[2].trim()
    const separator = before.endsWith(',') ? ' ' : ', '
    return `${before}${separator}<br/>${pin}`
  }

  return addr
}

function formatComponentDetail(label: string, text: string) {
  if (!text) return `<strong>${label}</strong>`
  const match = text.match(/^(.*?)\s*(\(.*?\))\s*$/)
  if (match) {
    return `<strong>${label}: ${match[1].trim()}</strong><br/><em>${match[2].trim()}</em>`
  }
  return `<strong>${label}: ${text}</strong>`
}

export function getInvoiceHtml(invoice: Invoice, quotation?: Quotation | null): string {
  const items = quotation?.lineItems ?? []
  const firstItem = items[0]
  const productName = firstItem?.product || 'SOLAR POWER PLANT (ONGRID AND OFF GRID)'

  const defaultDesc =
    '• 5 kW On-Grid / Off-Grid Solar Power System\n' +
    '• High-efficiency mono-crystalline solar panels with standard mounting arrangement\n' +
    '• Grid-tied & hybrid solar inverter with monitoring and protection system\n' +
    '• GI mounting structure, DC/AC protection, earthing, cables, installation, testing & Commissioning\n' +
    '• Concrete pillar work for structure leg, sprinkler system with motor, & EB Net Meter payment'

  const formatItemDescription = (desc?: string | number | null) => {
    const raw = String(desc ?? '').trim() || defaultDesc
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.startsWith('•') ? line : `• ${line}`))
      .join('<br/>')
  }

  const formatQtyUnit = (quantity: number | string, unit?: string | number | null) => {
    const q = Number(quantity) || 1
    const u = String(unit ?? '').trim()
    if (!u) return `${q} Nos`
    if (/[a-zA-Z]/.test(u)) {
      if (u.toLowerCase().includes('kw') || u.toLowerCase().includes('nos') || u.toLowerCase().includes('set')) {
        return q > 1 ? `${q} × ${u}` : u
      }
      return `${q} ${u}`
    }
    const num = parseFloat(u)
    if (!isNaN(num)) {
      return `${num} kW`
    }
    return `${q} ${u}`
  }

  const kilowattVal = firstItem ? formatQtyUnit(firstItem.quantity, firstItem.unit) : '5.5 kW'

  // Tax and GST Calculations (Sub Total, Taxable Value, CGST, SGST, Grand Total)
  let subtotal = 0
  let discountTotal = 0
  let taxableValue = 0
  let taxTotal = 0
  let labourTotal = 0
  let gstRate = 18

  if (items && items.length > 0) {
    for (const it of items) {
      const qty = Number(it.quantity) || 1
      const price = Number(it.unitPrice) || 0
      const disc = Number(it.discount) || 0
      const rate = it.gstPercent !== undefined && it.gstPercent !== null ? Number(it.gstPercent) : 18
      gstRate = rate
      const lineBase = qty * price
      const lineDisc = lineBase * (disc / 100)
      const lineTaxable = lineBase - lineDisc
      const lineTax = lineTaxable * (rate / 100)
      subtotal += lineBase
      discountTotal += lineDisc
      taxableValue += lineTaxable
      taxTotal += lineTax
      labourTotal += (Number(it.labourCharge) || 0)
    }
  } else if (quotation?.subtotal && Number(quotation.subtotal) > 0) {
    subtotal = Number(quotation.subtotal)
    discountTotal = Number(quotation.discountTotal || 0)
    taxableValue = subtotal - discountTotal
    taxTotal = Number(quotation.taxTotal || 0)
    labourTotal = Number(quotation.labourTotal || 0)
  } else {
    const total = Number(invoice.grandTotal || quotation?.grandTotal || 0)
    taxableValue = Math.round((total / 1.18) * 100) / 100
    subtotal = taxableValue
    taxTotal = total - taxableValue
  }

  const grandTotalVal = quotation?.grandTotal ?? invoice.grandTotal ?? Math.round(taxableValue + taxTotal + labourTotal)
  const cgstRate = gstRate / 2
  const sgstRate = gstRate / 2
  const cgstAmount = taxTotal / 2
  const sgstAmount = taxTotal / 2

  const formatWithDecimals = (amt: number) => {
    return '₹ ' + Number(amt).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const defaultPaymentTerms =
    '• Payment terms as agreed per verified order schedule.\n' +
    '• All payments via Cheque / RTGS / NEFT / UPI to company account.\n' +
    '• Net meter application is supported by Success Solar Power Care.\n' +
    '* Note: Balance payment settlement is linked to work completion on site.'

  const defaultInstallationTerms =
    `• GST: Included as applicable per law.\n` +
    `• Transport & Delivery: Included to customer site.\n` +
    `• Mounting structure & civil support: Included.\n` +
    `• Warranty: 10 Years Inverter & 30 Years Solar Panel.`

  const defaultTermsAndConditions =
    '1. Goods once sold cannot be returned or exchanged without prior written consent.\n' +
    '2. Warranty coverage is provided directly by respective original equipment manufacturers (OEMs).\n' +
    '3. Grid connectivity and EB net meter approval timelines depend on state electricity board norms.\n' +
    '4. Customer must ensure unobstructed roof access and water supply for routine panel cleaning.\n' +
    '5. Subject to Tiruchirappalli jurisdiction.'

  const paymentTermsRaw = String(invoice.paymentTerms || quotation?.paymentTerms || defaultPaymentTerms).trim()
  const installationTermsRaw = String(invoice.installationTerms || quotation?.installationTerms || defaultInstallationTerms).trim()
  const termsAndConditionsRaw = String(invoice.termsAndConditions || quotation?.termsAndConditions || defaultTermsAndConditions).trim()

  const grandTotalFormatted = invoice.grandTotal ? formatINR(invoice.grandTotal) : (quotation?.grandTotal ? formatINR(quotation.grandTotal) : '₹0')

  const footerLeftHtml = `
    <div class="footer-left">
      <div class="footer-item">
        <div class="footer-icon">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.57a1.024 1.024 0 0 0-1.02.24l-2.2 2.2a15.149 15.149 0 0 1-6.59-6.59l2.2-2.2a1.024 1.024 0 0 0 .24-1.02c-.38-1.11-.57-2.3-.57-3.53C8.34 3.61 7.73 3 7 3H3.5C2.78 3 2 3.78 2 4.5 2 14.17 9.83 22 19.5 22c.72 0 1.5-.78 1.5-1.5v-3.5c0-.73-.61-1.34-1.34-1.34z"/>
          </svg>
        </div>
        9787400555, 9787400666
      </div>
      <div class="footer-item">
        <div class="footer-icon">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
        </div>
        successsolarmedia@gmail.com
      </div>
      <div class="footer-item">
        <div class="footer-icon">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.26-.81-1-1.4-1.9-1.4h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z"/>
          </svg>
        </div>
        www.successsolar.com
      </div>
    </div>
  `

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice_${invoice.invoiceNumber || 'Document'}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0b2545;
      background: #e2e8f0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .no-print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 48px;
      background: #0b2545;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .no-print-bar span {
      color: #fff;
      font-size: 13px;
      font-weight: 600;
    }
    .no-print-bar button {
      background: #f57c00;
      color: #fff;
      border: none;
      padding: 8px 18px;
      font-weight: 700;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    /* Page Setup */
    .page-container {
      margin-top: 56px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding-bottom: 40px;
    }

    .page {
      width: 210mm;
      height: 297mm;
      background: #ffffff;
      padding: 12mm 14mm 0 14mm;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    @media print {
      .no-print-bar {
        display: none !important;
      }
      body {
        background: none;
        margin: 0;
        padding: 0;
      }
      .page-container {
        margin-top: 0;
        padding-bottom: 0;
        gap: 0;
      }
      .page {
        box-shadow: none;
        page-break-after: always;
        page-break-inside: avoid;
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 12mm 14mm 0 14mm;
      }
      .page:last-child {
        page-break-after: auto;
      }
      @page {
        size: A4 portrait;
        margin: 0;
      }
    }

    /* Common Footer */
    .footer {
      margin-left: -14mm;
      margin-right: -14mm;
      margin-top: auto;
      height: 15mm;
      background: #0b2545;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16mm;
      color: #ffffff;
      font-size: 12.5px;
      font-weight: 700;
      font-family: Arial, Helvetica, sans-serif;
    }
    .footer::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #e65100 0%, #ff9800 100%);
    }
    .footer-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .footer-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .footer-icon {
      width: 20px;
      height: 20px;
      background: #f57c00;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .footer-right {
      font-weight: 800;
      font-size: 8px;
      letter-spacing: 0.5px;
    }

    /* Page 1 Styles */
    .header-logo-img {
      width: 100%;
      max-height: 88px;
      object-fit: cover;
      display: block;
    }
    .company-header-title {
      text-align: center;
      color: #0b2545;
      font-size: 25px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .company-header-subtitle {
      text-align: center;
      color: #0b2545;
      font-size: 13.5px;
      font-weight: 700;
      margin-top: 2px;
      
    }
    .gst-badge {
      text-align: center;
      margin: 6px auto 12px auto;
    }
    .gst-badge span {
      background: #0b2545;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      padding: 5px 20px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      display: inline-block;
      margin-bottom: 16px;
    }
    .home-banner-img {
      width: 100%;
      height: 300px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 16px;
      display: block;
    }
    
    .customer-section {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      position: relative;
    }
    .customer-card {
      flex: 1.3;
      background: #f0f5fa;
      border: 1px solid #d4e3f5;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .customer-icon {
      width: 34px;
      height: 34px;
      background: #0b2545;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .customer-details { 
      font-size: 14.5px;
      line-height: 1.70;
      color: #0b2545;
    }
    .customer-details strong {
      color: #0b2545;
      font-weight: 800;
    }
    .divider-line {
      width: 1px;
      height: 60px;
      border-right: 1.5px dashed #cbd5e1;
    }
    .quotation-meta-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding-left: 8px;
      font-size: 14.5px;
      line-height: 1.7;
      color: #0b2545;
    }
    .quotation-meta-card strong {
      font-weight: 800;
    }

    .products-list-box {
      padding-top:20px;
      margin-bottom: 12px;
    }
    .products-heading {
      font-size: 18px;
      font-weight: 900;
      color: #0b2545;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .products-grid {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding-left: 2px;
    }
    .product-list-item {
      display: flex;
      align-items: center;
      font-family:Arial, Helvetica, sans-serif;
      gap: 10px;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
      color: #1a2b4c;
    }
    .check-icon {
      width: 18px;
      height: 18px;
      background: #f57c00;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .quote-msg-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-top: 14px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .quote-mark {
      width: 24px;
      height: 24px;
      background: #f57c00;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      font-weight: 900;
      flex-shrink: 0;
    }
    .quote-msg-content {
      font-size: 16px;
      line-height: 1.45;
      color: #334155;
      text-align: center;
    }
    .quote-msg-title {
      color: #e65100;
      font-weight: 800;
      font-style: italic;
      margin-bottom: 3px;
      font-size: 15px;
    }

    /* Page 2 Styles */
    .section-title-bar {
      color: #0b2545;
      font-weight: 800;
      margin-top: 30px;
      font-size: 19px;
      padding: 9px 14px;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      margin-bottom: 18px;
      width: 100%;
    }
    .pdf-table {
      width: 100%;
      margin-top: 20px;
      border-collapse: collapse;
    }
    .pdf-table th {
      background: #0b2545;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 9px;
      border: 1px solid #0b2545;
      text-align: left;
    }
    .pdf-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      font-size: 12.5px;
      vertical-align: top;
      line-height: 1.5;
      color: #0f172a;
    }
    .pdf-table .col-sno { width: 6%; text-align: center; font-weight: 800; }
    .pdf-table .col-desc { width: 64%; }
    .pdf-table .col-kw { width: 15%; text-align: center; font-weight: 700; }
    .pdf-table .col-amt { width: 15%; text-align: right; font-weight: 800; }
    
    .table-total-row td {
      background: #f8fafc;
      font-weight: 900;
      color: #0b2545;
      font-size: 13px;
      border-top: 2px solid #0b2545;
    }

    /* Tax Calculation & GST Breakdown Card */
    .tax-calculation-card {
      width: 100%;
      margin-top: 22px;
      border: 1.5px solid #d5e7cf;
      border-radius: 4px;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
    }
    .tax-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 18px;
      background: #d7f9ffff;
      border-bottom: 1.5px solid #e1efe0;
      color: #0b2545;
    }
    .tax-row:last-of-type {
      border-bottom: none;
    }
    .tax-row .label {
      font-weight: 700;
      color: #0b2545;
      font-size: 15px;
    }
    .tax-row .val {
      font-weight: 700;
      color: #0b2545;
      font-size: 15px;
    }
    .tax-grand-total {
      background: #0b2545;
      color: #ffffff;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tax-grand-total .label {
      font-size: 16.5px;
      letter-spacing: 0.5px;
      color: #ffffff;
      font-weight: 900;
    }
    .tax-grand-total .val {
      font-size: 19px;
      color: #ffffff;
      font-weight: 900;
    }

    /* Page 3 Styles */
    .two-cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 30px;
      margin-top: 15px;
    }
    .info-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
    }
    .info-card-header {
      background: #0b2545;
      color: #fff;
      font-size: 13.5px;
      font-weight: 800;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .info-card-body {
      padding: 16px 20px;
      font-size: 11.5px;
      line-height: 2.1;
      color: #1e293b;
    }
    .info-card-body strong {
      color: #0b2545;
      font-weight: 800;
    }

    .terms-container {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 30px;
      background: #ffffff;
    }
    .terms-title-tab {
      background: #0b2545;
      color: #ffffff;
      font-weight: 800;
      font-size: 16px;
      padding: 10px 28px;
      letter-spacing: 0.4px;
      display: inline-flex;
      align-items: center;
      border-radius: 0 20px 20px 0;
      font-family: Arial, Helvetica, sans-serif;
    }
    .terms-grid {
      display: grid;
      grid-template-columns: 1fr 1.05fr;
      gap: 28px;
      padding: 22px 24px;
      font-size: 15px;
      line-height: 1.9;
    }
    .terms-col-left {
      border-right: 1.5px dotted #cbd5e1;
      padding-right: 24px;
    }
    .terms-col-right {
      padding-left: 8px;
    }
    .terms-col-left p, .terms-col-right p {
      margin-bottom: 8px;
      display: flex;
      align-items: flex-start;
    }
    .bullet-dot {
      color: #0b2545;
      font-weight: 900;
      margin-right: 10px;
      flex-shrink: 0;
    }
    .warning-text-red {
      color: #d32f2f;
      font-weight: 800;
      font-size: 14px;
      margin: 8px 0 8px 18px;
      line-height: 1.5;
    }

    /* Page 4 Styles */
    .terms-box-pg4 {
      margin-top: 40px;
      background: #fdfaf6;
      border: 1px solid #fed7aa;
      border-radius: 12px;
      padding: 24px 30px;
      margin-bottom: 35px;
    }
    .terms-box-pg4 h4 {
      color: #c2410c;
      font-size: 18px;
      font-weight: 900;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .terms-list-pg4 {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .term-row-pg4 {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .term-num-pg4 {
      font-weight: 700;
      color: #334155;
      font-size: 15px;
      line-height: 1.6;
      flex-shrink: 0;
      min-width: 20px;
    }
    .term-text-pg4 {
      flex: 1;
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }

    .sign-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 20px;
      margin-top: 40px;
      margin-bottom: 20px;
    }
    .sign-block {
      text-align: center;
      width: 200px;
    }
    .sign-line {
      border-top: 1.5px solid #0b2545;
      margin-bottom: 8px;
    }
    .sign-label {
      font-size: 13.5px;
      font-weight: 800;
      color: #0b2545;
    }
    .sign-title {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .seal-box {
      width: 80px;
      height: 80px;
      border: 1.5px dashed #0b2545;
      border-radius: 50%;
      margin: 0 auto 12px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 800;
      color: #0b2545;
      text-align: center;
      line-height: 1.2;
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <span>Tax Invoice · Success Solar Power Care (${invoice.invoiceNumber})</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="page-container">

    <!-- PAGE 1: TAX INVOICE COVER & CUSTOMER DETAILS -->
    <div class="page">
      <div>
        <img class="header-logo-img" src="${headerImg}" alt="Success Solar Power Care" />
        <h2 class="company-header-title">SUCCESS SOLAR POWER CARE</h2>
        <p class="company-header-subtitle">TAX INVOICE</p>
        
        <div class="gst-badge">
          <span>GSTIN : 33AAECS1234F1Z5</span>
        </div>

        <img class="home-banner-img" src="${homeImg}" alt="Solar Installation" />

        <div class="customer-section">
          <div class="customer-card">
            <div class="customer-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div class="customer-details">
              <strong>BILL TO :</strong><br/>
              <strong>${invoice.customerName || quotation?.customerName || 'Customer'}</strong><br/>
              ${formatAddress(invoice.billingAddress || invoice.site || quotation?.site || 'Site Address')}<br/>
              ${quotation?.customerPhone ? `Ph: ${quotation.customerPhone}` : ''}
            </div>
          </div>

          <div class="divider-line"></div>

          <div class="quotation-meta-card">
            <div><strong>Invoice No : </strong>${invoice.invoiceNumber}</div>
            <div><strong>Invoice Date : </strong>${formatDate(invoice.issueDate)}</div>
            <div><strong>Due Date : </strong>${formatDate(invoice.dueDate)}</div>
            <div><strong>Quotation Ref : </strong>${invoice.quotationNumber || quotation?.quotationNumber || '—'}</div>
            <div><strong>Project Type : </strong>${invoice.projectType || quotation?.projectType || 'Residential'}</div>
          </div>
        </div>

        <div class="products-list-box">
          <div class="products-heading">PRODUCTS & SERVICES</div>
          <div class="products-grid">
            <div class="product-list-item">
              <div class="check-icon">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              Solar Power Plant (On-Grid and Off-Grid)
            </div>
            <div class="product-list-item">
              <div class="check-icon">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              Solar Hybrid Systems & Battery Storage
            </div>
            <div class="product-list-item">
              <div class="check-icon">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              Solar Pumpset & Water Heating Solutions
            </div>
            <div class="product-list-item">
              <div class="check-icon">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              Structure, Installation, Net Metering & Commissioning
            </div>
          </div>
        </div>

        <div class="quote-msg-box">
          <div class="quote-mark">“</div>
          <div class="quote-msg-content">
            <div class="quote-msg-title">Empowering clean energy with quality and trust</div>
            Official Commercial Tax Invoice for the solar power system project.
          </div>
        </div>
      </div>

      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">PAGE 01</div>
      </div>
    </div>

    <!-- PAGE 2: ITEMIZED BILLING & TAX BREAKDOWN -->
    <div class="page">
      <div>
        <img class="header-logo-img" src="${headerImg}" alt="Success Solar Power Care" />
        <h2 class="company-header-title">SUCCESS SOLAR POWER CARE</h2>
        
        <div class="section-title-bar">
          <span>TAX INVOICE</span>
        </div>

        <table class="pdf-table">
          <thead>
            <tr>
              <th class="col-sno">S.NO</th>
              <th class="col-desc">ITEM DESCRIPTION & SPECIFICATIONS</th>
              <th class="col-kw">QTY / UNIT</th>
              <th class="col-amt">AMOUNT (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${items.length > 0 ? items.map((it, idx) => `
              <tr>
                <td class="col-sno">${idx + 1}</td>
                <td class="col-desc">
                  <div style="font-weight: 800; font-size: 13.5px; margin-bottom: 5px; color: #0b2545;">${it.product}</div>
                  <div style="font-size: 12px; color: #334155; line-height: 1.6;">
                    ${formatItemDescription(it.description)}
                  </div>
                </td>
                <td class="col-kw">${formatQtyUnit(it.quantity, it.unit)}</td>
                <td class="col-amt">${formatINR(Math.round(Number(it.quantity) * Number(it.unitPrice) * (1 - (Number(it.discount) || 0) / 100) * (1 + (Number(it.gstPercent) || 18) / 100) + (Number(it.labourCharge) || 0)))}</td>
              </tr>
            `).join('') : `
              <tr>
                <td class="col-sno">1</td>
                <td class="col-desc">
                  <div style="font-weight: 800; font-size: 13.5px; margin-bottom: 5px; color: #0b2545;">${productName}</div>
                  <div style="font-size: 12px; color: #334155; line-height: 1.6;">
                    ${formatItemDescription()}
                  </div>
                </td>
                <td class="col-kw">${kilowattVal}</td>
                <td class="col-amt">${grandTotalFormatted}</td>
              </tr>
            `}
            <tr class="table-total-row">
              <td colspan="3" style="text-align: right; padding-right: 14px;"><strong>TOTAL INVOICE VALUE (INCL. GST)</strong></td>
              <td class="col-amt">${grandTotalFormatted}</td>
            </tr>
          </tbody>
        </table>

        <!-- Tax Calculation & GST Split (Sub Total, Taxable Value, CGST, SGST, GRAND TOTAL) -->
        <div class="tax-calculation-card">
          <div class="tax-row">
            <span class="label">Sub Total</span>
            <span class="val">${formatWithDecimals(subtotal)}</span>
          </div>
          <div class="tax-row">
            <span class="label">Taxable Value</span>
            <span class="val">${formatWithDecimals(taxableValue)}</span>
          </div>
          <div class="tax-row">
            <span class="label">CGST (${cgstRate}%)</span>
            <span class="val">${formatWithDecimals(cgstAmount)}</span>
          </div>
          <div class="tax-row">
            <span class="label">SGST (${sgstRate}%)</span>
            <span class="val">${formatWithDecimals(sgstAmount)}</span>
          </div>
          <div class="tax-grand-total">
            <span class="label">GRAND TOTAL</span>
            <span class="val">${formatWithDecimals(grandTotalVal)}</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div style="margin-top: 16px; font-size: 13px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px 14px;">
            <strong>Invoice Notes:</strong> ${invoice.notes}
          </div>
        ` : ''}
      </div>

      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">PAGE 02</div>
      </div>
    </div>

    <!-- PAGE 3: TECHNICAL SCOPE, BANK DETAILS & PAYMENT TERMS -->
    <div class="page">
      <div>
        <img class="header-logo-img" src="${headerImg}" alt="Success Solar Power Care" />
        <h2 class="company-header-title">SUCCESS SOLAR POWER CARE</h2>

        <div class="two-cards-grid">
          <div class="info-card">
            <div class="info-card-header">
              <span>SYSTEM EQUIPMENT SUMMARY</span>
            </div>
            <div class="info-card-body">
              ${formatComponentDetail('Solar Panel', quotation?.solarPanel || 'VIKRAM BIFACIAL DCR SOLAR PANEL (GOVT. ALMM APPROVED)')}<br/>
              ${formatComponentDetail('Solar Inverter', quotation?.solarInverter || 'VSOLE INVERTER (BIS STANDARD APPROVED)')}<br/>
              <strong>Mounting Structure:</strong> Hot Dip Galvanized (HDG) / Elevated GI<br/>
              <strong>Protection:</strong> ACDB / DCDB SPD & Dedicated Earthing<br/>
              <strong>Cables:</strong> UV Protected Copper Solar DC & RR AC Cables
            </div>
          </div>

          <div class="info-card">
            <div class="info-card-header">
              <span>BANK DETAILS FOR REMITTANCE</span>
            </div>
            <div class="info-card-body">
              <strong>Account Name:</strong> SUCCESS SOLAR POWER CARE<br/>
              <strong>Bank:</strong>HDFC BANK<br/>
              <strong>Account No:</strong> 502000073050134<br/>
              <strong>IFSC Code:</strong> HDFC0009148<br/>
              <strong>Branch:</strong> PONNAGAR, TRICHY.<br/>
              <!-- <strong>UPI ID:</strong> successsolar@sbi -->
            </div>
          </div>
        </div>

        <div class="terms-container">
          <div class="terms-title-tab">PAYMENT & INSTALLATION TERMS</div>
          <div class="terms-grid">
            <div class="terms-col-left">
              ${paymentTermsRaw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    if (l.startsWith('*')) {
      return `<div class="warning-text-red">${l}</div>`
    }
    return `<p><span class="bullet-dot">•</span> ${l.replace(/^•\s*/, '')}</p>`
  }).join('')}
            </div>

            <div class="terms-col-right">
              ${installationTermsRaw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    return `<p><span class="bullet-dot">•</span> ${l.replace(/^•\s*/, '')}</p>`
  }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">PAGE 03</div>
      </div>
    </div>

    <!-- PAGE 4: TERMS, ACCEPTANCE & AUTHORIZED SIGNATURE -->
    <div class="page">
      <div>
        <img class="header-logo-img" src="${headerImg}" alt="Success Solar Power Care" />
        <h2 class="company-header-title">SUCCESS SOLAR POWER CARE</h2>

        <div class="terms-box-pg4">
          <h4>TERMS & CONDITIONS</h4>
          <div class="terms-list-pg4">
            ${termsAndConditionsRaw.split('\n').map(l => l.trim()).filter(Boolean).map((l, idx) => {
    const cleaned = l.replace(/^\d+[\.\)]\s*/, '').replace(/^[•\-]\s*/, '')
    return `
                <div class="term-row-pg4">
                  <span class="term-num-pg4">${idx + 1}.</span>
                  <span class="term-text-pg4">${cleaned}</span>
                </div>
              `
  }).join('')}
          </div>
        </div>

        <div class="sign-section">
          <div class="sign-block">
            <div class="sign-line"></div>
            <div class="sign-label">Customer Signature</div>
            <div class="sign-title">Acknowledged & Accepted</div>
          </div>

          <div class="sign-block">
            <div class="seal-box">
              SUCCESS SOLAR<br/>POWER CARE<br/>★ SEAL ★
            </div>
            <div class="sign-line"></div>
            <div class="sign-label">Authorized Signatory</div>
            <div class="sign-title">For Success Solar Power Care</div>
          </div>
        </div>
      </div>

      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">PAGE 04</div>
      </div>
    </div>

  </div>

</body>
</html>`

  return html
}

export function openInvoiceDocument(invoice: Invoice, quotation?: Quotation | null, print = false) {
  const html = getInvoiceHtml(invoice, quotation)
  const windowRef = window.open('', '_blank')
  if (windowRef) {
    windowRef.document.write(html)
    windowRef.document.close()
    if (print) {
      windowRef.onload = () => windowRef.print()
    }
  }
}

export async function downloadInvoicePDF(invoice: Invoice, quotation?: Quotation | null): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2canvasModule = await import('html2canvas') as any
  const html2canvas = html2canvasModule.default || html2canvasModule

  const { jsPDF } = await import('jspdf')

  const html = getInvoiceHtml(invoice, quotation)

  return new Promise<void>((resolve, reject) => {
    // Create an isolated hidden iframe with full height so all pages are rendered cleanly
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.width = '210mm'
    iframe.style.height = '6000px'
    iframe.style.border = 'none'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    iframe.style.zIndex = '-9999'

    document.body.appendChild(iframe)

    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
    }

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) {
      cleanup()
      reject(new Error('Cannot access iframe document'))
      return
    }

    iframeDoc.open()
    iframeDoc.write(html)
    iframeDoc.close()

    const runGeneration = async () => {
      try {
        // Wait for all images inside iframe to load completely
        const imgs = Array.from(iframeDoc.querySelectorAll('img'))
        await Promise.all(
          imgs.map((img) => {
            if (img.complete && img.naturalHeight > 0) return Promise.resolve()
            return new Promise<void>((res) => {
              img.onload = () => res()
              img.onerror = () => res()
              setTimeout(res, 2000)
            })
          })
        )

        // Wait for fonts & layout computation
        await new Promise((res) => setTimeout(res, 250))

        const pages = Array.from(iframeDoc.querySelectorAll('.page')) as HTMLElement[]
        if (!pages.length) {
          throw new Error('No invoice pages found')
        }

        // Hide no-print-bar
        const noPrint = iframeDoc.querySelector('.no-print-bar') as HTMLElement | null
        if (noPrint) noPrint.style.display = 'none'

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        })

        for (let i = 0; i < pages.length; i++) {
          const pageEl = pages[i]

          // Render each page with exact computed styles
          const canvas = await html2canvas(pageEl, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          })

          const imgData = canvas.toDataURL('image/jpeg', 0.95)

          if (i > 0) {
            pdf.addPage('a4', 'portrait')
          }

          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
        }

        const filename = `Invoice_${invoice.invoiceNumber || 'Document'}.pdf`
        pdf.save(filename)

        cleanup()
        resolve()
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    if (iframeDoc.readyState === 'complete') {
      runGeneration()
    } else {
      iframe.onload = runGeneration
    }
  })
}



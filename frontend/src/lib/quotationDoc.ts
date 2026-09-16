import type { Quotation } from '../types/models'
import { formatINR, formatDate } from './utils'
import headerImg from '../assets/header_pdf_qu.png'
import homeImg from '../assets/Home_page _quo.png'
import pmYojanaImg from '../assets/PM_yojana.png'

function formatAddress(addr: string): string {
  if (!addr) return ''
  // Matches city/district name and pincode at the end: e.g. "Trichy - 620020" or "Trichy 620020"
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

// Generates an exact 4-page Solar Quotation PDF matching Success Solar Power Care reference design.
export function getQuotationHtml(q: Quotation): string {
  const items = q.lineItems ?? []
  const firstItem = items[0]
  const productName = firstItem?.product || 'SOLAR POWER PLANT (ONGRID AND OFF GRID)'
  const siteQrCodeUrl = window.location.origin + '/site_qr_code.png'

  // Format multiline product description or bullet points
  const rawDesc = firstItem?.description ||
    '• 5 kW On-Grid Solar Power System\n' +
    '• High-efficiency mono-crystalline solar panels with standard mounting arrangement\n' +
    '• 5 kW grid-tied solar inverter with monitoring and protection system\n' +
    '• GI mounting structure, DC/AC protection, earthing, cables, installation, testing & Commissioning'

  const formattedDesc = rawDesc
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.startsWith('•') ? line : `• ${line}`)
    .join('<br/>')

  const kilowattVal = firstItem ? `${firstItem.unit || 'kW'}` : '5.5kw On Grid'

  // formatINR returns '₹33,040' directly. Do NOT add an extra '₹' prefix to avoid '₹₹'.
  const grandTotalFormatted = q.grandTotal ? formatINR(q.grandTotal) : '₹2,73,000'
  const subsidyVal = (q as any).subsidyAmount ? `Rs.${formatINR((q as any).subsidyAmount)}/` : 'Rs.78,000.00/'

  const footerLeftHtml = `
    <div class="footer-left">
      <div class="footer-item">
        <div class="footer-icon">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="white">
            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.57a1.024 1.024 0 0 0-1.02.24l-2.2 2.2a15.149 15.149 0 0 1-6.59-6.59l2.2-2.2a1.024 1.024 0 0 0 .24-1.02c-.38-1.11-.57-2.3-.57-3.53C8.34 3.61 7.73 3 7 3H3.5C2.78 3 2 3.78 2 4.5 2 14.17 9.83 22 19.5 22c.72 0 1.5-.78 1.5-1.5v-3.5c0-.73-.61-1.34-1.34-1.34z"/>
          </svg>
        </div>
        9787400555,9787400666

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
  <title>Quotation_${q.quotationNumber || 'Document'}</title>
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
      margin: 8px auto 12px auto;
    }
    .gst-badge span {
      background: #0b2545;
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 800;
      padding: 4px 18px;
      border-radius: 6px;
      letter-spacing: 0.5px;
      display: inline-block;
      margin-bottom: 20px;
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
      // padding:5px;
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
      // background: #0b2545;
      color: #0b2545;
      font-weight: 800;
      margin-top: 40px;
      font-size: 19px;
      padding: 9px 14px;
      border-radius: 6px 6px 0 0;
      letter-spacing: 0.4px;
      display: flex;
      align-items: center;
      margin-bottom: 18px;
      gap: 8px;
    }
    .pdf-table {
      width: 100%;
      marign-top:20px;
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
      padding: 9px;
      font-size: 13px;
      vertical-align: top;
      line-height:2;
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

    .subsidy-box {
      background: #cbe3fa;
      border-radius: 12px;
      padding: 16px 20px;
      margin-top: 18px;
    }
    .subsidy-title {
      font-weight: 900;
      font-size: 18px;
      color: #0b2545;
      margin-bottom: 4px;
    }
    .subsidy-subtext {
      font-size: 14px;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 10px;
    }
    .subsidy-amount {
      font-size: 22px;
      font-weight: 900;
      color: #0b2545;
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
      font-size: 14.5px;
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

    .partner-contact-box {
      background: #e8f5e9;
      border: 1px solid #a5d6a7;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 16px;
      color: #1b5e20;
      line-height: 2.1;
      text-align: center;
    }
    .partner-contact-box strong {
      font-weight: 900;
      color: #0b2545;
    }

    /* Page 4 Styles */
    .vendor-title-bar {
      background: #0b2545;
      color: #ffffff;
      font-weight: 800;
      font-size: 15px;
      padding: 10px 16px;
      border-radius: 6px;
      letter-spacing: 0.4px;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 40px;
      marign-bottom: 20px
      font-family: Arial, Helvetica, sans-serif;
    }
    .instructions-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 14px 0 18px 0;
    }
    .instruction-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 20px;
      line-height: 1.45;
      color: #1e293b;
      margin-bottom: 15px;
    }
    .num-circle {
      width: 22px;
      height: 22px;
      background: #f57c00;
      color: #ffffff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 11px;
      flex-shrink: 0;
    }

    .pm-yojana-img {
      width: 100%;
      height: auto;
      max-height: 450px;
      object-fit: contain;
      border-radius: 8px;
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <span>Quotation ${q.quotationNumber || ''} — 4-Page Print Preview</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>

  <div class="page-container">

    <!-- PAGE 1 -->
    <div class="page">
      <!-- Top Right Social Media Links -->
      <div class="top-social-links" style="position: absolute; bottom: 18mm; right: 16mm; display: flex; align-items: center; gap: 8px; z-index: 20;">
        <a href="https://www.facebook.com/people/Success-Solar-Power-Care/61575903976773/#" target="_blank" rel="noopener noreferrer" title="Facebook" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #1877F2; color: #ffffff; text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
        </a>
        <a href="https://www.instagram.com/success_solar_123/" target="_blank" rel="noopener noreferrer" title="Instagram" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%); color: #ffffff; text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
        </a>
        <a href="https://www.youtube.com/@successsolarpowercare" target="_blank" rel="noopener noreferrer" title="YouTube" style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #FF0000; text-decoration: none; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.42A2.5 2.5 0 0 0 2.42 7.19 26.3 26.3 0 0 0 2 12a26.3 26.3 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.3 26.3 0 0 0 22 12a26.3 26.3 0 0 0-.42-4.81z" fill="#FFFFFF"/>
            <polygon points="10 15 15 12 10 9" fill="#FF0000"/>
          </svg>
        </a>
      </div>
      <div>
        <!-- Top Header Logo -->
        <img src="${headerImg}" class="header-logo-img" alt="Company Logos" />

        <!-- Title & Subtitle -->
        <div class="company-header-title">SUCCESS SOLAR POWER CARE</div>
        <div class="company-header-subtitle">Manufacturer of Solar Street Light</div>
        <div class="gst-badge"><span>GST No: 33ADFFS8189JZH</span></div>

        <!-- Solar Banner Image -->
        <img src="${homeImg}" class="home-banner-img" alt="Solar House Project" />

        <!-- Customer Info & Quotation Meta -->
        <div class="customer-section">
          <div class="customer-card">
            <div class="customer-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div class="customer-details">
              <strong>TO,</strong><br/>
              ${(q.customerName || '').toUpperCase()}<br/>
              ${formatAddress(q.site || '')}${q.site ? '<br/>' : ''}
              ${q.ebNumber ? `EB NUMBER: ${q.ebNumber}` : ''}
            </div>
          </div>

          <div class="divider-line"></div>

          <div class="quotation-meta-card">
            <div><strong>Quotation No:</strong> ${q.quotationNumber || ''}</div>
            <div><strong>Date:</strong> ${formatDate(q.date)}</div>
          </div>
        </div>

        <!-- Our Product Details -->
        <div class="products-list-box" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
          <div style="flex: 1;">
            <div class="products-heading">OUR PRODUCT DETAILS:</div>
            <div class="products-grid">
              <div class="product-list-item"><span class="check-icon"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> SOLAR POWER PLANT (ONGRID AND OFF GRID)</div>
              <div class="product-list-item"><span class="check-icon"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> SOLAR WATER HEATER</div>
              <div class="product-list-item"><span class="check-icon"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> SOLAR POWER PLANT HYBRIDE</div>
              <div class="product-list-item"><span class="check-icon"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> SOLAR STREET LIGHT</div>
              <div class="product-list-item"><span class="check-icon"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> SOLAR PUMPSET</div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; padding-right: 5px; margin-top: 15px;">
            <img src="${siteQrCodeUrl}" style="width: 100px; height: 100px; border: 1px solid #ddd; padding: 4px; border-radius: 4px; background: #fff; display: block;" alt="Site QR Code" />
            <div style="font-size: 8px; color: #555; margin-top: 4px; font-weight: 700; letter-spacing: 0.3px; text-align: center;">SCAN FOR DETAILS</div>
          </div>
        </div>

        <!-- Quote Message Box -->
        <div class="quote-msg-box">
          <div class="quote-mark">❝</div>
          <div class="quote-msg-content">
            <div class="quote-msg-title">Quote for Supply of Solar on grid Project</div>
            Thank you for your enquiry and desire over solar on grid project as per our conversation and we are submitting our best offer quoted.
          </div>
        </div>
      </div>

      <!-- Common Footer -->
      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">Page 1 of 4</div>
      </div>
    </div>

    <!-- PAGE 2 -->
    <div class="page">
      <div>
        <div class="section-title-bar">
          <span>PRODUCT :</span> <span style="color: #e65100;">${productName.toUpperCase()}</span>
        </div>

        <table class="pdf-table">
          <thead>
            <tr>
              <th class="col-sno">S.NO</th>
              <th class="col-desc">DESCRIPTION</th>
              <th class="col-kw">KILOWATT</th>
              <th class="col-amt">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="col-sno">1</td>
              <td class="col-desc">${formattedDesc}</td>
              <td class="col-kw" rowspan="4" style="vertical-align: middle; text-align: center; font-size: 15px; font-weight: 800;">${kilowattVal}</td>
              <td class="col-amt" rowspan="4" style="vertical-align: middle; text-align: right; font-size: 15px; font-weight: 800;">${grandTotalFormatted}</td>
            </tr>
            <tr>
              <td class="col-sno">2</td>
              <td class="col-desc">CONCRETE PILLAR WORK FOR STRUCTURE LEG , SPRINKLER SYSTEM WITH MOTOR , & EB NETMETER PAYMENT</td>
            </tr>
            <tr>
              <td class="col-sno">3</td>
              <td class="col-desc">
                ${formatComponentDetail('SOLAR PANEL', q.solarPanel || 'VIKRAM BIFACIAL DCR SOLAR PANEL (GOVT. ALMM APPROVED PANEL)')}
              </td>
            </tr>
            <tr>
              <td class="col-sno">4</td>
              <td class="col-desc">
                ${formatComponentDetail('SOLAR INVERTER', q.solarInverter || 'VSOLE INVERTER (BIS STANDARD APPROVED / GOVT. APPROVED)')}
              </td>
            </tr>
            <tr class="table-total-row">
              <td colspan="3" style="text-align: right; padding-right: 14px; vertical-align: middle;">TOTAL PROJECT AMOUNT</td>
              <td style="text-align: right; color: red; vertical-align: middle; line-height: 1.3;">
                <div style="font-size: 14px; font-weight: 900;">${grandTotalFormatted}</div>
                <div style="font-size: 7.5px; font-weight: 800;">(Including all GST)</div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- PM Surya Ghar Subsidy Box -->
        <div class="subsidy-box">
          <div class="subsidy-title">PM -SURYA GHAR :</div>
          <div class="subsidy-subtext">
            MUFT BIJLI YOJANA SUBSIDY AMOUNT (amount credit will be your bank account from national portal after work completed and process from EB SIDE )
          </div>
          <div class="subsidy-amount">${subsidyVal}</div>
        </div>
      </div>

      <!-- Common Footer -->
      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">Page 2 of 4</div>
      </div>
    </div>

    <!-- PAGE 3 -->
    <div class="page">
      <div>
        <div class="two-cards-grid">
          <!-- Registered Office Card -->
          <div class="info-card">
            <div class="info-card-header">
              <span>🏛</span> REGISTERED OFFICE
            </div>
            <div class="info-card-body">
              <strong>SUCCESS SOLAR POWER CARE</strong><br/>
              Old no 7, New no 39/9, 3rd main road,<br/>
              Thirungar, Karumandapam,<br/>
              Trichy-620001<br/>
              <strong>Mobile:</strong>9787400555,9787400666
<br/>
              <strong>Email:</strong> successsolarmedia@gmail.com<br/>
              <strong>GSTNo:</strong> 33ADFFS8189JZH
            </div>
          </div>

          <!-- Bank Details Card -->
          <div class="info-card">
            <div class="info-card-header">
              <span>🏦</span> BANK DETAILS
            </div>
            <div class="info-card-body">
              <strong>Bank:</strong> HDFC BANK<br/>
              <strong>Account Name:</strong> SUCCESS SOLAR POWER CARE<br/>
              <strong>Account Number:</strong> 502000073050134<br/>
              <strong>IFSC:</strong> HDFC0009148<br/>
              <strong>Branch:</strong> PONNAGAR, TRICHY.
            </div>
          </div>
        </div>

        <div class="terms-container">
          <div class="terms-title-tab">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="white" style="margin-right: 8px;">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            TERMS & CONDITIONS :
          </div>
          <div class="terms-grid">
            <div class="terms-col-left">
              ${(q.installationTerms ||
      `• GST: ${items[0]?.gstPercent ?? 18}% Included.\n` +
      '• Mounting work : Included\n' +
      '• Transport : Included.\n' +
      '• Installation: Included\n' +
      '• Validity to quote: 15Days\n' +
      '• Project time:10 To 15days\n' +
      '• Mounting structure: Included')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const clean = l.replace(/^•\s*/, '')
        return `<p><span class="bullet-dot">•</span><span>${clean}</span></p>`
      })
      .join('')}
              <p><span class="bullet-dot">•</span><span>${q.warrantyTerms || 'Warranty:10 Years for Inverter & 30 years Performance Warranty for Panel'}</span></p>
            </div>
            <div class="terms-col-right">
              <p><span class="bullet-dot">•</span><span>Scope of Customer: Water, Electricity and space for installation, construction of control room</span></p>
              <p><span class="bullet-dot">•</span><span>${q.paymentTerms?.includes('Payment:') ? q.paymentTerms.split('\n')[0] : `Payment: ${q.paymentTerms || `${q.advancePercentage ?? 70}% advance payment & ${100 - (q.advancePercentage ?? 70)}% Payment on after Material delivery With Work Completion.`}`}</span></p>
              <div class="warning-text-red">
                (It is important to note that the balance payment should be settled after the completion of solar work and this has nothing to do with E.B work sir)
              </div>
              <p><span class="bullet-dot">•</span><span>Net meter Payment: Application and arrangement is our scope and its Related cost to Be borne by client scope.</span></p>
              <p><span class="bullet-dot">•</span><span>Civil: customer scope</span></p>
            </div>
          </div>
        </div>

        <!-- Partner Contact Box -->
        <div class="partner-contact-box">
          <strong>For : SUCCESS SOLAR POWER CARE</strong><br/>
          M IYAPPAN ALEXI (PARTNERS)<br/>
          <strong>CELL: 9787400555 / 9787400555,9787400666
</strong>
        </div>
      </div>

      <!-- Common Footer -->
      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">Page 3 of 4</div>
      </div>
    </div>

    <!-- PAGE 4 -->
    <div class="page">
      <div>
        <div class="vendor-title-bar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          EMPANELLED VENDOR DETAILS – PM SURYA GHAR YOJANA
        </div>

        <div class="instructions-list">
          <div class="instruction-item">
            <div class="num-circle">1</div>
            <div>Open the PM Surya Ghar National Portal and navigate to the registered/empanelled vendor listing.</div>
          </div>
          <div class="instruction-item">
            <div class="num-circle">2</div>
            <div>Select your State/DISCOM.</div>
          </div>
          <div class="instruction-item">
            <div class="num-circle">3</div>
            <div>Search for the vendor by name or use the available vendor-list filters.</div>
          </div>
          <div class="instruction-item">
            <div class="num-circle">4</div>
            <div>Verify the vendor's name, State and contact details.</div>
          </div>
          <div class="instruction-item">
            <div class="num-circle">5</div>
            <div>Contact the selected registered vendor for site survey, system sizing and quotation.</div>
          </div>
          <div class="instruction-item">
            <div class="num-circle">6</div>
            <div>Proceed with the vendor only after confirming the vendor's current empanelment status on the portal/DISCOM.</div>
          </div>
        </div>

        <!-- PM Yojana Screenshot Image -->
        <img src="${pmYojanaImg}" class="pm-yojana-img" alt="PM Surya Ghar Vendor Listing" />
      </div>

      <!-- Common Footer -->
      <div class="footer">
        ${footerLeftHtml}
        <div class="footer-right">Page 4 of 4</div>
      </div>
    </div>

  </div>

</body>
</html>`

  return html
}

export function openQuotationDocument(q: Quotation, print = false) {
  const html = getQuotationHtml(q)
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    if (print) {
      win.onload = () => win.print()
    }
  }
}

export async function downloadQuotationPDF(q: Quotation): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2canvasModule = await import('html2canvas') as any
  const html2canvas = html2canvasModule.default || html2canvasModule

  const { jsPDF } = await import('jspdf')

  const html = getQuotationHtml(q)

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
          throw new Error('No quotation pages found')
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

        const filename = `Quotation_${q.quotationNumber || 'Document'}.pdf`
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

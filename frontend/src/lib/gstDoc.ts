import type { GstEntry } from './gst'
import { formatDate, formatINR } from './utils'

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character))

export function openGstMonthReport(month: string, entries: GstEntry[]) {
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const verifiedRevenue = entries.reduce((total, entry) => total + entry.verifiedAmount, 0)
  const taxableRevenue = entries.reduce((total, entry) => total + entry.taxableAmount, 0)
  const gstPayable = entries.reduce((total, entry) => total + entry.gstAmount, 0)
  const rows = entries.map((entry) => `<tr><td>${escapeHtml(entry.project.projectCode)}<br><small>${escapeHtml(entry.project.customerName)}</small></td><td>${escapeHtml(entry.invoice.invoiceNumber)}</td><td>${formatDate(entry.verificationDate)}</td><td>${formatINR(entry.invoiceAmount)}</td><td>${formatINR(entry.verifiedAmount)} (${entry.verificationPercentage.toFixed(0)}%)</td><td>${formatINR(entry.taxableAmount)}</td><td>${formatINR(entry.gstAmount)}</td></tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>GST Payable - ${label} · Success Solar Power Care</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:32px;max-width:980px;margin:auto}h1{margin:0;font-size:22px}.muted,small{color:#687386;font-size:12px}.summary{display:flex;gap:18px;margin:20px 0}.summary div{border:1px solid #dce3ed;padding:10px;border-radius:6px;min-width:150px}.summary b{display:block;margin-top:4px;font-size:16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #dce3ed;padding:8px;text-align:left}th{background:#f4f6f9;text-transform:uppercase;font-size:10px}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="float:right;padding:8px 14px;background:#2f5fd9;color:white;border:0;border-radius:6px">Print / Save as PDF</button><h1>Success Solar Power Care</h1><p class="muted">GST Payable Register · ${escapeHtml(label)}<br>Generated: ${escapeHtml(new Date().toLocaleString('en-IN'))}</p><div class="summary"><div>Verified Revenue<b>${formatINR(verifiedRevenue)}</b></div><div>Taxable Revenue<b>${formatINR(taxableRevenue)}</b></div><div>GST Payable<b>${formatINR(gstPayable)}</b></div></div><table><thead><tr><th>Project</th><th>Invoice</th><th>Verified Date</th><th>Invoice Amount</th><th>Verified Amount</th><th>Taxable Revenue</th><th>GST Payable</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
  const report = window.open('', '_blank')
  if (report) { report.document.write(html); report.document.close(); report.onload = () => report.print() }
}

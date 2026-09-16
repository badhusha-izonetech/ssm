import type { RevenueProject } from '../api/revenue'
import { formatDate, formatINR } from './utils'

const esc = (v: string) =>
  v.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] ?? c))

interface Cards {
  overall: number
  totalCollections: number
  pendingReceivables: number
  fullyPaidProjects: number
  partiallyPaidProjects: number
}

export function openRevenueReport(
  rows: RevenueProject[],
  _allRows: RevenueProject[],
  rangeLabel: string,
  cards: Cards,
  generatedAt: string,
) {
  // Date-wise summary
  const daily: Record<string, number> = {}
  for (const r of rows) {
    if (r.fullyPaidDate) daily[r.fullyPaidDate] = (daily[r.fullyPaidDate] ?? 0) + r.revenue
  }
  const dailyRows = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, v]) => `<tr><td>${esc(formatDate(d))}</td><td style="text-align:right">${formatINR(v)}</td></tr>`)
    .join('') || '<tr><td colspan="2">No data for this period.</td></tr>'

  // Project table
  const projectRows = rows
    .map(
      (r) => `<tr>
        <td>${esc(r.projectCode)}<br><small>${esc(r.customerName)}</small></td>
        <td>${r.fullyPaidDate ? esc(formatDate(r.fullyPaidDate)) : '—'}</td>
        <td style="text-align:right">${formatINR(r.projectValue)}</td>
        <td style="text-align:right">${formatINR(r.amountReceived)}</td>
        <td style="text-align:right">${formatINR(r.pendingAmount)}</td>
        <td style="text-align:right">${r.verifiedPct.toFixed(0)}%</td>
        <td style="text-align:right">${formatINR(r.revenue)}</td>
        <td>${esc(r.paymentStatus)}</td>
        <td>${esc(r.finalVerifier ?? '—')}</td>
      </tr>`,
    )
    .join('') || '<tr><td colspan="9">No fully paid projects in this period.</td></tr>'

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Revenue Report – ${esc(rangeLabel)}</title>
<style>
  body{font-family:Arial,sans-serif;color:#172033;padding:32px;max-width:960px;margin:auto}
  h1{margin:0 0 4px;font-size:22px} h2{font-size:15px;margin:24px 0 8px}
  .muted{color:#687386;font-size:12px} .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;background:#e8f5f3;color:#1a8b7a}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}
  .kpi{background:#f4f6f9;border-radius:8px;padding:12px} .kpi .val{font-size:18px;font-weight:700} .kpi .lbl{font-size:11px;color:#687386;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
  th,td{border:1px solid #dce3ed;padding:7px 10px;text-align:left} th{background:#f4f6f9;text-transform:uppercase;font-size:10px}
  small{color:#687386} tfoot td{font-weight:700;background:#f4f6f9}
  @media print{button{display:none}}
</style></head><body>
<button onclick="window.print()" style="float:right;padding:8px 14px;background:#2f5fd9;color:white;border:0;border-radius:6px;cursor:pointer">🖨 Print / Save PDF</button>
<h1>Success Solar Power Care</h1>
<p class="muted">Revenue Generation Report &nbsp;·&nbsp; Period: <strong>${esc(rangeLabel)}</strong><br>Generated: ${esc(generatedAt)}</p>

<h2>Summary</h2>
<div class="summary-grid">
  <div class="kpi"><div class="val">${formatINR(cards.overall)}</div><div class="lbl">Total Realized Revenue</div></div>
  <div class="kpi"><div class="val">${formatINR(cards.totalCollections)}</div><div class="lbl">Total Collections Received</div></div>
  <div class="kpi"><div class="val">${formatINR(cards.pendingReceivables)}</div><div class="lbl">Pending Receivables</div></div>
  <div class="kpi"><div class="val">${cards.fullyPaidProjects}</div><div class="lbl">Fully Paid Projects</div></div>
  <div class="kpi"><div class="val">${cards.partiallyPaidProjects}</div><div class="lbl">Partially Paid Projects</div></div>
</div>

<h2>Date-wise Revenue</h2>
<table><thead><tr><th>Date</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${dailyRows}</tbody>
<tfoot><tr><td>Total</td><td style="text-align:right">${formatINR(cards.overall)}</td></tr></tfoot></table>

<h2>Project-wise Breakdown</h2>
<table><thead><tr><th>Project / Customer</th><th>Fully Paid Date</th><th style="text-align:right">Total Amount</th><th style="text-align:right">Received</th><th style="text-align:right">Pending</th><th style="text-align:right">Verified %</th><th style="text-align:right">Revenue</th><th>Status</th><th>Verifier</th></tr></thead><tbody>${projectRows}</tbody>
<tfoot><tr><td colspan="6">Total Realized Revenue</td><td style="text-align:right">${formatINR(cards.overall)}</td><td colspan="2"></td></tr></tfoot></table>
</body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }
}

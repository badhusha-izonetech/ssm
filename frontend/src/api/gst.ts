import { fetchClient } from './client'

export interface GSTSummary {
  label: string
  period_start: string
  period_end: string
  total_invoices: number
  taxable_amount: number
  gst_payable: number
  invoice_total: number
}

export interface InvoiceGSTEntry {
  id: string
  invoice_number: string
  customer_name: string
  issue_date: string
  taxable_amount: number
  gst_percent: number
  gst_amount: number
  grand_total: number
}

export interface GSTPeriod {
  id: string
  period_month: string
  total_invoices: number
  taxable_amount: number
  gst_payable: number
  invoice_total: number
  is_paid: boolean
  paid_date?: string
}

export const gstApi = {
  getSummary: () => fetchClient('/gst/summary'),
  getRegister: (periodType: string, from?: string, to?: string) => {
    let url = `/gst/reports/${periodType}/invoices`
    if (periodType === 'custom' && from && to) {
      url += `?from_date=${from}&to_date=${to}`
    }
    return fetchClient(url)
  },
  getPeriods: () => fetchClient('/gst/periods'),
  markPaid: (periodMonth: string) => fetchClient(`/gst/periods/${periodMonth}/mark-paid`, { method: 'POST', body: JSON.stringify({}) }),
}

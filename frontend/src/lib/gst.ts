import type { Invoice, Payment, Project, Quotation } from '../types/models'
import { dateKey } from './revenue'

export interface GstEntry {
  id: string; project: Project; invoice: Invoice; payment: Payment; verificationDate: string; payableMonth: string
  invoiceAmount: number; verifiedAmount: number; taxableAmount: number; gstAmount: number; gstPercent: number; verificationPercentage: number
}

export function nextMonth(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMonth(date.getMonth() + 1, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Uses accountant-verified receipts only; each receipt receives a proportional share of quotation GST and is payable next month. */
export function gstEntries(projects: Project[], payments: Payment[], invoices: Invoice[], quotations: Quotation[]): GstEntry[] {
  return payments.flatMap((payment) => {
    if ((payment.state !== 'Verified' && payment.state !== 'Partial') || payment.verifiedAmount === undefined) return []
    const project = projects.find((item) => item.id === payment.projectId)
    if (!project) return []
    const invoice = invoices.find((item) => item.quotationId === project.quotationId)
    const quotation = quotations.find((item) => item.id === project.quotationId)
    const verificationDate = dateKey(payment.verifiedOn ?? payment.paymentDate)
    if (!invoice || !quotation || !verificationDate || invoice.grandTotal <= 0) return []
    const verifiedAmount = Math.min(payment.verifiedAmount, invoice.grandTotal)
    const totalGst = invoice.gstAmount ?? quotation.taxTotal ?? 0
    const defaultPercent = totalGst > 0 && invoice.grandTotal > totalGst ? (totalGst / (invoice.grandTotal - totalGst)) * 100 : 0
    const gstPercent = invoice.gstPercent ?? defaultPercent
    const gstAmount = totalGst * (verifiedAmount / invoice.grandTotal)
    return [{ id: `${invoice.id}-${payment.id}`, project, invoice, payment, verificationDate, payableMonth: nextMonth(verificationDate), invoiceAmount: invoice.grandTotal, verifiedAmount, taxableAmount: Math.max(0, verifiedAmount - gstAmount), gstAmount, gstPercent, verificationPercentage: Math.min(100, (verifiedAmount / invoice.grandTotal) * 100) }]
  })
}

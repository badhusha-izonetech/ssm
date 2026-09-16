export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(iso: string): string {
  if (!iso || iso === '—') return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

export const STAGE_ORDER = [
  'Site Visit',
  'Quotation',
  'Advance Payment',
  'Project Execution',
  'Installation',
  'Final Connection',
  'Completed',
] as const

export function stageIndex(stage: string): number {
  return STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number])
}

export const STATUS_COLORS: Record<string, string> = {
  // Green - Success / Active / Approved / Completed
  'On Track': 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Completed: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Converted: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  'Customer Approved': 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Verified: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  'Proof Uploaded': 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Active: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Approved: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Feasible: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Delivered: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Arrived: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  'Checked In': 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  'On Field': 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Ready: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  'Meter Installed': 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Connected: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Contacted: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  Interested: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',

  // Blue - In Progress / Scheduled / Communication
  'In Progress': 'text-sky-700 bg-sky-50 border-sky-200/80',
  'On Route': 'text-sky-700 bg-sky-50 border-sky-200/80',
  'Trip Started': 'text-sky-700 bg-sky-50 border-sky-200/80',
  Returning: 'text-sky-700 bg-sky-50 border-sky-200/80',
  'Quotation Stage': 'text-sky-700 bg-sky-50 border-sky-200/80',
  'Site Visit Scheduled': 'text-sky-700 bg-sky-50 border-sky-200/80',
  'Site Visit Required': 'text-sky-700 bg-sky-50 border-sky-200/80',
  'Inspection Scheduled': 'text-sky-700 bg-sky-50 border-sky-200/80',
  'Application Submitted': 'text-sky-700 bg-sky-50 border-sky-200/80',
  Submitted: 'text-sky-700 bg-sky-50 border-sky-200/80',
  Sent: 'text-sky-700 bg-sky-50 border-sky-200/80',
  'Customer Review': 'text-sky-700 bg-sky-50 border-sky-200/80',
  Upcoming: 'text-sky-700 bg-sky-50 border-sky-200/80',

  // Amber - Pending / Action Required / Warning
  Pending: 'text-amber-700 bg-amber-50 border-amber-200/80',
  'Under Verification': 'text-amber-700 bg-amber-50 border-amber-200/80',
  'Awaiting Advance': 'text-amber-700 bg-amber-50 border-amber-200/80',
  'Documents Pending': 'text-amber-700 bg-amber-50 border-amber-200/80',
  'Follow-up': 'text-amber-700 bg-amber-50 border-amber-200/80',
  Partial: 'text-amber-700 bg-amber-50 border-amber-200/80',
  'On Leave': 'text-amber-700 bg-amber-50 border-amber-200/80',
  'Revisit Required': 'text-amber-700 bg-amber-50 border-amber-200/80',
  'Feasible with Conditions': 'text-amber-700 bg-amber-50 border-amber-200/80',
  'Pending CEO Assignment': 'text-amber-700 bg-amber-50 border-amber-200/80',

  // Red / Rose - Delayed / Issues / Lost / Rejected
  Delayed: 'text-rose-700 bg-rose-50 border-rose-200/80',
  'Issue Raised': 'text-rose-700 bg-rose-50 border-rose-200/80',
  Lost: 'text-rose-700 bg-rose-50 border-rose-200/80',
  'Not Interested': 'text-rose-700 bg-rose-50 border-rose-200/80',
  'Revision Required': 'text-rose-700 bg-rose-50 border-rose-200/80',
  'Customer Rejected': 'text-rose-700 bg-rose-50 border-rose-200/80',
  Rejected: 'text-rose-700 bg-rose-50 border-rose-200/80',
  Expired: 'text-rose-700 bg-rose-50 border-rose-200/80',
  Suspended: 'text-rose-700 bg-rose-50 border-rose-200/80',
  'Not Feasible': 'text-rose-700 bg-rose-50 border-rose-200/80',
  'Customer Requirement Not Supported': 'text-rose-700 bg-rose-50 border-rose-200/80',

  // Slate - Neutral / Informational / Baseline
  New: 'text-slate-600 bg-slate-100 border-slate-200',
  'On Hold': 'text-slate-600 bg-slate-100 border-slate-200',
  'Quotation Created': 'text-slate-600 bg-slate-100 border-slate-200',
  Relieved: 'text-slate-600 bg-slate-100 border-slate-200',
  Assigned: 'text-slate-600 bg-slate-100 border-slate-200',
  'Checked Out': 'text-slate-600 bg-slate-100 border-slate-200',
}

export function statusClass(status: string): string {
  return STATUS_COLORS[status] ?? 'text-slate-600 bg-slate-100 border-slate-200'
}

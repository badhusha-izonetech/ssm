import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useMarketing } from '../../store/MarketingStore'

import { Card, KpiCard, SectionHeading, Pill, PriorityDot } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'

export default function MarketingDashboard() {
  const { employee, portal } = useAuth()
  const { leads, quotations } = useMarketing()

  const myLeads = useMemo(
    () => (portal === 'Telecalling' ? leads.filter((l) => l.assignedEmployeeId === employee?.id) : leads),
    [leads, portal, employee],
  )

  const newCount = myLeads.filter((l) => l.status === 'New').length
  const followUpCount = myLeads.filter((l) => l.status === 'Follow-up' || l.status === 'Site Visit Required').length
  const convertedCount = myLeads.filter((l) => l.status === 'Converted').length
  const conversionRate = myLeads.length ? Math.round((convertedCount / myLeads.length) * 100) : 0
  const myQuotations = quotations.filter((q) => q.preparedBy === employee?.name)

  const recent = [...myLeads].sort((a, b) => (a.firstContactDate < b.firstContactDate ? 1 : -1)).slice(0, 6)

  return (
    <div className="space-y-6">
      <DashboardBanner
        title={`Welcome back, ${employee?.name?.split(' ')[0] ?? ''}`}
        subtitle={portal === 'Telecalling' ? 'Telecaller Lead Management & Inbound Follow-ups' : 'Direct Field Marketing & Customer Consultations'}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="New Leads" value={String(newCount)} sub="Awaiting first contact" accent="sun" />
        <KpiCard label="Follow-ups Due" value={String(followUpCount)} sub="Needs a call today" accent="rose" />
        <KpiCard label="Converted" value={String(convertedCount)} sub={`${conversionRate}% conversion`} accent="teal" />
        <KpiCard label="Quotations Sent" value={String(myQuotations.length)} sub="Prepared by you" accent="sun" />
      </div>

      <Card className="p-4">
        <SectionHeading
          eyebrow="Pipeline"
          title="Recent leads"
          action={<Link to="/marketing/leads" className="text-xs text-sun hover:underline">View Lead Inbox →</Link>}
        />
        <div className="space-y-2">
          {recent.map((l) => (
            <div key={l.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 border-t border-border pt-2.5 first:border-t-0 first:pt-0 text-sm">
              <span className="font-medium w-44 shrink-0 truncate">{l.customerName}</span>
              <span className="text-text-dim text-xs w-32 shrink-0">{l.mobile}</span>
              <span className="text-text-dim text-xs flex-1 truncate">{l.productInterested}</span>
              <PriorityDot priority={l.priority} />
              <Pill status={l.status} />
            </div>
          ))}
          {recent.length === 0 && <div className="text-sm text-text-dim py-6 text-center">No leads yet.</div>}
        </div>
      </Card>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useApp } from '../../store/AppStore'
import { useAuth } from '../../auth/AuthContext'
import { Card, SectionHeading, KpiCard, Pill } from '../../components/shared/Primitives'
import { DashboardBanner } from '../../components/shared/DashboardBanner'
import { formatDate } from '../../lib/utils'
import { FileText, AlertCircle } from 'lucide-react'
import { ebApplicationsApi } from '../../api/ebApplications'
import type { EbDashboardCounters } from '../../types/models'
import { AddLeadModal } from '../../components/marketing/AddLeadModal'


export default function DocumentDashboard() {
  const { ebApplications, leads } = useApp()
  const { employee } = useAuth()
  const navigate = useNavigate()

  const [counters, setCounters] = useState<EbDashboardCounters | null>(null)
  const [showAddLead, setShowAddLead] = useState(false)

  useEffect(() => {
    ebApplicationsApi.getDashboardCounters().then(setCounters).catch(console.error)
  }, [ebApplications])

  const docsNotVerified = ebApplications.filter((a) => a.verificationStatus === 'NOT_VERIFIED')
  const completed = ebApplications.filter((a) => a.handoverStatus === 'COMPLETED')
  
  // Since we scoped leads API for DOC_FOLLOWUP, the store only has leads created by them.
  const myLeads = leads || []

  return (
    <div className="space-y-5">
      <DashboardBanner
        portal="Document Follow-up"
        title={`Welcome, ${employee?.name?.split(' ')[0] ?? 'Priya'}`}
        subtitle="EB & TANGEDCO Net-Metering Portal Paperwork & Follow-up"
        action={
          <button onClick={() => setShowAddLead(true)} className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition cursor-pointer">
            + Add Lead
          </button>
        }
      />

      {counters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button onClick={() => navigate('/documents/applications')} className="text-left"><KpiCard label="Docs Pending" value={String(counters.documents_pending)} accent="sun" /></button>
          <button onClick={() => navigate('/documents/applications')} className="text-left"><KpiCard label="Docs Verified" value={String(counters.documents_verified)} accent="teal" /></button>
          <button onClick={() => navigate('/documents/applications')} className="text-left"><KpiCard label="Portal Submitted" value={String(counters.portal_submitted)} accent="teal" /></button>
          <button onClick={() => navigate('/documents/applications')} className="text-left"><KpiCard label="Completed" value={String(counters.completed)} accent="sun" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        <Card className="p-4">
          <SectionHeading eyebrow="Action Needed" title="Verification Issues" action={<FileText size={15} className="text-sun" />} />
          {docsNotVerified.length === 0 ? (
            <div className="text-xs text-text-dim">All documents are verified.</div>
          ) : (
            <div className="space-y-2">
              {docsNotVerified.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.projectCode} — {a.customerName}</div>
                    <div className="text-xs text-text-dim truncate">{a.verificationReason}</div>
                  </div>
                  <AlertCircle size={14} className="text-sun shrink-0" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionHeading eyebrow="History" title="Recently Completed" />
          {completed.length === 0 ? (
            <div className="text-xs text-text-dim">No handovers completed yet.</div>
          ) : (
            <div className="space-y-2">
              {completed.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.projectCode} — {a.customerName}</div>
                    <div className="text-xs text-text-dim">Handed over {formatDate(a.handoverDate ?? '')}</div>
                  </div>
                  <Pill status={a.currentStage} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card className="p-4">
          <SectionHeading eyebrow="My Created Leads" title="Lead Status Overview" />
          {myLeads.length === 0 ? (
            <div className="text-sm text-text-dim py-4 text-center">You haven't added any leads yet.</div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border text-text-dim">
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Mobile</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myLeads.map((l) => (
                    <tr key={l.id} className="hover:bg-bg-alt transition-colors">
                      <td className="py-3 font-medium text-text">{l.customerName}</td>
                      <td className="py-3 text-text-dim">{l.mobile}</td>
                      <td className="py-3"><Pill status={l.status} /></td>
                      <td className="py-3 text-text-dim">{formatDate(l.createdAt || l.firstContactDate || '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {showAddLead && <AddLeadModal onClose={() => setShowAddLead(false)} />}
    </div>
  )
}

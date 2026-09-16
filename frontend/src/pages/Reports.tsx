import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts'
import { Card, SectionHeading } from '../components/shared/Primitives'
import { formatINR } from '../lib/utils'
import { reportsExportApi } from '../api/reportsExport'
import { reportsApi } from '../api/reports'

import { FileDown, Calendar } from 'lucide-react'

export default function Reports() {
  const [projectValueByArea, setProjectValueByArea] = useState<{ area: string, value: number }[]>([])
  const [paymentStateSummary, setPaymentStateSummary] = useState<{ state: string, value: number }[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string, value: number }[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)

  useEffect(() => {
    reportsApi.getReports().then((data) => {
      if (data) {
        setProjectValueByArea(data.projectValueByArea?.map((d: any) => ({ area: d.label, value: d.value })) || [])
        setPaymentStateSummary(data.paymentTotalByState?.map((d: any) => ({ state: d.label, value: d.value })) || [])
        setMonthlyRevenue(data.monthlyVerifiedCollections?.map((d: any) => ({ month: d.label, value: d.value })) || [])
        
        const rev = data.monthlyVerifiedCollections?.reduce((acc: number, cur: any) => acc + Number(cur.value), 0) || 0
        setTotalRevenue(rev)
      }
    }).catch(console.error)
  }, [])

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])
  const [downloadError, setDownloadError] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async (type: string) => {
    setDownloadError('')
    if (!fromDate || !toDate) {
      setDownloadError('Please select both from and to dates')
      return
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setDownloadError('From date must be before or equal to To date')
      return
    }

    setIsDownloading(true)
    try {
      if (type === 'ctc') await reportsExportApi.downloadCtcReport(fromDate, toDate)
      else if (type === 'gst') await reportsExportApi.downloadGstReport(fromDate, toDate)
      else if (type === 'revenue') await reportsExportApi.downloadRevenueReport(fromDate, toDate)
      else if (type === 'employeeRevenue') await reportsExportApi.downloadEmployeeRevenueReport(fromDate, toDate)
      else if (type === 'stock') await reportsExportApi.downloadStockReport(fromDate, toDate)
      else if (type === 'customers') await reportsExportApi.downloadExistingCustomerReport(fromDate, toDate)
    } catch (err: any) {
      setDownloadError(err.message || 'Failed to download report. Make sure backend is running.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow="Executive" title="Reports" action={<span className="text-xs text-text-dim">Analytics & PDF Exports</span>} />

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <SectionHeading eyebrow="Trend" title="Verified collections (6 months)" />
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e5" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v / 100000}L`} />
              <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ background: '#ffffff', border: '1px solid #e2e8e5', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
              <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2.5} dot={{ fill: '#16a34a', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-text-dim mt-3 pt-2 border-t border-border/70 flex items-center justify-between">
            <span>Verified this month</span>
            <span className="font-semibold text-emerald-700">{formatINR(totalRevenue)}</span>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading eyebrow="Geography" title="Project value by area" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={projectValueByArea} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e5" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v / 100000}L`} />
              <YAxis type="category" dataKey="area" tick={{ fill: '#64748b', fontSize: 11 }} width={110} />
              <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ background: '#ffffff', border: '1px solid #e2e8e5', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <SectionHeading eyebrow="Accounts" title="Payments by verification state" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={paymentStateSummary}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e5" vertical={false} />
              <XAxis dataKey="state" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `${v / 100000}L`} />
              <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ background: '#ffffff', border: '1px solid #e2e8e5', borderRadius: 10, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
              <Bar dataKey="value" fill="#0284c7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-6 border border-border bg-panel shadow-xs">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text">Download Reports</h3>
          </div>
          <p className="text-xs text-text-dim mt-1">Export customized official PDF reports based on a specific date range.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 rounded-xl bg-panel-raised border border-border">
          <div className="flex-1">
            <label className="block text-xs text-text-dim mb-1 font-medium flex items-center gap-1.5">
              <Calendar size={13} /> From Date
            </label>
            <input 
              type="date" 
              value={fromDate} 
              onChange={(e) => {
                setFromDate(e.target.value)
                setDownloadError('')
              }}
              className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 shadow-xs transition"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-text-dim mb-1 font-medium flex items-center gap-1.5">
              <Calendar size={13} /> To Date
            </label>
            <input 
              type="date" 
              value={toDate} 
              onChange={(e) => {
                setToDate(e.target.value)
                setDownloadError('')
              }}
              className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 shadow-xs transition"
            />
          </div>
        </div>

        {downloadError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl px-3.5 py-2.5">
            {downloadError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[
            { id: 'ctc', label: 'Download CTC Report' },
            { id: 'gst', label: 'Download GST Payable Report' },
            { id: 'revenue', label: 'Download Revenue Report' },
            { id: 'employeeRevenue', label: 'Download Employee Revenue Report' },
            { id: 'stock', label: 'Download Stock Report' },
            { id: 'customers', label: 'Download Existing Customers Report' },
          ].map((item) => (
            <button 
              key={item.id}
              disabled={isDownloading}
              onClick={() => handleDownload(item.id)}
              className="flex items-center justify-between p-3.5 bg-panel-raised/50 border border-border hover:border-emerald-500 hover:bg-emerald-50/20 text-text transition rounded-xl text-xs font-semibold disabled:opacity-50 group text-left"
            >
              <span>{item.label}</span>
              <FileDown size={16} className="text-text-dim group-hover:text-emerald-600 transition shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

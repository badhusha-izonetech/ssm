import { type ReactNode, isValidElement, type ComponentType } from 'react'
import {
  X,
  SunMedium,
  Users,
  TrendingUp,
  FileText,
  Handshake,
  IndianRupee,
  CreditCard,
  AlertTriangle,
  Package,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  Truck,
  Wrench,
  Clock,
  FolderKanban,
  Target,
  ArrowUp,
} from 'lucide-react'
import { statusClass, initials } from '../../lib/utils'

export function Pill({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-semibold tracking-wide whitespace-nowrap shadow-xs ${statusClass(status)}`}>
      {label || status}
    </span>
  )
}

export function PriorityDot({ priority }: { priority: string }) {
  const dotColor = priority === 'High' ? 'bg-rose' : priority === 'Medium' ? 'bg-amber' : 'bg-slate-400'
  const textColor = priority === 'High' ? 'text-rose-700' : priority === 'Medium' ? 'text-amber-700' : 'text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${textColor}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor} ring-2 ring-white shadow-xs`} />
      {priority}
    </span>
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div 
      className={`solar-card bg-white border border-[#e2e8e5] rounded-2xl ${onClick ? 'cursor-pointer solar-card-hover' : ''} ${className}`} 
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-wider text-emerald-700 font-bold mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            {eyebrow}
          </div>
        )}
        <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight">{title}</h2>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  )
}

export function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ring-2 ring-white shadow-xs"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {initials(name)}
    </div>
  )
}

const ACCENT_STYLES: Record<string, { iconBg: string; hoverBorder: string }> = {
  sun: {
    iconBg: 'bg-orange-50/90 border border-orange-200/60 text-orange-600',
    hoverBorder: 'hover:border-orange-300',
  },
  amber: {
    iconBg: 'bg-amber-50/90 border border-amber-200/60 text-amber-600',
    hoverBorder: 'hover:border-amber-300',
  },
  teal: {
    iconBg: 'bg-emerald-50/90 border border-emerald-200/60 text-emerald-600',
    hoverBorder: 'hover:border-emerald-300',
  },
  emerald: {
    iconBg: 'bg-emerald-50/90 border border-emerald-200/60 text-emerald-600',
    hoverBorder: 'hover:border-emerald-300',
  },
  rose: {
    iconBg: 'bg-rose-50/90 border border-rose-200/60 text-rose-600',
    hoverBorder: 'hover:border-rose-300',
  },
  sky: {
    iconBg: 'bg-blue-50/90 border border-blue-200/60 text-blue-600',
    hoverBorder: 'hover:border-blue-300',
  },
  blue: {
    iconBg: 'bg-blue-50/90 border border-blue-200/60 text-blue-600',
    hoverBorder: 'hover:border-blue-300',
  },
  violet: {
    iconBg: 'bg-violet-50/90 border border-violet-200/60 text-violet-600',
    hoverBorder: 'hover:border-violet-300',
  },
}

function resolveKpiIcon(label: string, accent?: string) {
  const l = label.toLowerCase()
  if (l.includes('lead') || l.includes('survey') || l.includes('customer') || l.includes('contact')) {
    return Users
  }
  if (l.includes('won') || l.includes('deal') || l.includes('conversion') || l.includes('converted')) {
    return Handshake
  }
  if (l.includes('quotation') || l.includes('doc') || l.includes('invoice') || l.includes('proof')) {
    return FileText
  }
  if (l.includes('approval') || l.includes('decision') || l.includes('verification') || l.includes('verified')) {
    return ShieldCheck
  }
  if (l.includes('stock') || l.includes('item') || l.includes('inventory') || l.includes('product') || l.includes('warehouse')) {
    return Package
  }
  if (l.includes('gst') || l.includes('tax') || l.includes('receipt') || l.includes('bill')) {
    return Receipt
  }
  if (l.includes('pipeline') || l.includes('revenue') || l.includes('collection') || l.includes('value') || l.includes('amount') || l.includes('expected') || l.includes('received')) {
    return IndianRupee
  }
  if (l.includes('outstanding') || l.includes('balance') || l.includes('due') || l.includes('payment pending')) {
    return CreditCard
  }
  if (l.includes('delayed') || l.includes('issue') || l.includes('risk') || l.includes('reject') || l.includes('infeasible') || l.includes('below')) {
    return AlertTriangle
  }
  if (l.includes('trip') || l.includes('transport') || l.includes('movement') || l.includes('gps') || l.includes('vehicle')) {
    return Truck
  }
  if (l.includes('install') || l.includes('technician') || l.includes('service') || l.includes('maintenance')) {
    return Wrench
  }
  if (l.includes('score') || l.includes('rank') || l.includes('target') || l.includes('performance') || l.includes('efficiency')) {
    return Target
  }
  if (l.includes('today') || l.includes('upcoming') || l.includes('pending') || l.includes('queue') || l.includes('schedule') || l.includes('time')) {
    return Clock
  }
  if (l.includes('completed') || l.includes('done')) {
    return CheckCircle2
  }
  if (l.includes('project')) {
    return FolderKanban
  }

  switch (accent) {
    case 'rose':
      return AlertTriangle
    case 'amber':
    case 'sun':
      return TrendingUp
    case 'teal':
    case 'emerald':
      return CheckCircle2
    case 'sky':
    case 'blue':
      return Users
    case 'violet':
      return Handshake
    default:
      return FolderKanban
  }
}

export function KpiCard({
  label,
  value,
  sub,
  accent = 'sun',
  icon,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'sun' | 'teal' | 'rose' | 'amber' | 'sky' | 'blue' | 'violet' | 'emerald'
  icon?: ReactNode | ComponentType<{ size?: number; className?: string }>
  onClick?: () => void
}) {
  const theme = ACCENT_STYLES[accent] || ACCENT_STYLES.sun
  const IconComponent = typeof icon === 'function' ? icon : (!icon ? resolveKpiIcon(label, accent) : null)

  const isPositiveTrend =
    typeof sub === 'string' &&
    (sub.includes('%') || sub.startsWith('+') || sub.startsWith('↑') || sub.startsWith('▲')) &&
    !sub.toLowerCase().includes('below') &&
    !sub.toLowerCase().includes('delayed') &&
    !sub.toLowerCase().includes('issue')

  return (
    <div
      className={`bg-white border border-[#e2e8e5] rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4 relative overflow-hidden transition-all duration-200 shadow-xs ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 ' + theme.hoverBorder : 'hover:border-slate-300'
      }`}
      onClick={onClick}
    >
      <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 ${theme.iconBg}`}>
        {isValidElement(icon) ? (
          icon
        ) : IconComponent ? (
          <IconComponent size={22} className="stroke-[2.2]" />
        ) : null}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="text-xs font-semibold text-slate-500 tracking-normal truncate mb-0.5">{label}</div>
        <div className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight leading-tight my-0.5 truncate">
          {value}
        </div>
        {sub && (
          <div className="text-xs font-medium mt-1 truncate flex items-center gap-1">
            {isPositiveTrend ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-0.5 truncate">
                <ArrowUp size={12} className="stroke-[2.5] shrink-0" />
                <span>{sub.replace(/^[+↑▲]\s*/, '')}</span>
              </span>
            ) : (
              <span className="text-slate-500 truncate">{sub}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className={`bg-white border border-[#e2e8e5] rounded-t-3xl sm:rounded-2xl w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[90vh] flex flex-col shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8e5] bg-white sticky top-0 z-10">
          <h3 className="font-display font-bold text-slate-900 text-base">{title}</h3>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wider text-slate-600 font-bold block">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full bg-white border border-[#cbd5e1] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/15 transition-all shadow-xs'

export const btnPrimary = 
  'inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs hover:shadow active:scale-[0.99] disabled:opacity-50 cursor-pointer'

export const btnSecondary = 
  'inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer'

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center mb-3 shadow-xs">
        <SunMedium size={24} className="text-emerald-600" />
      </div>
      <div className="font-display font-bold text-slate-900 text-base mb-1">{title}</div>
      <div className="text-sm text-slate-500 max-w-sm">{message}</div>
    </div>
  )
}

export function MultiSelect({ options, selectedIds, onChange, placeholder = 'Add...' }: { 
  options: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const selected = options.filter(o => selectedIds.includes(o.id))
  const unselected = options.filter(o => !selectedIds.includes(o.id))

  return (
    <div className="space-y-2 bg-slate-50 border border-[#cbd5e1] rounded-xl p-2.5">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {selected.length === 0 && <div className="text-xs text-slate-400 flex items-center px-1">None selected</div>}
        {selected.map(s => (
          <div key={s.id} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2.5 py-1 rounded-lg text-xs font-semibold">
            {s.label}
            <button 
              onClick={(e) => { e.preventDefault(); onChange(selectedIds.filter(id => id !== s.id)) }} 
              className="hover:text-rose-600 ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <select 
        value="" 
        onChange={(e) => {
          if (e.target.value) {
            onChange([...selectedIds, e.target.value])
          }
        }} 
        className={`${inputCls} py-1.5 text-xs bg-white`}
      >
        <option value="">{placeholder}</option>
        {unselected.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
    </div>
  )
}

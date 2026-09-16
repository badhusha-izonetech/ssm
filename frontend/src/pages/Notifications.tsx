import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { Card, SectionHeading, Pill } from '../components/shared/Primitives'
import {
  Bell,
  CircleDot,
  Layers,
  FileText,
  Users,
  CreditCard,
  CalendarCheck2,
  CheckCircle2,
  MessageSquareHeart,
  MapPin,
  ReceiptText,
  ChevronsRight,
  ChevronsLeft,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import type { Notification } from '../types/models'

export type NotificationCategoryTabKey =
  | 'all'
  | 'quotation'
  | 'lead'
  | 'payment_verification'
  | 'leave_approval'
  | 'project_completion'
  | 'feedback'
  | 'site_request'
  | 'gst'

interface CategoryTabDef {
  key: NotificationCategoryTabKey
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  match: (n: Notification) => boolean
}

const CATEGORY_TABS: CategoryTabDef[] = [
  {
    key: 'all',
    label: 'All',
    icon: Layers,
    match: () => true,
  },
  {
    key: 'quotation',
    label: 'Quotation',
    icon: FileText,
    match: (n) => {
      const t = (n.title || '').toLowerCase()
      const m = (n.message || '').toLowerCase()
      return (
        t.includes('quotation') ||
        t.includes('quote') ||
        (n.category === 'Approval' && (t.includes('quotation') || m.includes('quotation'))) ||
        m.includes('quotation') ||
        m.includes('quote')
      )
    },
  },
  {
    key: 'lead',
    label: 'Lead',
    icon: Users,
    match: (n) => {
      const t = (n.title || '').toLowerCase()
      const m = (n.message || '').toLowerCase()
      if (t.includes('site visit requested') || t.includes('site visit required') || t.includes('site request')) {
        return false
      }
      return n.category === 'Lead' || t.includes('lead') || m.includes('lead')
    },
  },
  {
    key: 'payment_verification',
    label: 'Payment Verification',
    icon: CreditCard,
    match: (n) => {
      const t = (n.title || '').toLowerCase()
      const m = (n.message || '').toLowerCase()
      if (t.includes('gst') || m.includes('gst')) return false
      return (
        n.category === 'Payment' ||
        t.includes('payment') ||
        t.includes('advance') ||
        t.includes('paid') ||
        m.includes('payment') ||
        m.includes('advance')
      )
    },
  },
  {
    key: 'leave_approval',
    label: 'Leave Approval',
    icon: CalendarCheck2,
    match: (n) => {
      const t = (n.title || '').toLowerCase()
      const m = (n.message || '').toLowerCase()
      return n.category === 'Leave' || t.includes('leave') || m.includes('leave')
    },
  },
  {
    key: 'project_completion',
    label: 'Project Completion',
    icon: CheckCircle2,
    match: (n) => {
      const t = (n.title || '').toLowerCase()
      const m = (n.message || '').toLowerCase()
      return (
        t.includes('installation completed') ||
        t.includes('site visit completed') ||
        t.includes('final review completed') ||
        t.includes('field work completed') ||
        t.includes('technician work completed') ||
        t.includes('field tech work complete') ||
        t.includes('documentation completed') ||
        t.includes('doc follow-up') ||
        t.includes('doc work complete') ||
        t.includes('eb handover completed') ||
        t.includes('project completed') ||
        t.includes('work complete') ||
        m.includes('has been completed') ||
        m.includes('completed by') ||
        m.includes('work complete') ||
        m.includes('visit completed') ||
        m.includes('eb handover completed')
      )
    },
  },
  {
    key: 'feedback',
    label: 'Feedback',
    icon: MessageSquareHeart,
    match: (n) => {
      const t = (n.title || '').toLowerCase()
      const m = (n.message || '').toLowerCase()
      return (
        n.category === 'Feedback' ||
        t.includes('feedback') ||
        t.includes('review') ||
        t.includes('rating') ||
        m.includes('feedback') ||
        m.includes('customer review') ||
        m.includes('rating') ||
        m.includes('star')
      )
    },
  },
  {
    key: 'site_request',
    label: 'Site Request',
    icon: MapPin,
    match: (n) => {
      const t = (n.title || '').toLowerCase()
      const m = (n.message || '').toLowerCase()
      return (
        t.includes('site visit requested') ||
        t.includes('site visit required') ||
        t.includes('new site visit assigned') ||
        t.includes('site request') ||
        t.includes('site visit scheduled') ||
        m.includes('site visit required') ||
        m.includes('site visit requested') ||
        m.includes('site visit needed') ||
        m.includes('assigned for site visit')
      )
    },
  },
  {
    key: 'gst',
    label: 'GST',
    icon: ReceiptText,
    match: (n) => {
      const t = (n.title || '').toUpperCase()
      const m = (n.message || '').toUpperCase()
      return t.includes('GST') || m.includes('GST')
    },
  },
]

export default function NotificationsPage() {
  const { notifications, markAllNotificationsRead, markNotificationRead, clearAllNotifications } = useApp()
  const { portal, employee } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const availableTabs = useMemo(() => {
    if (portal === 'Project Head') {
      const excludedKeys = ['quotation', 'lead', 'site_request', 'gst']
      return CATEGORY_TABS
        .filter((t) => !excludedKeys.includes(t.key))
        .map((t) => (t.key === 'leave_approval' ? { ...t, label: 'Leave Updates' } : t))
    }
    return CATEGORY_TABS
  }, [portal])

  const initialTab = (searchParams.get('category') as NotificationCategoryTabKey) || 'all'
  const [activeTabKey, setActiveTabKey] = useState<NotificationCategoryTabKey>(
    availableTabs.some((t) => t.key === initialTab) ? initialTab : 'all'
  )
  const [showAllTabs, setShowAllTabs] = useState(() => {
    const activeIndex = availableTabs.findIndex((t) => t.key === initialTab)
    return activeIndex >= 6
  })
  
  const items = useMemo(() => {
    return notifications.filter(
      (n) =>
        n.department === portal ||
        (portal === 'Accountant' && n.department === 'Accounts') ||
        (portal === 'Project Head' && n.department === 'Project') ||
        (employee && n.department === employee.name) ||
        (employee && n.recipientId === employee.id)
    )
  }, [notifications, portal, employee])

  const totalUnread = useMemo(() => items.filter((n) => !n.read).length, [items])

  const activeTabDef = useMemo(
    () => availableTabs.find((t) => t.key === activeTabKey) || availableTabs[0],
    [activeTabKey, availableTabs]
  )

  const showCategories = portal === 'CEO' || portal === 'Project Head'

  const filteredItems = useMemo(() => {
    if (!showCategories) return items
    return items.filter(activeTabDef.match)
  }, [items, activeTabDef, showCategories])

  const tabMeta = useMemo(() => {
    const meta: Record<string, { total: number; unread: number }> = {}
    availableTabs.forEach((t) => {
      const catItems = items.filter(t.match)
      meta[t.key] = {
        total: catItems.length,
        unread: catItems.filter((n) => !n.read).length,
      }
    })
    return meta
  }, [items, availableTabs])

  const handleTabChange = (key: NotificationCategoryTabKey) => {
    setActiveTabKey(key)
    if (key === 'all') {
      searchParams.delete('category')
      setSearchParams(searchParams)
    } else {
      setSearchParams({ category: key })
    }
  }

  const visibleTabs = showAllTabs ? availableTabs : availableTabs.slice(0, 6)

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Cross-Department"
        title="Notifications"
        action={
          <div className="flex gap-2 items-center">
            {totalUnread > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-xs cursor-pointer"
              >
                Mark all as read ({totalUnread})
              </button>
            )}
            {items.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition shadow-xs cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>
        }
      />

      {/* Horizontal Category Navigation Bar */}
      {showCategories && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
          {visibleTabs.map((tab) => {
          const isActive = activeTabKey === tab.key
          const { total, unread } = tabMeta[tab.key] || { total: 0, unread: 0 }
          const Icon = tab.icon

          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600 font-semibold'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80 shadow-xs'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-500'} />
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-medium ${
                  isActive
                    ? 'bg-emerald-700/80 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {total}
              </span>
              {unread > 0 && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? 'bg-amber-300' : 'bg-emerald-500 animate-pulse'
                  }`}
                  title={`${unread} unread`}
                />
              )}
            </button>
          )
        })}
        
        {!showAllTabs && availableTabs.length > 6 && (
          <button
            onClick={() => setShowAllTabs(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100/80 transition-colors border border-emerald-200/80 shadow-xs cursor-pointer ml-1"
          >
            More <ChevronsRight size={14} />
          </button>
        )}
        {showAllTabs && availableTabs.length > 6 && (
          <button
            onClick={() => setShowAllTabs(false)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 shadow-xs cursor-pointer ml-1"
          >
            Less <ChevronsLeft size={14} />
          </button>
        )}
        </div>
      )}

      {/* Notification Cards List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <Card className="p-8 text-center text-sm text-text-dim border-dashed">
            {!showCategories || activeTabKey === 'all'
              ? 'No notifications yet.'
              : `No ${activeTabDef.label} notifications found.`}
          </Card>
        ) : (
          filteredItems.map((n) => (
            <Card
              key={n.id}
              className={`p-4 flex items-start gap-3.5 transition-all ${
                n.title !== 'GST PAYMENT REMINDER' ? 'cursor-pointer hover:border-emerald-200 hover:shadow-xs' : ''
              } ${!n.read ? 'bg-emerald-50/25 border-emerald-200 shadow-xs' : 'opacity-90'}`}
              onClick={() => {
                if (n.title !== 'GST PAYMENT REMINDER') markNotificationRead(n.id)
              }}
            >
              <div className="mt-0.5 shrink-0">
                {n.read ? (
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-text-dim">
                    <Bell size={15} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <CircleDot size={16} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`text-sm font-semibold ${!n.read ? 'text-text font-bold' : 'text-text-dim'}`}>
                    {n.title}
                  </div>
                  <Pill status={n.priority} />
                  {n.department && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {n.department}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-dim mt-1 leading-relaxed">{n.message}</div>
                <div className="text-[11px] text-text-dim mt-2 flex items-center gap-1.5">
                  <span>{n.timestamp}</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}


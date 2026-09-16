import { useState, useEffect, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, UserPlus2, FileText, Wallet,
  Boxes, Users, Building2, MapPinned, Bell, CalendarClock,
  BarChart3, History, CheckCircle2, Menu, X,
  PhoneCall, Contact, ClipboardList, LogOut, Navigation, RotateCcw,
  ShieldCheck, AlertCircle, Wrench, AlertOctagon, CheckSquare,
  PackageSearch, PackagePlus, ClipboardCheck, History as HistoryIcon, Truck, FileCheck2, Compass, ReceiptText,
} from 'lucide-react'
import { Avatar } from './Primitives'
import { useAuth } from '../../auth/AuthContext'
import { useApp } from '../../store/AppStore'
import companyLogoAsset from '../../assets/company_logo.png'
import leftBottomCornerAsset from '../../assets/left_bottom_coner.png'
import titleIconAsset from '../../assets/title_icon.png'

const ceoNav = [
  { to: '/', label: 'Executive Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'All Projects', icon: FolderKanban },
  { to: '/leads', label: 'Leads', icon: UserPlus2 },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/quotations', label: 'Quotations', icon: FileText },
  { to: '/revenue', label: 'Revenue Generation', icon: BarChart3 },
  { to: '/gst', label: 'GST Payable', icon: ReceiptText },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/stock', label: 'Stock', icon: Boxes },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/departments', label: 'Departments', icon: Building2 },
  { to: '/site-visit/visits', label: 'Site Visits', icon: Navigation },
  { to: '/field-movement', label: 'Field Movement', icon: MapPinned },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/activity', label: 'Activity History', icon: History },
  { to: '/approvals', label: 'Approvals', icon: CheckCircle2 },
]

const marketingNavBase = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/marketing/leads', label: 'Lead Inbox', icon: UserPlus2 },
  { to: '/marketing/customers', label: 'Existing Customers', icon: Contact },
  { to: '/marketing/calls', label: 'Call History', icon: PhoneCall },
  { to: '/marketing/follow-ups', label: 'Follow-up', icon: ClipboardList },
  { to: '/marketing/site-products', label: 'Site Products', icon: PackageSearch },
]

const directMarketingFieldNav = { to: '/marketing/field-visit', label: 'Field Visit', icon: Navigation }

const marketingNavTail = [
  { to: '/quotations', label: 'Quotations', icon: FileText },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const siteVisitNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/site-visit/visits', label: 'Site Visits', icon: Navigation },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const partnerNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/projects', label: 'All Projects', icon: FolderKanban },
  { to: '/partner/payments', label: 'Payments', icon: Wallet },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const accountantNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/accountant/verification', label: 'Payment Verification', icon: ShieldCheck },
  { to: '/accountant/payments?tab=outstanding', label: 'Outstanding', icon: AlertCircle },
  { to: '/invoices', label: 'Invoices', icon: FileCheck2 },
  { to: '/accountant/reports', label: 'Payment Reports', icon: BarChart3 },
  { to: '/accountant/employees', label: 'Employee Financials', icon: Users },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const projectHeadNav = [
  { to: '/', label: 'Project Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/project-head/projects', label: 'All Projects', icon: FolderKanban },
  { to: '/project-head/technicians', label: 'Technician Assignment', icon: Wrench },
  { to: '/project-head/documents', label: 'Document Assignment', icon: ClipboardList },
  { to: '/project-head/stock', label: 'Stock Requests', icon: Boxes },
  { to: '/project-head/issues', label: 'Project Issues', icon: AlertOctagon },
  { to: '/project-head/completion', label: 'Completion Monitoring', icon: CheckSquare },
  { to: '/project-head/approvals', label: 'Approvals', icon: CheckCircle2 },
  { to: '/field-movement', label: 'Field Mobility (Team)', icon: MapPinned },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const warehouseNav = [
  { to: '/', label: 'Warehouse Dashboard', icon: LayoutDashboard },
  { to: '/warehouse/products', label: 'Product Master', icon: Boxes },
  { to: '/warehouse/requests', label: 'Stock Requests', icon: PackageSearch },
  { to: '/warehouse/operations', label: 'Stock Operations', icon: PackagePlus },
  { to: '/warehouse/allocations', label: 'Project Allocations', icon: ClipboardCheck },
  { to: '/warehouse/movements', label: 'Movement History', icon: HistoryIcon },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const transportNav = [
  { to: '/', label: 'Driver Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/transport/tasks', label: 'Assigned Deliveries', icon: Truck },
  { to: '/transport/movement', label: 'My Field Movement', icon: MapPinned },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const technicianNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/technician/projects', label: 'My Projects', icon: Wrench },
  { to: '/technician/visits', label: 'Site Visits', icon: Navigation },
  { to: '/technician/final-reviews', label: 'Final Reviews', icon: ClipboardCheck },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const documentsNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Existing Customers', icon: Users },
  { to: '/documents/applications', label: 'EB Applications', icon: FileCheck2 },
  { to: '/documents/followup', label: 'Follow-up Calendar', icon: CalendarClock },
  { to: '/field-mobility', label: 'Field Mobility', icon: Compass },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

const quotationNav = [
  { to: '/', label: 'Quotation Dashboard', icon: LayoutDashboard },
  { to: '/quotations', label: 'All Quotations', icon: FileText },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/leave', label: 'Attendance & Leave', icon: CalendarClock },
  { to: '/performance', label: 'Performance', icon: BarChart3 },
]

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      const isScrolled = window.scrollY > 8 || document.documentElement.scrollTop > 8
      setScrolled(isScrolled)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const { employee, portal, logout } = useAuth()
  const { resetDemoData } = useApp()
  const navigate = useNavigate()
  const { notifications } = useApp()
  const unread = notifications.filter((n) => !n.read && (n.department === portal || (portal === 'Accountant' && n.department === 'Accounts') || (portal === 'Project Head' && n.department === 'Project') || n.department === employee?.name || n.recipientId === employee?.id)).length

  const nav =
    portal === 'CEO'
      ? ceoNav
      : portal === 'Site Visit'
        ? siteVisitNav
        : portal === 'Partner'
          ? partnerNav
          : portal === 'Accountant'
            ? accountantNav
            : portal === 'Project Head'
              ? projectHeadNav
              : portal === 'Warehouse'
                ? warehouseNav
                : portal === 'Transport'
                  ? transportNav
                  : portal === 'Field Technician'
                    ? technicianNav
                    : portal === 'Document Follow-up'
                      ? documentsNav
                      : portal === 'Quotation Dashboard'
                        ? quotationNav
                        : portal === 'Direct Marketing'
                          ? [...marketingNavBase, directMarketingFieldNav, ...marketingNavTail]
                          : [...marketingNavBase, ...marketingNavTail]

  if (!employee) return null

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-ink">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky lg:top-0 lg:self-start z-40 top-0 left-0 h-screen w-64 shrink-0 bg-white border-r border-[#e2e8e5] flex flex-col transition-transform duration-200 shadow-sm lg:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`flex items-center justify-between px-5 h-16 transition-all duration-200 bg-white shrink-0 ${scrolled ? 'border-b border-[#e2e8e5]' : 'border-b border-transparent'}`}>
          <img src={companyLogoAsset} alt="Success Solar Power Care" className="h-8 sm:h-9 max-w-[170px] w-auto object-contain" />
          <button className="lg:hidden text-slate-400 hover:text-slate-700 p-1 ml-auto" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain py-3 px-3 space-y-1 relative z-10">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] transition-all duration-150 ${
                  isActive
                    ? 'bg-[#16a34a] text-white font-semibold shadow-sm shadow-emerald-700/20'
                    : 'text-[#1e293b] font-medium hover:text-slate-950 hover:bg-slate-100/70'
                }`
              }
            >
              <item.icon size={18} strokeWidth={2.2} className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom background decoration with mild blur and reduced opacity */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 w-full h-[360px] overflow-hidden z-0 flex items-end justify-center">
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-100/30 via-emerald-50/15 to-transparent pointer-events-none" />
          <img
            src={leftBottomCornerAsset}
            alt=""
            className="w-full h-full object-contain object-bottom opacity-35 blur-[2px] select-none [mask-image:linear-gradient(to_top,black_75%,transparent)]"
          />
        </div>

        <div className="relative mt-auto shrink-0 z-10">
          <div className="p-3 border-t border-[#e2e8e5]/60 space-y-1.5 bg-white/60 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/70 shadow-2xs">
              <Avatar name={employee.name} color={employee.avatarColor} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-slate-900 truncate leading-tight">{employee.name}</div>
                <div className="text-[11px] text-slate-500 truncate leading-tight mt-0.5">{employee.designation}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50/80 border border-transparent hover:border-rose-200/60 transition-colors"
            >
              <LogOut size={15} /> Sign out
            </button>
            {portal === 'CEO' && (
              <button
                onClick={() => {
                  if (window.confirm('This clears all locally stored demo data (leads, projects, payments, etc.) on this device and restores the original seed data. Continue?')) {
                    resetDemoData()
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                title="Wipes localStorage-persisted demo data and reloads with fresh seed data"
              >
                <RotateCcw size={13} /> Reset demo data
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className={`h-16 flex items-center gap-3 px-4 lg:px-8 sticky top-0 z-20 transition-all duration-200 ${
          scrolled
            ? 'border-b border-[#e2e8e5] bg-white/95 backdrop-blur-md shadow-xs'
            : 'border-b border-transparent bg-transparent'
        }`}>
          <button className="lg:hidden p-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>

          {/* Header Company Title with title_icon in Modern Typography & Color */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={titleIconAsset}
              alt=""
              className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0 drop-shadow-xs"
            />
            <span className="font-brand font-bold text-[16px] sm:text-[18px] lg:text-[20px] tracking-tight leading-none text-slate-900 truncate select-none">
              Success Solar{' '}
              <span className="bg-gradient-to-r from-[#16a34a] via-[#10b981] to-[#059669] bg-clip-text text-transparent font-extrabold">
                Power Care
              </span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3.5">
            <NavLink 
              to="/notifications" 
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 bg-rose-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-white">
                  {unread}
                </span>
              )}
            </NavLink>

            <div className="h-6 w-px bg-[#e2e8e5]" />

            <div className="hidden sm:block text-right leading-tight">
              <div className="text-[13px] font-bold text-slate-900">{employee.name}</div>
              <div className="text-[11px] text-emerald-700 font-semibold">{employee.employeeCode}</div>
            </div>
            <Avatar name={employee.name} color={employee.avatarColor} />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1536px] w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}

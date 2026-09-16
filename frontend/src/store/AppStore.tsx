import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { loadState, saveState, resetAllPersistedState } from './persist'
import type { Lead, LeadStatus, LostReason, Quotation, Invoice, FieldMovement, SiteVisit, Payment, Project, StockRequest, ProjectIssue, StockItem, StockMovementType, ProjectAllocation, Delivery, FieldWorkLog, WorkUpdate, EndOfDayReport, InstallationCompletion, FinalVerification, CustomerReview, EbApplication, FollowUpLog, LeaveRequest, AttendanceRecord, Department, Notification, CallLogEntry, Product } from '../types/models'
import { leadsApi } from '../api/leads'
import { siteVisitsApi } from '../api/siteVisits'
import { leaveApi } from '../api/leave'
import { attendanceApi } from '../api/attendance'
import { callsApi } from '../api/calls'
import { quotationsApi } from '../api/quotations'
import { projectsApi } from '../api/projects'
import { paymentsApi } from '../api/payments'
import { notificationsApi } from '../api/notifications'
import { fieldWorkApi } from '../api/fieldWork'
import { stockApi } from '../api/stock'
import { invoicesApi } from '../api/invoices'
import { ebApplicationsApi } from '../api/ebApplications'
import { productsApi } from '../api/products'
import { useAuth } from '../auth/AuthContext'
import { useWebSocket } from '../websocket/WebSocketProvider'
import { dashboardApi } from '../api/dashboard'

// id counters are derived per-session below from the persisted (localStorage) arrays, not the static seed, so ids never collide across sessions.

interface AppState {
  leads: Lead[]
  refreshLeads: () => Promise<void>
  addLead: (lead: Omit<Lead, 'id' | 'status'> & { status?: LeadStatus }) => Promise<Lead>
  addExistingCustomerLead: (data: { customerId: string; priorProjectId: string; productInterested?: string; requirementDescription?: string; approximateRequirement?: string; priority?: string; assignedEmployeeId?: string; }) => Promise<Lead>
  updateLeadStatus: (id: string, status: LeadStatus, extra?: { lostReason?: LostReason; lostReasonDetail?: string; remarks?: string }) => Promise<void>
  reassignLead: (id: string, employeeId: string) => Promise<void>
  callLogs: CallLogEntry[]
  refreshCallLogs: () => Promise<void>
  quotations: Quotation[]
  fieldMovements: FieldMovement[]
  refreshFieldMovements: () => Promise<void>

  ceoDashboard: any | null
  refreshCeoDashboard: () => Promise<void>

  addCallLog: (entry: Omit<CallLogEntry, 'id'>) => Promise<void>

  addQuotation: (q: Omit<Quotation, 'id' | 'quotationNumber' | 'revisionNumber'>) => Promise<Quotation | undefined>
  updateQuotation: (id: string, q: Omit<Quotation, 'id' | 'quotationNumber' | 'revisionNumber'>) => Promise<Quotation | undefined>
  reviseQuotation: (quotationId: string, updates: Partial<Quotation>, reason: string) => Promise<Quotation | undefined>
  updateQuotationStatus: (
    quotationId: string,
    status: Quotation['status'],
    extra?: { customerRejectionReason?: string },
  ) => void
  deleteQuotation: (quotationId: string) => Promise<void>

  startFieldVisit: (entry: Omit<FieldMovement, 'id' | 'lastUpdate' | 'routeHistory'>) => Promise<FieldMovement>
  updateFieldVisit: (id: string, patch: { status?: FieldMovement['status']; location?: string; photo?: string; note?: string }) => Promise<void>

  siteVisits: SiteVisit[]
  marketingSiteProducts: SiteVisit[]
  refreshSiteVisits: () => Promise<void>
  refreshMarketingSiteProducts: () => Promise<void>
  scheduleSiteVisit: (input: any) => Promise<SiteVisit>
  startSiteVisit: (id: string, lat: number, lng: number, acc: number) => Promise<void>
  uploadSiteVisitPhoto: (id: string, blob: Blob, lat: number, lng: number, accuracy: number, stage?: string) => Promise<void>
  addSiteVisitEvidence: (id: string, patch: any) => Promise<void>
  uploadEvidenceFile: (id: string, file: File, type: 'photo' | 'video' | 'measurementImage' | 'document') => Promise<void>
  completeSiteVisit: (id: string, result: any) => Promise<void>
  markSiteVisitStockAvailable: (id: string) => Promise<void>
  completeSiteVisitStage: (id: string, stage: string) => Promise<void>
  createProjectSiteVisit: (projectId: string, customerName: string, customerMobile: string, systemType: string, address: string, latitude: number, longitude: number) => Promise<any>

  payments: Payment[]
  refreshPayments: () => Promise<void>
  submitPayment: (input: Omit<Payment, 'id' | 'state' | 'verifiedBy'> & { paymentScreenshotFile?: File | null }) => Promise<Payment>
  updatePayment: (id: string, input: Partial<Omit<Payment, 'id' | 'state' | 'verifiedBy'>> & { paymentScreenshotFile?: File | null }) => Promise<Payment>
  verifyPayment: (id: string, verifiedAmount: number, remarks: string | undefined, verifiedBy: string, paymentMode?: string, extra?: { customerName?: string; projectId?: string; quotationId?: string; paymentType?: string }) => Promise<void>
  rejectPayment: (id: string, remarks: string, verifiedBy: string) => Promise<void>
  markPaymentPartial: (id: string, verifiedAmount: number, remarks: string | undefined, verifiedBy: string, followUpDate?: string) => Promise<void>
  setPaymentFollowUp: (id: string, followUpDate: string) => Promise<void>

  projects: Project[]
  refreshProjects: () => Promise<void>
  assignTechnician: (projectId: string, employeeId: string) => Promise<void>
  assignDocEmployee: (projectId: string, employeeId: string) => Promise<void>
  putProjectOnHold: (projectId: string, reason: string) => void
  resumeProject: (projectId: string) => void
  escalateProject: (projectId: string, note: string) => void
  addProjectInstruction: (projectId: string, note: string, by: string) => void

  stockRequests: any[]
  groupedStockRequests: any[]
  refreshStock: () => Promise<void>
  requestStock: (input: Omit<StockRequest, 'id' | 'status'>) => Promise<any>
  reserveStockRequest: (id: string, performedBy?: string) => Promise<void>
  reserveProjectStockRequest: (projectId: string) => Promise<void>
  issueStockRequest: (id: string, performedBy?: string) => Promise<void>
  flagStockShortage: (input: Omit<StockRequest, 'id' | 'status'>) => Promise<any>
  cancelStockRequest: (id: string) => Promise<void>

  projectIssues: ProjectIssue[]
  recordProjectIssue: (input: Omit<ProjectIssue, 'id' | 'status'>) => ProjectIssue
  resolveProjectIssue: (id: string, resolutionNotes: string) => void

  // Warehouse / Maintenance portal
  stockItems: any[]
  stockMovements: any[]
  projectAllocations: ProjectAllocation[]
  addStockItem: (input: Omit<StockItem, 'id' | 'currentQuantity' | 'reservedQuantity' | 'availableQuantity'> & { openingQuantity: number }) => Promise<any>
  updateStockItem: (id: string, payload: Partial<StockItem>) => Promise<any>
  receiveStock: (input: { itemId: string; quantity: number; performedBy: string; supplier?: string; notes?: string }) => Promise<void>
  recordStockAdjustment: (input: { itemId: string; type: Extract<StockMovementType, 'Adjustment' | 'Damage' | 'Missing'>; quantity: number; performedBy: string; notes?: string }) => Promise<void>
  recordStockTransfer: (input: { itemId: string; quantity: number; performedBy: string; notes?: string }) => Promise<void>

  // Driver / Transport portal
  deliveries: Delivery[]
  startTrip: (id: string) => void
  updateTripLocation: (id: string, location: string) => void
  recordArrival: (id: string) => void
  capturePickupPhoto: (id: string, photo: string) => void
  captureDeliveryPhoto: (id: string, photo: string) => void
  confirmDelivery: (id: string, receivedBy: string, notes: string | undefined) => void
  startReturnTrip: (id: string) => void
  recordReturnedMaterial: (id: string, photo: string, notes: string | undefined) => void
  endTrip: (id: string) => void

  // Field Technician portal
  fieldWorkLogs: FieldWorkLog[]
  installationCompletions: InstallationCompletion[]
  finalVerifications: FinalVerification[]
  customerReviews: CustomerReview[]
  startWork: (input: { projectId: string; technicianId: string; toolsTaken: string[]; materialsTaken: string[]; startingPhoto: string }) => void
  addWorkUpdate: (logId: string, update: Omit<WorkUpdate, 'time'>) => void
  submitEndOfDay: (logId: string, report: Omit<EndOfDayReport, 'submittedOn'>) => void
  completeInstallation: (input: { projectId: string; technicianId: string; materialsConsumed: string; unusedMaterials?: string; photos: string[]; videos: string[]; finalRemarks?: string; unusedItemId?: string; unusedQuantity?: number }) => void
  submitFinalVerification: (input: Omit<FinalVerification, 'id' | 'submittedOn'>) => void
  submitCustomerReview: (input: Omit<CustomerReview, 'id' | 'submittedOn'>) => void

  // Document Follow-up portal
  ebApplications: EbApplication[]
  refreshEbApplications: () => Promise<void>
  uploadEbDocument: (id: string, file: File, documentType: string, remarks?: string) => Promise<void>
  verifyEbDocuments: (id: string, status: 'VERIFIED' | 'NOT_VERIFIED', reason?: string) => Promise<void>
  submitEbPortal: (id: string, ref?: string, remarks?: string) => Promise<void>
  handoverEbApplication: (id: string, details?: string, remarks?: string) => Promise<void>
  followUpLogs: FollowUpLog[]
  logFollowUp: (input: { ebApplicationId: string; nextContact?: string; customerResponse: string; governmentStatus: string; followUpRemarks?: string }) => void

  // Attendance & Leave (common module)
  leaveRequests: LeaveRequest[]
  refreshLeaveRequests: () => Promise<void>
  applyLeave: (input: { employeeId: string; employeeName: string; leaveType: LeaveRequest['leaveType']; fromDate: string; toDate: string; reason: string; medicalCertificate?: string }) => Promise<{ ok: boolean; error?: string }>
  decideLeave: (id: string, status: 'Approved' | 'Rejected', remarks?: string) => Promise<void>

  attendanceRecords: AttendanceRecord[]
  refreshAttendanceRecords: () => Promise<void>
  checkInAttendance: (input: { employeeId: string; employeeName: string; department: Department; type: AttendanceRecord['type'] }) => Promise<void>
  checkOutAttendance: (employeeId: string) => Promise<void>

  notifications: Notification[]
  refreshNotifications: () => Promise<void>
  addNotification: (input: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAllNotificationsRead: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  clearAllNotifications: () => Promise<void>

  /** Wipes all locally-persisted data and reloads with fresh seed/demo data. */
  resetDemoData: () => void

  // Invoices
  invoices: Invoice[]
  refreshInvoices: () => Promise<void>
  generateInvoice: (quotation: Quotation, customData?: Partial<Invoice>) => Promise<Invoice>
  updateInvoice: (id: string, patch: Partial<Invoice>) => Promise<void>

  // Products Catalog (Quotations)
  products: Product[]
  refreshProducts: () => Promise<void>
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<Product>
  deleteProduct: (id: string) => Promise<void>

  returnMaterial: (input: any) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { employee, portal } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>(() => loadState('callLogs', []))
  const [quotations, setQuotations] = useState<Quotation[]>(() => loadState('quotations', []))
  const [fieldMovements, setFieldMovements] = useState<FieldMovement[]>(() => loadState('fieldMovements', []))
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([])
  const [marketingSiteProducts, setMarketingSiteProducts] = useState<SiteVisit[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [stockRequests, setStockRequests] = useState<any[]>([])
  const [groupedStockRequests, setGroupedStockRequests] = useState<any[]>([])
  const [projectIssues, setProjectIssues] = useState<ProjectIssue[]>(() => loadState('projectIssues', []))
  const [stockItems, setStockItems] = useState<any[]>([])
  const [stockMovements, setStockMovements] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>(() => loadState('deliveries', []))
  const [fieldWorkLogs, setFieldWorkLogs] = useState<FieldWorkLog[]>(() => loadState('fieldWorkLogs', []))
  const [installationCompletions, setInstallationCompletions] = useState<InstallationCompletion[]>(() => loadState('installationCompletions', []))
  const [finalVerifications, setFinalVerifications] = useState<FinalVerification[]>(() => loadState('finalVerifications', []))
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>(() => loadState('customerReviews', []))
  const [ebApplications, setEbApplications] = useState<EbApplication[]>([])
  const [followUpLogs, setFollowUpLogs] = useState<FollowUpLog[]>(() => loadState('followUpLogs', []))
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [ceoDashboard, setCeoDashboard] = useState<any | null>(null)
  
  const { connected, subscribe } = useWebSocket()
  const refreshActions = useRef<any>({})

  const refreshInvoices = async () => {
    if (!employee) return
    try {
      const data = await invoicesApi.getAll()
      setInvoices(data)
    } catch (err) {
      console.error('Failed to refresh invoices', err)
    }
  }

  const refreshProducts = async () => {
    if (!employee) return
    try {
      const data = await productsApi.getAll()
      setProducts(data)
    } catch (err) {
      console.error('Failed to refresh products', err)
    }
  }

  const refreshCeoDashboard = async () => {
    if (!employee || portal !== 'CEO') return
    try {
      const data = await dashboardApi.getCeoDashboard()
      setCeoDashboard(data)
    } catch (err) {
      console.error('Failed to refresh CEO dashboard', err)
    }
  }

  useEffect(() => {
    // Attempt local storage migration
    const localInvoices = loadState('invoices', [])
    if (localInvoices.length > 0) {
      invoicesApi.bulkSync(localInvoices).then((data) => {
        setInvoices(data)
        saveState('invoices', []) // clear local storage
      }).catch(console.error)
    } else {
      refreshInvoices()
    }
    
    // Fetch products catalog on initial mount as well
    refreshProducts()
  }, [])


  // Persist every entity array to localStorage whenever it changes. This is
  // the single wiring point that makes every screen's create/update/delete
  // action durable across reloads, proving the CRUD wiring end-to-end
  // without a backend.
  useEffect(() => { saveState('callLogs', callLogs) }, [callLogs])
  useEffect(() => { saveState('quotations', quotations) }, [quotations])
  useEffect(() => { saveState('fieldMovements', fieldMovements) }, [fieldMovements])
  useEffect(() => { saveState('payments', payments) }, [payments])
  useEffect(() => { saveState('projects', projects) }, [projects])
  useEffect(() => { saveState('stockRequests', stockRequests) }, [stockRequests])
  useEffect(() => { saveState('groupedStockRequests', groupedStockRequests) }, [groupedStockRequests])
  useEffect(() => { saveState('projectIssues', projectIssues) }, [projectIssues])
  // useEffect(() => { saveState('stockItems', stockItems) }, [stockItems]) // now handled by API
  // useEffect(() => { saveState('stockMovements', stockMovements) }, [stockMovements]) // now handled by API
  // useEffect(() => { saveState('projectAllocations', projectAllocations) }, [projectAllocations])
  useEffect(() => { saveState('deliveries', deliveries) }, [deliveries])
  useEffect(() => { saveState('fieldWorkLogs', fieldWorkLogs) }, [fieldWorkLogs])
  useEffect(() => { saveState('installationCompletions', installationCompletions) }, [installationCompletions])
  useEffect(() => { saveState('finalVerifications', finalVerifications) }, [finalVerifications])
  useEffect(() => { saveState('customerReviews', customerReviews) }, [customerReviews])
  useEffect(() => { saveState('followUpLogs', followUpLogs) }, [followUpLogs])
  useEffect(() => { saveState('leaveRequests', leaveRequests) }, [leaveRequests])
  useEffect(() => { saveState('attendanceRecords', attendanceRecords) }, [attendanceRecords])
  useEffect(() => { saveState('notifications', notifications) }, [notifications])

  const markPaymentPartial: AppState['markPaymentPartial'] = async (id, verifiedAmount, remarks, _verifiedBy, followUpDate) => {
    try {
      const updated = await paymentsApi.verify(id, 'Partial', { actualAmount: verifiedAmount, remarks, followUpDate })
      setPayments(prev => prev.map(p => p.id === id ? updated : p))
    } catch (err) {
      console.error('Failed to mark partial', err)
    }
  }

  const setPaymentFollowUp: AppState['setPaymentFollowUp'] = async (id, followUpDate) => {
    try {
      const updated = await paymentsApi.setFollowUp(id, followUpDate)
      setPayments(prev => prev.map(p => p.id === id ? updated : p))
    } catch (err) {
      console.error('Failed to set follow up', err)
    }
  }

  const refreshNotifications = async () => {
    if (!employee) return
    try {
      const data = await notificationsApi.getAll()
      setNotifications(data)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }

  const addNotification: AppState['addNotification'] = (input) => {
    const id = crypto.randomUUID()
    const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const newNotif: Notification = { ...input, id, timestamp: now, read: false }
    setNotifications((prev) => [newNotif, ...prev])
  }

  const markAllNotificationsRead: AppState['markAllNotificationsRead'] = async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      console.error('Failed to mark all notifications read:', err)
    }
  }

  const clearAllNotifications: AppState['clearAllNotifications'] = async () => {
    try {
      await notificationsApi.clearAll()
      setNotifications([])
    } catch (err) {
      console.error('Failed to clear notifications:', err)
    }
  }

  const markNotificationRead: AppState['markNotificationRead'] = async (id) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch (err) {
      console.error('Failed to mark notification read:', err)
    }
  }

  const refreshLeads = async () => {
    if (!employee || !['CEO', 'Telecalling', 'Direct Marketing', 'Site Visit', 'Document Follow-up'].includes(portal as string)) return
    try {
      const data = await leadsApi.getAll()
      setLeads(data)
    } catch (err) {
      console.error('Failed to load leads:', err)
    }
  }

  useEffect(() => {
    refreshLeads()
  }, [employee, portal])

  const addLead: AppState['addLead'] = async (lead) => {
    const newLead = await leadsApi.create(lead)
    // Optimistic update for the current session
    setLeads((prev) => [newLead, ...prev])
    // Also re-fetch so any server-side fields (status, timestamps) are accurate
    refreshLeads()
    return newLead
  }

  const addExistingCustomerLead: AppState['addExistingCustomerLead'] = async (data) => {
    const newLead = await leadsApi.createExistingCustomerLead(data)
    setLeads((prev) => [newLead, ...prev])
    return newLead
  }

  const updateLeadStatus: AppState['updateLeadStatus'] = async (id, status, extra) => {
    await leadsApi.updateStatus(id, { status, ...extra })

    // The backend now auto-creates the quotation when status changes to 'Quotation Stage'
    if (status === 'Quotation Stage') {
      await refreshQuotations()
    }

    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updated = { ...l, status, lostReason: extra?.lostReason ?? l.lostReason, lostReasonDetail: extra?.lostReasonDetail ?? l.lostReasonDetail, remarks: extra?.remarks ?? l.remarks }
          return updated
        }
        return l
      }),
    )
  }

  const reassignLead: AppState['reassignLead'] = async (id, employeeId) => {
    await leadsApi.reassign(id, employeeId)
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, assignedEmployeeId: employeeId } : l)))
  }


  async function refreshCallLogs() {
    if (!employee || !['CEO', 'Telecalling', 'Direct Marketing'].includes(portal as string)) return
    try {
      const data = await callsApi.getAll()
      setCallLogs(data)
    } catch (err) { }
  }
  async function refreshQuotations() {
    if (!employee || !['CEO', 'Telecalling', 'Direct Marketing', 'Project Head', 'Accountant', 'Partner'].includes(portal as string)) return
    try {
      const data = await quotationsApi.getAll()
      setQuotations(data)
    } catch (err) { }
  }
  async function refreshSiteVisits() {
    if (!employee || !['CEO', 'Telecalling', 'Direct Marketing', 'Site Visit', 'Field Technician', 'Project Head', 'Warehouse'].includes(portal as string)) return
    try {
      const data = await siteVisitsApi.getAll(portal === 'CEO')
      setSiteVisits(data)
    } catch (err) {
      console.error('Failed to load site visits:', err)
    }
  }

  async function refreshMarketingSiteProducts() {
    if (!employee || !['Telecalling', 'Direct Marketing', 'CEO'].includes(portal as string)) return
    try {
      const data = await siteVisitsApi.getMarketingSiteProducts()
      setMarketingSiteProducts(data)
    } catch (err) {
      console.error('Failed to load marketing site products:', err)
    }
  }

  async function refreshLeaveRequests() {
    if (!employee) return
    try {
      const data = await leaveApi.getAll()
      setLeaveRequests(data)
    } catch (err) {
      console.error('Failed to load leave requests:', err)
    }
  }

  async function refreshAttendanceRecords() {
    if (!employee) return
    try {
      const data = await attendanceApi.getAll()
      setAttendanceRecords(data)
    } catch (err) {
      console.error('Failed to load attendance records:', err)
    }
  }

  async function refreshProjects() {
    if (!employee) return
    try {
      const data = await projectsApi.getAll()
      setProjects(data)
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }

  async function refreshPayments() {
    if (!employee || !['CEO', 'Accountant', 'Project Head', 'Partner'].includes(portal as string)) return
    try {
      const data = await paymentsApi.getAll()
      setPayments(data)
    } catch (err) {
      console.error('Failed to load payments:', err)
    }
  }

  async function refreshFieldMovements() {
    if (!employee || !['CEO', 'Direct Marketing', 'Site Visit', 'Field Technician', 'Document Follow-up', 'Transport'].includes(portal as string)) return
    try {
      const data = await fieldWorkApi.getAll()
      setFieldMovements(data)
    } catch (err) {
      console.error('Failed to load field movements:', err)
    }
  }

  async function refreshEbApplications() {
    if (!employee || !['CEO', 'Document Follow-up', 'Project Head'].includes(portal as string)) return
    try {
      const data = await ebApplicationsApi.getAll()
      setEbApplications(data)
    } catch (err) {
      console.error('Failed to load EB applications:', err)
    }
  }

  const uploadEbDocument: AppState['uploadEbDocument'] = async (id, file, documentType, remarks) => {
    await ebApplicationsApi.uploadDocument(id, file, documentType, remarks)
    await refreshEbApplications()
  }

  const verifyEbDocuments: AppState['verifyEbDocuments'] = async (id, status, reason) => {
    await ebApplicationsApi.verifyDocuments(id, status, reason)
    await refreshEbApplications()
  }

  const submitEbPortal: AppState['submitEbPortal'] = async (id, ref, remarks) => {
    await ebApplicationsApi.submitPortal(id, ref, remarks)
    await refreshEbApplications()
  }

  const handoverEbApplication: AppState['handoverEbApplication'] = async (id, details, remarks) => {
    await ebApplicationsApi.handover(id, details, remarks)
    await refreshEbApplications()
  }

  useEffect(() => {
    refreshQuotations()
    refreshCallLogs()
    refreshSiteVisits()
    refreshMarketingSiteProducts()
    refreshLeaveRequests()
    refreshAttendanceRecords()
    refreshProjects()
    refreshNotifications()
    refreshPayments()
    refreshFieldMovements()
    refreshStock()
    refreshEbApplications()
    refreshProducts()
    refreshInvoices()
    refreshCeoDashboard()
  }, [employee, portal])

  useEffect(() => {
    if (!connected) return

    // Resynchronize state immediately on successful connect/reconnect
    // to recover anything missed while disconnected
    refreshNotifications()
    refreshProjects()
    refreshLeads()
    refreshStock()
    refreshPayments()
    refreshQuotations()
    refreshCeoDashboard()
    refreshEbApplications()
    refreshProducts()
    refreshInvoices()

    // Setup debouncing variables for rapid events
    let notifTimeout: any;
    const debouncedRefreshNotifications = () => {
      clearTimeout(notifTimeout);
      notifTimeout = setTimeout(() => refreshActions.current.refreshNotifications?.(), 100);
    };

    let projTimeout: any;
    const debouncedRefreshProjects = () => {
      clearTimeout(projTimeout);
      projTimeout = setTimeout(() => refreshActions.current.refreshProjects?.(), 100);
    };

    const unsubLead = subscribe('lead.created', () => refreshActions.current.refreshLeads?.())
    const unsubLeadUpd = subscribe('lead.updated', () => refreshActions.current.refreshLeads?.())
    const unsubProj = subscribe('project.created', () => debouncedRefreshProjects())
    const unsubProjUpd = subscribe('project.updated', () => {
      debouncedRefreshProjects()
      // Project updates (e.g., assignment, stage change) also affect EB applications
      refreshActions.current.refreshEbApplications?.()
    })
    const unsubPay = subscribe('payment.created', () => refreshActions.current.refreshPayments?.())
    const unsubPayUpd = subscribe('payment.updated', () => {
      refreshActions.current.refreshPayments?.()
      // Payment verification advances the project stage — refresh projects too
      debouncedRefreshProjects()
    })

    let svTimeout: any;
    const debouncedRefreshSiteVisits = () => {
      clearTimeout(svTimeout);
      svTimeout = setTimeout(() => { 
        refreshActions.current.refreshSiteVisits?.(); 
        refreshActions.current.refreshMarketingSiteProducts?.(); 
        refreshActions.current.refreshQuotations?.();
      }, 100);
    };
    const unsubSV = subscribe('site_visit.created', () => debouncedRefreshSiteVisits())
    const unsubSVUpd = subscribe('site_visit.updated', () => debouncedRefreshSiteVisits())
    
    const unsubNotif = subscribe('notification.created', () => {
      debouncedRefreshNotifications()
      // Notifications often accompany project/payment/assignment state changes — keep data in sync
      debouncedRefreshProjects()
      refreshActions.current.refreshPayments?.()
      // Assignment notifications also create EB applications for doc employees
      refreshActions.current.refreshEbApplications?.()
      // Ensure specific teams also get their data refreshed on new notification
      refreshActions.current.refreshSiteVisits?.()
      refreshActions.current.refreshStock?.()
      refreshActions.current.refreshFieldMovements?.()
    })
    
    const unsubDash = subscribe('dashboard.updated', () => refreshActions.current.refreshCeoDashboard?.())
    const unsubStockReq = subscribe('stock_request.created', () => refreshActions.current.refreshStock?.())
    const unsubStockUpd = subscribe('stock.updated', () => refreshActions.current.refreshStock?.())
    const unsubQuot = subscribe('quotation.created', () => refreshActions.current.refreshQuotations?.())
    const unsubQuotUpd = subscribe('quotation.updated', () => refreshActions.current.refreshQuotations?.())
    const unsubInv = subscribe('invoice.created', () => refreshActions.current.refreshInvoices?.())
    const unsubInvUpd = subscribe('invoice.updated', () => refreshActions.current.refreshInvoices?.())
    const unsubProd = subscribe('product.created', () => refreshActions.current.refreshProducts?.())
    const unsubProdUpd = subscribe('product.updated', () => refreshActions.current.refreshProducts?.())

    return () => {
      unsubLead()
      unsubLeadUpd()
      unsubProj()
      unsubProjUpd()
      unsubPay()
      unsubPayUpd()
      unsubSV()
      unsubSVUpd()
      unsubNotif()
      unsubDash()
      unsubStockReq()
      unsubStockUpd()
      unsubQuot()
      unsubQuotUpd()
      unsubInv()
      unsubInvUpd()
      unsubProd()
      unsubProdUpd()
      clearTimeout(notifTimeout);
      clearTimeout(projTimeout);
      clearTimeout(svTimeout);
    }
  }, [connected, employee, portal])

  const addProduct: AppState['addProduct'] = async (product) => {
    try {
      const created = await productsApi.create(product)
      await refreshProducts()
      return created
    } catch (err) {
      console.error('Failed to add product:', err)
      throw err
    }
  }

  const updateProduct: AppState['updateProduct'] = async (id, patch) => {
    try {
      const updated = await productsApi.update(id, patch)
      await refreshProducts()
      return updated
    } catch (err) {
      console.error('Failed to update product:', err)
      throw err
    }
  }

  const deleteProduct: AppState['deleteProduct'] = async (id) => {
    try {
      await productsApi.delete(id)
      await refreshProducts()
    } catch (err) {
      console.error('Failed to delete product:', err)
      throw err
    }
  }

  const addCallLog: AppState['addCallLog'] = async (entry) => {
    try {
      await callsApi.create(entry)
      await refreshCallLogs()
    } catch (err) {
      console.error('Failed to add call log', err)
    }
  }

  const submitPayment: AppState['submitPayment'] = async (input) => {
    try {
      const { paymentScreenshotFile, ...payload } = input
      let newPayment = await paymentsApi.create(payload)
      if (paymentScreenshotFile) {
        await paymentsApi.uploadProof(newPayment.id, paymentScreenshotFile, paymentScreenshotFile.name)
        newPayment = await paymentsApi.update(newPayment.id, {}) // fetch latest to get proof URL, or rely on WS
      }
      setPayments(prev => [newPayment, ...prev])
      return newPayment
    } catch (err) {
      console.error('Failed to submit payment:', err)
      throw err
    }
  }

  const updatePayment: AppState['updatePayment'] = async (id, input) => {
    try {
      const { paymentScreenshotFile, ...payload } = input
      let updatedPayment = await paymentsApi.update(id, payload)
      if (paymentScreenshotFile) {
        await paymentsApi.uploadProof(id, paymentScreenshotFile, paymentScreenshotFile.name)
        updatedPayment = await paymentsApi.update(id, {}) // fetch latest
      }
      setPayments(prev => prev.map(p => p.id === id ? updatedPayment : p))
      return updatedPayment
    } catch (err) {
      console.error('Failed to update payment:', err)
      throw err
    }
  }

  const addQuotation: AppState['addQuotation'] = async (q) => {
    try {
      const newQuotation = await quotationsApi.create(q)
      setQuotations(prev => [newQuotation, ...prev])
      return newQuotation
    } catch (err) {
      console.error('Failed to add quotation', err)
      return undefined
    }
  }

  const updateQuotation: AppState['updateQuotation'] = async (id, q) => {
    try {
      const updated = await quotationsApi.update(id, q)
      setQuotations(prev => prev.map(item => item.id === id ? updated : item))
      return updated
    } catch (err) {
      console.error('Failed to update quotation', err)
      return undefined
    }
  }

  const reviseQuotation: AppState['reviseQuotation'] = async (quotationId, updates, reason) => {
    try {
      const revised = await quotationsApi.revise(quotationId, { ...updates, revisionReason: reason })
      setQuotations(prev => [...prev, revised])
      return revised
    } catch (err) {
      console.error('Failed to revise quotation', err)
      return undefined
    }
  }

  const updateQuotationStatus: AppState['updateQuotationStatus'] = async (quotationId, status, _extra) => {
    try {
      const updated = await quotationsApi.updateStatus(quotationId, status)
      setQuotations(prev => prev.map(q => q.id === quotationId ? updated : q))
      if (status === 'Awaiting Advance') {
        // Project might have been created, rely on websocket event `project.created`
      }
    } catch (err) {
      console.error('Failed to update quotation status', err)
    }
  }

  const deleteQuotation: AppState['deleteQuotation'] = async (quotationId) => {
    try {
      await quotationsApi.delete(quotationId)
      setQuotations(prev => prev.filter(q => q.id !== quotationId))
    } catch (err) {
      console.error('Failed to delete quotation', err)
    }
  }

  const generateInvoice: AppState['generateInvoice'] = async (quotation, customData) => {
    const existing = invoices.find(
      (invoice) =>
        (invoice.quotationId && invoice.quotationId === quotation.id) ||
        (invoice.quotationNumber && invoice.quotationNumber === quotation.quotationNumber)
    )
    if (existing && !customData) return existing

    const issuedOn = new Date().toISOString().slice(0, 10)
    let invoiceNumber = customData?.invoiceNumber
    if (!invoiceNumber) {
      try {
        const nextRes = await invoicesApi.getNextNumber()
        if (nextRes?.nextInvoiceNumber) {
          invoiceNumber = nextRes.nextInvoiceNumber
        }
      } catch (err) {
        console.error('Failed to get next invoice number', err)
      }
    }

    const invoiceData: Partial<Invoice> = {
      quotationId: quotation.id,
      quotationNumber: String(quotation.quotationNumber || ''),
      customerName: String(quotation.customerName || ''),
      site: String(quotation.site || ''),
      projectType: String(quotation.projectType || ''),
      issueDate: issuedOn,
      dueDate: issuedOn,
      grandTotal: quotation.grandTotal,
      advanceAmount: quotation.advanceAmount,
      balanceAmount: quotation.balanceAmount,
      taxableAmount: quotation.subtotal || 0,
      gstPercent: (quotation.taxTotal && quotation.subtotal) ? Math.round((quotation.taxTotal / quotation.subtotal) * 100) : 0,
      gstAmount: quotation.taxTotal || 0,
      ...(invoiceNumber ? { invoiceNumber } : {}),
      ...(customData || {}),
    }
    const created = await invoicesApi.create(invoiceData)
    await refreshInvoices()
    return created
  }

  const updateInvoice: AppState['updateInvoice'] = async (invoiceId, updates) => {
    await invoicesApi.update(invoiceId, updates)
    await refreshInvoices()
  }

  const startFieldVisit: AppState['startFieldVisit'] = async (entry) => {
    try {
      const newEntry = await fieldWorkApi.start(entry)
      await refreshFieldMovements()
      return newEntry
    } catch (err) {
      console.error('Failed to start field visit', err)
      throw err
    }
  }

  const updateFieldVisit: AppState['updateFieldVisit'] = async (id, patch) => {
    try {
      if (patch.status || patch.location) {
        await fieldWorkApi.update(id, {
          status: patch.status,
          currentLocation: patch.location
        })
      }

      if (patch.note) {
        await fieldWorkApi.addNote(id, patch.note)
      }

      if (patch.photo) {
        const res = await fetch(patch.photo)
        const blob = await res.blob()
        await fieldWorkApi.uploadPhoto(id, blob, 'field_photo.jpg')
      }

      await refreshFieldMovements()
    } catch (err) {
      console.error('Failed to update field visit', err)
    }
  }

  async function scheduleSiteVisit(input: any) {
    const created = await siteVisitsApi.create(input)
    await refreshSiteVisits()
    await refreshLeads()
    return created
  }

  async function startSiteVisit(id: string, lat: number, lng: number, acc: number) {
    await siteVisitsApi.start(id, { latitude: lat, longitude: lng, accuracy: acc })
    await refreshSiteVisits()
  }

  async function uploadSiteVisitPhoto(id: string, blob: Blob, lat: number, lng: number, accuracy: number, stage?: string) {
    await siteVisitsApi.uploadPhoto(id, blob, lat, lng, accuracy, stage)
    await refreshSiteVisits()
  }

  async function addSiteVisitEvidence(id: string, patch: any) {
    await siteVisitsApi.addEvidence(id, patch)
    await refreshSiteVisits()
  }

  async function uploadEvidenceFile(id: string, file: File, type: 'photo' | 'video' | 'measurementImage' | 'document') {
    await siteVisitsApi.uploadEvidenceFile(id, file, type)
    await refreshSiteVisits()
  }

  async function completeSiteVisit(id: string, result: any) {
    await siteVisitsApi.complete(id, result)

    const visit = siteVisits.find((v) => v.id === id)
    if (visit) {
      // The backend now auto-creates the quotation when Site Visit is Completed
      await refreshQuotations()
    }

    if (result.rawMaterialDetails && result.rawMaterialDetails.length > 0) {
      // Backend creates these notifications
    }

    await refreshSiteVisits()
  }

  async function markSiteVisitStockAvailable(id: string) {
    const visit = siteVisits.find((v) => v.id === id)
    if (!visit) return

    // Actually update the backend (mocking here via siteVisitsApi.addEvidence or similar)
    // Since we don't have a dedicated API endpoint for this in our mock, we use addEvidence/complete or we just patch the local state.
    // For this app, addEvidence does a generic patch.
    await siteVisitsApi.addEvidence(id, { stockAvailabilityStatus: 'Available' })

    // Backend handles the notifications for stock availability

    await refreshSiteVisits()
  }

  async function completeSiteVisitStage(id: string, stage: string) {
    await siteVisitsApi.completeStage(id, stage)
    await refreshSiteVisits()
  }

  async function createProjectSiteVisit(projectId: string, customerName: string, customerMobile: string, systemType: string, address: string, latitude: number, longitude: number) {
    if (!employee) return null
    const date = new Date()
    const visitDate = date.toISOString().split('T')[0]
    const visitTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const created = await siteVisitsApi.create({
      projectId,
      customerName,
      customerMobile,
      siteAddress: address,
      customerLatitude: latitude,
      customerLongitude: longitude,
      visitDate,
      visitTime,
      employeeId: employee.id,
      employeeName: employee.name,
      siteType: 'Project Installation',
      systemType,
    })
    await refreshSiteVisits()
    return created
  }

  const verifyPayment: AppState['verifyPayment'] = async (id, verifiedAmount, remarks, _verifiedBy, paymentMode, extra) => {
    try {
      const updated = await paymentsApi.verify(id, 'Verify', {
        actualAmount: verifiedAmount,
        paymentMode: paymentMode ?? 'UPI',
        remarks,
        customerName: extra?.customerName,
        projectId: extra?.projectId,
        quotationId: extra?.quotationId,
        paymentType: extra?.paymentType,
      })
      setPayments(prev => prev.map(p => p.id === id ? updated : p))
      // Do not manually refreshProjects to avoid race condition; let websocket handle it.
    } catch (err) {
      console.error('Failed to verify payment:', err)
      throw err
    }
  }

  const rejectPayment: AppState['rejectPayment'] = async (id, remarks, _verifiedBy) => {
    try {
      const updated = await paymentsApi.verify(id, 'Reject', { remarks })
      setPayments(prev => prev.map(p => p.id === id ? updated : p))
    } catch (err) {
      console.error('Failed to reject payment:', err)
      throw err
    }
  }

  const assignTechnician: AppState['assignTechnician'] = async (projectId, employeeId) => {
    await projectsApi.assign(projectId, { assignedTechnicianId: employeeId })
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, assignedTechnicianId: employeeId } : p)))
  }

  const assignDocEmployee: AppState['assignDocEmployee'] = async (projectId, employeeId) => {
    await projectsApi.assign(projectId, { assignedDocEmployeeId: employeeId })
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, assignedDocEmployeeId: employeeId } : p)))
  }

  const putProjectOnHold: AppState['putProjectOnHold'] = (projectId, reason) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: 'On Hold', holdReason: reason } : p)))
  }

  const resumeProject: AppState['resumeProject'] = (projectId) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: 'On Track', holdReason: undefined } : p)))
  }

  const escalateProject: AppState['escalateProject'] = (projectId, note) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, escalated: true, escalationNote: note } : p)))
  }

  const addProjectInstruction: AppState['addProjectInstruction'] = (projectId, note, by) => {
    const today = new Date().toISOString().slice(0, 10)
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, instructionNotes: [{ date: today, note, by }, ...(p.instructionNotes ?? [])] }
          : p,
      ),
    )
  }

  const refreshStock = async () => {
    if (!employee || !['CEO', 'Project Head', 'Warehouse', 'Site Visit'].includes(portal as string)) return
    try {
      const [itemsRes, reqsRes, groupedReqsRes, txnsRes] = await Promise.all([
        stockApi.getAllItems(),
        stockApi.getRequests(),
        stockApi.getGroupedRequests(),
        stockApi.getTransactions(),
      ])
      setStockItems(itemsRes)
      setStockRequests(reqsRes)
      setGroupedStockRequests(groupedReqsRes)
      setStockMovements(txnsRes)
    } catch (err) {
      console.error('Failed to refresh stock:', err)
    }
  }

  const requestStock: AppState['requestStock'] = async (input) => {
    try {
      if (!input.stockItemId) throw new Error('stockItemId required')
      const res = await stockApi.requestStock(input.stockItemId, input.projectId, input.requiredQuantity, input.notes)
      await refreshStock()
      return res
    } catch (err) {
      console.error('Failed to request stock:', err)
      throw err
    }
  }

  const todayIso = () => new Date().toISOString().slice(0, 10)

  const reserveStockRequest: AppState['reserveStockRequest'] = async (id, _performedBy) => {
    try {
      const reservation = stockRequests.find((r) => r.id === id)
      if (!reservation) return
      await stockApi.reserveStock(reservation.stockItemId, id)
      await refreshStock()
      // rely on websocket for project update if needed
    } catch (err) {
      console.error('Failed to reserve stock', err)
      throw err
    }
  }

  const reserveProjectStockRequest: AppState['reserveProjectStockRequest'] = async (projectId) => {
    try {
      await stockApi.reserveProjectStock(projectId)
      await refreshStock()
      // rely on websocket for project update
    } catch (err) {
      console.error('Failed to reserve project stock', err)
      throw err
    }
  }


  const issueStockRequest: AppState['issueStockRequest'] = async (id, _performedBy) => {
    const req = stockRequests.find((r) => r.id === id)
    if (!req) return
    try {
      await stockApi.issueStock(req.stockItemId, id, req.quantity, 'Issued to site')
      await refreshStock()
      setProjects((prev) => prev.map((p) => (p.id === req.projectId ? { ...p, warehouseStatus: 'Issued' } : p)))
    } catch (err) {
      console.error('Failed to issue stock:', err)
    }
  }

  const flagStockShortage: AppState['flagStockShortage'] = async (input) => {
    return requestStock(input)
  }

  const cancelStockRequest: AppState['cancelStockRequest'] = async (id) => {
    try {
      await stockApi.cancelStockRequest(id)
      await refreshStock()
    } catch (err) {
      console.error('Failed to cancel stock request:', err)
      throw err
    }
  }

  const addStockItem: AppState['addStockItem'] = async (input) => {
    try {
      const { openingQuantity, ...rest } = input
      const newItem = await stockApi.createItem({ ...rest, current_quantity: openingQuantity })
      await refreshStock()
      return newItem
    } catch (err) {
      console.error('Failed to add stock item:', err)
      throw err
    }
  }

  const updateStockItem: AppState['updateStockItem'] = async (id, payload) => {
    try {
      const updated = await stockApi.updateItem(id, payload)
      await refreshStock()
      return updated
    } catch (err) {
      console.error('Failed to update stock item:', err)
      throw err
    }
  }

  const receiveStock: AppState['receiveStock'] = async ({ itemId, quantity, performedBy: _performedBy, supplier, notes }) => {
    try {
      await stockApi.stockIn(itemId, quantity, supplier, notes)
      await refreshStock()
    } catch (err) {
      console.error('Failed to receive stock:', err)
    }
  }

  const recordStockAdjustment: AppState['recordStockAdjustment'] = async (_input) => {
    console.warn('Stock Adjustment not fully implemented in backend yet, using dummy api call.')
    await refreshStock()
  }

  const recordStockTransfer: AppState['recordStockTransfer'] = async (_input) => {
    console.warn('Stock Transfer not fully implemented in backend yet.')
    await refreshStock()
  }

  const returnMaterial: AppState['returnMaterial'] = async ({ projectId, itemId, quantity, performedBy: _performedBy, notes }) => {
    try {
      await stockApi.returnStock(itemId, projectId, quantity, notes)
      await refreshStock()
    } catch (err) {
      console.error('Failed to return material:', err)
      throw err
    }
  }

  const recordProjectIssue: AppState['recordProjectIssue'] = (input) => {
    const id = crypto.randomUUID()
    const newIssue: ProjectIssue = { ...input, id, status: 'Open' }
    setProjectIssues((prev) => [newIssue, ...prev])
    setProjects((prev) => prev.map((p) => (p.id === input.projectId ? { ...p, status: 'Issue Raised' } : p)))
    return newIssue
  }

  const resolveProjectIssue: AppState['resolveProjectIssue'] = (id, resolutionNotes) => {
    const today = new Date().toISOString().slice(0, 10)
    setProjectIssues((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'Resolved', resolutionNotes, resolvedOn: today } : i)))
    const issue = projectIssues.find((i) => i.id === id)
    if (issue) {
      const stillOpen = projectIssues.some((i) => i.projectId === issue.projectId && i.id !== id && i.status === 'Open')
      if (!stillOpen) setProjects((prev) => prev.map((p) => (p.id === issue.projectId && p.status === 'Issue Raised' ? { ...p, status: 'On Track' } : p)))
    }
  }

  const nowTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const startTrip: AppState['startTrip'] = async (id) => {
    const delivery = deliveries.find((d) => d.id === id)
    if (!delivery) return
    const now = nowTime()
    const movement = await startFieldVisit({
      employeeId: delivery.assignedDriverId,
      employeeName: delivery.assignedDriverName,
      role: 'Driver',
      status: 'On Field',
      currentLocation: delivery.pickup,
      destination: delivery.destination,
      startTime: now,
    })
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: 'Trip Started', fieldMovementId: movement.id, startedOn: todayIso() } : d,
      ),
    )
  }

  const updateTripLocation: AppState['updateTripLocation'] = (id, location) => {
    const delivery = deliveries.find((d) => d.id === id)
    if (!delivery) return
    if (delivery.fieldMovementId) {
      updateFieldVisit(delivery.fieldMovementId, { location, status: delivery.status === 'Returning' ? 'Returning' : 'On Field' })
    }
    setDeliveries((prev) => prev.map((d) => (d.id === id && (d.status === 'Trip Started' || d.status === 'On Route') ? { ...d, status: 'On Route' } : d)))
  }

  const recordArrival: AppState['recordArrival'] = (id) => {
    const delivery = deliveries.find((d) => d.id === id)
    if (!delivery) return
    if (delivery.fieldMovementId) updateFieldVisit(delivery.fieldMovementId, { location: delivery.destination, note: 'Arrived at destination' })
    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'Arrived' } : d)))
  }

  const capturePickupPhoto: AppState['capturePickupPhoto'] = (id, photo) => {
    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, pickupPhoto: photo } : d)))
  }

  const captureDeliveryPhoto: AppState['captureDeliveryPhoto'] = (id, photo) => {
    const delivery = deliveries.find((d) => d.id === id)
    if (delivery?.fieldMovementId) updateFieldVisit(delivery.fieldMovementId, { photo })
    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, deliveryPhoto: photo } : d)))
  }

  const confirmDelivery: AppState['confirmDelivery'] = (id, receivedBy, notes) => {
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: 'Delivered', deliveryConfirmation: { receivedBy, notes, confirmedOn: todayIso() } } : d,
      ),
    )
  }

  const startReturnTrip: AppState['startReturnTrip'] = async (id) => {
    const delivery = deliveries.find((d) => d.id === id)
    if (!delivery) return
    if (delivery.fieldMovementId) {
      await updateFieldVisit(delivery.fieldMovementId, { status: 'Returning' })
      setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'Returning' } : d)))
    } else {
      const now = nowTime()
      const movement = await startFieldVisit({
        employeeId: delivery.assignedDriverId,
        employeeName: delivery.assignedDriverName,
        role: 'Driver',
        status: 'Returning',
        currentLocation: delivery.destination,
        destination: delivery.pickup,
        startTime: now,
      })
      setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'Returning', fieldMovementId: movement.id } : d)))
    }
  }

  const recordReturnedMaterial: AppState['recordReturnedMaterial'] = (id, photo, notes) => {
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, returnedMaterialEvidence: [...(d.returnedMaterialEvidence ?? []), photo], returnedMaterialNotes: notes ?? d.returnedMaterialNotes }
          : d,
      ),
    )
  }

  const endTrip: AppState['endTrip'] = (id) => {
    const delivery = deliveries.find((d) => d.id === id)
    if (!delivery) return
    if (delivery.fieldMovementId) updateFieldVisit(delivery.fieldMovementId, { status: 'Checked Out', location: 'Warehouse, Ariyamangalam' })
    setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'Completed', completedOn: todayIso() } : d)))
  }

  const startWork: AppState['startWork'] = ({ projectId, technicianId, toolsTaken, materialsTaken, startingPhoto }) => {
    const project = projects.find((p) => p.id === projectId)
    const now = nowTime()
    startFieldVisit({
      employeeId: technicianId, employeeName: 'Field Technician', role: 'Field Technician',
      status: 'On Field', currentLocation: 'Warehouse, Ariyamangalam', destination: project?.site,
      startTime: now,
    })
    const log: FieldWorkLog = {
      id: crypto.randomUUID(), projectId, technicianId, date: todayIso(), startTime: now,
      locationActivated: true, toolsTaken, materialsTaken,
      startingPhotos: startingPhoto ? [startingPhoto] : [],
      updates: [],
    }
    setFieldWorkLogs((prev) => [...prev, log])
    setProjects((prev) => prev.map((p) => (p.id === projectId && p.installationStatus === 'Not Started' ? { ...p, installationStatus: 'In Progress' } : p)))
  }

  const addWorkUpdate: AppState['addWorkUpdate'] = (logId, update) => {
    setFieldWorkLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, updates: [...l.updates, { ...update, time: nowTime() }] } : l)))
  }

  const submitEndOfDay: AppState['submitEndOfDay'] = (logId, report) => {
    setFieldWorkLogs((prev) => prev.map((l) => (l.id === logId ? { ...l, endOfDay: { ...report, submittedOn: todayIso() } } : l)))
  }

  const completeInstallation: AppState['completeInstallation'] = async ({ projectId, technicianId, materialsConsumed, unusedMaterials, photos, videos, finalRemarks, unusedItemId, unusedQuantity }) => {
    let returned = false
    const id = crypto.randomUUID()
    if (unusedItemId && unusedQuantity && unusedQuantity > 0) {
      returnMaterial({ projectId, itemId: unusedItemId, quantity: unusedQuantity, performedBy: 'Field Technician', notes: unusedMaterials })
      returned = true
    }
    const completion: InstallationCompletion = {
      id, projectId, technicianId, completionDate: todayIso(), materialsConsumed, unusedMaterials, photos, videos, finalRemarks,
      materialsReturnedToWarehouse: returned,
    }
    setInstallationCompletions((prev) => [...prev, completion])
    // Persist locally
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, installationStatus: 'Completed' } : p)))
    // Notify backend → triggers real-time WS event to Project Head
    try {
      const updated = await projectsApi.updateInstallationStatus(projectId, 'Completed', finalRemarks)
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...updated } : p)))
    } catch (err) {
      console.error('Failed to sync installation completion to backend:', err)
    }
  }


  let fvCounter = finalVerifications.length + 1
  const submitFinalVerification: AppState['submitFinalVerification'] = (input) => {
    const id = `fv${fvCounter++}`
    setFinalVerifications((prev) => [...prev, { ...input, id, submittedOn: todayIso() }])
    setProjects((prev) => prev.map((p) => (p.id === input.projectId ? { ...p, currentStage: 'Final Connection' } : p)))
  }

  let crCounter = customerReviews.length + 1
  const submitCustomerReview: AppState['submitCustomerReview'] = (input) => {
    const id = `cr${crCounter++}`
    setCustomerReviews((prev) => [...prev, { ...input, id, submittedOn: todayIso() }])
    setProjects((prev) =>
      prev.map((p) => (p.id === input.projectId ? { ...p, reviewCompleted: true, status: 'Completed', currentStage: 'Completed', nextAction: 'Project closed' } : p)),
    )
  }

  let fuCounter = followUpLogs.length + 1
  const logFollowUp: AppState['logFollowUp'] = ({ ebApplicationId, nextContact, customerResponse, governmentStatus, followUpRemarks }) => {
    const id = `fu${fuCounter++}`
    setFollowUpLogs((prev) => [...prev, { id, ebApplicationId, lastContact: todayIso(), nextContact, customerResponse, governmentStatus, followUpRemarks, loggedOn: todayIso() }])
  }

  const applyLeave: AppState['applyLeave'] = async (input) => {
    const { leaveType, fromDate, medicalCertificate } = input
    if (leaveType === 'Casual') {
      const minDate = new Date()
      minDate.setDate(minDate.getDate() + 3)
      const minIso = minDate.toISOString().slice(0, 10)
      if (fromDate < minIso) {
        return { ok: false, error: 'Casual leave requires at least 3 days advance notice.' }
      }
    }
    if (leaveType === 'Sick' && !medicalCertificate) {
      return { ok: false, error: 'A medical certificate is required for sick leave.' }
    }

    try {
      await leaveApi.submit(input)
      await refreshLeaveRequests()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.detail || 'Failed to submit leave request.' }
    }
  }

  const decideLeave: AppState['decideLeave'] = async (id, status, remarks) => {
    try {
      if (status === 'Approved') {
        await leaveApi.approve(id, remarks)
      } else {
        await leaveApi.reject(id, remarks)
      }
      await refreshLeaveRequests()
    } catch (err) {
      console.error('Failed to decide leave:', err)
    }
  }

  const checkInAttendance: AppState['checkInAttendance'] = async ({ type }) => {
    try {
      await attendanceApi.checkIn(type)
      await refreshAttendanceRecords()
    } catch (err) {
      console.error('Failed to check in:', err)
    }
  }

  const checkOutAttendance: AppState['checkOutAttendance'] = async () => {
    try {
      await attendanceApi.checkOut()
      await refreshAttendanceRecords()
    } catch (err) {
      console.error('Failed to check out:', err)
    }
  }

  // Update refs right before rendering so callbacks always have the freshest closures
  refreshActions.current = {
    refreshLeads,
    refreshProjects,
    refreshEbApplications,
    refreshPayments,
    refreshSiteVisits,
    refreshMarketingSiteProducts,
    refreshQuotations,
    refreshNotifications,
    refreshCeoDashboard,
    refreshStock,
    refreshInvoices,
    refreshProducts,
    refreshFieldMovements,
    refreshLeaveRequests,
    refreshAttendanceRecords,
    refreshCallLogs
  }

  return (
    <AppContext.Provider
      value={{
        leads, refreshLeads, callLogs, refreshCallLogs, quotations, fieldMovements, refreshFieldMovements,
        addLead, addExistingCustomerLead, updateLeadStatus, reassignLead, addCallLog,
        addQuotation, updateQuotation, reviseQuotation, updateQuotationStatus, deleteQuotation,
        startFieldVisit, updateFieldVisit,
        siteVisits, refreshSiteVisits, marketingSiteProducts, refreshMarketingSiteProducts, scheduleSiteVisit,    startSiteVisit,
    uploadSiteVisitPhoto,
    addSiteVisitEvidence,
    uploadEvidenceFile,
    completeSiteVisit, markSiteVisitStockAvailable, completeSiteVisitStage, createProjectSiteVisit,
        payments, refreshPayments, submitPayment, updatePayment,
        verifyPayment, rejectPayment, markPaymentPartial, setPaymentFollowUp,
        ceoDashboard, refreshCeoDashboard,
        projects, refreshProjects, assignTechnician, assignDocEmployee, putProjectOnHold, resumeProject, escalateProject, addProjectInstruction,
        stockRequests, groupedStockRequests, refreshStock, requestStock, reserveStockRequest, reserveProjectStockRequest, issueStockRequest, flagStockShortage, cancelStockRequest,
        projectIssues, recordProjectIssue, resolveProjectIssue,
        stockItems, stockMovements, projectAllocations: [],
        addStockItem, updateStockItem, receiveStock, recordStockAdjustment, recordStockTransfer, returnMaterial,
        deliveries, startTrip, updateTripLocation, recordArrival, capturePickupPhoto, captureDeliveryPhoto,
        confirmDelivery, startReturnTrip, recordReturnedMaterial, endTrip,
        fieldWorkLogs, installationCompletions, finalVerifications, customerReviews,
        startWork, addWorkUpdate, submitEndOfDay, completeInstallation, submitFinalVerification, submitCustomerReview,
        ebApplications, refreshEbApplications, uploadEbDocument, verifyEbDocuments, submitEbPortal, handoverEbApplication, followUpLogs, logFollowUp,
        leaveRequests, refreshLeaveRequests, applyLeave, decideLeave,
        attendanceRecords, refreshAttendanceRecords, checkInAttendance, checkOutAttendance,
        notifications, refreshNotifications, addNotification, markAllNotificationsRead, markNotificationRead, clearAllNotifications,
        resetDemoData: () => { resetAllPersistedState(); window.location.reload() },
        invoices, refreshInvoices, generateInvoice, updateInvoice,
        products, refreshProducts, addProduct, updateProduct, deleteProduct,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

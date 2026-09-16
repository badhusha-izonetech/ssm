import type {
  Employee, Lead, Project, Quotation, Payment, StockItem,
  FieldMovement, Notification, LeaveRequest, PerformanceRecord,
  ActivityLog, Approval, SiteVisit, StockRequest, ProjectIssue,
  StockMovement, ProjectAllocation, Delivery,
  FieldWorkLog, InstallationCompletion, FinalVerification, CustomerReview,
  EbApplication, FollowUpLog, AttendanceRecord,
} from '../types/models'

export const employees: Employee[] = []
export const leads: Lead[] = []
export const quotations: Quotation[] = []
export const siteVisits: SiteVisit[] = []
export const projects: Project[] = []
export const payments: Payment[] = []
export const stockRequests: StockRequest[] = []
export const projectIssues: ProjectIssue[] = []
export const stockItems: StockItem[] = []
export const stockMovements: StockMovement[] = []
export const projectAllocations: ProjectAllocation[] = []
export const fieldMovements: FieldMovement[] = []
export const fieldWorkLogs: FieldWorkLog[] = []
export const installationCompletions: InstallationCompletion[] = []
export const finalVerifications: FinalVerification[] = []
export const customerReviews: CustomerReview[] = []
export const ebApplications: EbApplication[] = []
export const followUpLogs: FollowUpLog[] = []
export const deliveries: Delivery[] = []
export const notifications: Notification[] = []
export const leaveRequests: LeaveRequest[] = []
export const attendanceRecords: AttendanceRecord[] = []
export const performanceRecords: PerformanceRecord[] = []
export const activityLogs: ActivityLog[] = []
export const approvals: Approval[] = []

export interface ExistingCustomer {
  customerName: string
  mobile: string
  area: string
  site: string
  completedProjectId: string
  completedProjectCode: string
  completedOn: string
  totalValue: number
  capacityKw: number
}

export const existingCustomers: ExistingCustomer[] = []

export const departmentList = [
  { name: 'CEO', teams: ['CEO Portal'] },
  { name: 'Marketing', teams: ['Telecalling', 'Direct / Field Marketing'] },
  { name: 'Site Visit', teams: ['1st Site Visit Team'] },
  { name: 'Accounts', teams: ['Accountant', 'Partner / Payment Receiver'] },
  { name: 'Project', teams: ['Project Head', 'Field Technician', 'Document Follow-up'] },
  { name: 'Warehouse', teams: ['Warehouse / Maintenance'] },
  { name: 'Transport', teams: ['Driver / Assigned Transport'] },
]

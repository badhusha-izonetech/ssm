import { fetchClient, keysToCamel } from './client'

export interface RevenueProject {
  projectId: string
  projectCode: string
  customerName: string
  projectValue: number
  amountReceived: number
  verifiedAmount: number
  pendingAmount: number
  verifiedPct: number
  isFullyPaid: boolean
  fullyPaidDate?: string
  finalVerifier?: string
  revenue: number
  paymentStatus: 'Fully Paid' | 'Partially Paid' | 'Pending'
}

export interface RevenueSummary {
  totalRevenue: number
  totalCollections: number
  pendingReceivables: number
  fullyPaidProjects: number
  partiallyPaidProjects: number
}

export interface RevenueDayData {
  date: string
  revenue: number
}

export interface RevenueData {
  summary: RevenueSummary
  projects: RevenueProject[]
  daily: RevenueDayData[]
  allProjects: RevenueProject[]
}

export interface EmployeeRevenueProjectDetail {
  projectId: string
  projectName: string
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  revenue: number
}

export interface EmployeeRevenueDetail {
  employeeId: string
  employeeName: string
  department: string
  designation: string
  totalRevenue: number
  projects: EmployeeRevenueProjectDetail[]
}

export interface EmployeeRevenueSummaryItem {
  employeeId: string
  employeeName: string
  department: string
  designation: string
  totalRevenue: number
}

export const revenueApi = {
  getSummary: async (dateFrom?: string, dateTo?: string): Promise<RevenueData> => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await fetchClient(`/revenue/summary${query}`)
    return keysToCamel(res) as RevenueData
  },
  getEmployeeSummary: async (dateFrom?: string, dateTo?: string): Promise<EmployeeRevenueSummaryItem[]> => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await fetchClient(`/revenue/employees${query}`)
    return keysToCamel(res) as EmployeeRevenueSummaryItem[]
  },
  getEmployeeDetails: async (employeeId: string, dateFrom?: string, dateTo?: string): Promise<EmployeeRevenueDetail> => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await fetchClient(`/revenue/employees/${employeeId}${query}`)
    return keysToCamel(res) as EmployeeRevenueDetail
  },
}

export interface CallLogEntry {
  id: string
  leadId: string
  date: string
  time: string
  calledBy: string
  outcome: 'Answered' | 'Not Reachable' | 'Call Back Requested' | 'Switched Off' | 'Wrong Number'
  notes: string
  nextFollowUpDate?: string
}

// Success Solar Power Care — shared frontend data models.
// These interfaces are the reference contract for the backend team.
// No backend calls are made from the frontend; all data is mock/local state.

export type Department =
  | 'CEO'
  | 'Marketing'
  | 'Site Visit'
  | 'Accounts'
  | 'Project'
  | 'Warehouse'
  | 'Transport'
  | 'Quotation'

export type Designation =
  | 'CEO'
  | 'Telecaller'
  | 'Direct Marketing Executive'
  | 'Site Visitor'
  | 'Accountant'
  | 'Project Head'
  | 'Field Technician'
  | 'Document Follow-up Executive'
  | 'Stock Maintenance'
  | 'Driver'
  | 'Partner / Payment Receiver'
  | 'Quotation Manager'

export type EmploymentStatus = 'Active' | 'On Leave' | 'Suspended' | 'Relieved'

export interface Employee {
  id: string
  employeeCode: string
  name: string
  mobile: string
  email: string
  joiningDate: string
  department: Department
  designation: Designation
  username: string
  employmentStatus: EmploymentStatus
  avatarColor: string
  location?: string
  familyNumber?: string
  officeNumber?: string
  document1?: string
  document2?: string
  document3?: string
}

export interface EmployeeDailyExpense {
  id: string
  employee_id: string
  expense_date: string
  amount: number
  description: string
}

export interface EmployeeFinancial {
  id: string
  employee_id: string
  financial_month: string
  salary: number
  expenses: number
}

export interface EmployeeFinancialDetails extends EmployeeFinancial {
  employee: Employee
}

export type LeadSource =
  | 'Previous Customer'
  | 'Tele Calling'
  | 'Inquiry Call'
  | 'Walk-in'
  | 'Justdial'
  | 'IndiaMART'
  | 'Google Search'
  | 'BNI'
  | 'Direct Field Visit'
  | 'Other'

export type LeadStatus =
  | 'New'
  | 'Pending CEO Assignment'
  | 'Contacted'
  | 'Interested'
  | 'Follow-up'
  | 'Site Visit Required'
  | 'Site Visit Scheduled'
  | 'Quotation Stage'
  | 'Not Interested'
  | 'Converted'

export type LostReason =
  | 'Price'
  | 'Product Unavailable'
  | 'Company Cannot Provide Requirement'
  | 'Customer Postponed'
  | 'Competitor'
  | 'Not Interested'
  | 'Technical Infeasibility'
  | 'Other'

export interface Lead {
  id: string
  customerName: string
  mobile: string
  alternateMobile?: string
  email?: string
  customerType: 'Residential' | 'Commercial' | 'Industrial'
  address: string
  area: string
  city: string
  leadSource: LeadSource
  sourceReference?: string
  productInterested: string
  requirementDescription: string
  approximateRequirement: string
  priority: 'Low' | 'Medium' | 'High'
  paymentType?: 'Loan' | 'Own Payment'
  assignedEmployeeId?: string
  firstContactDate: string
  status: LeadStatus
  lostReason?: LostReason
  lostReasonDetail?: string
  remarks?: string
  /** Employee id who created this client/lead record (marketing employee or CEO). */
  createdById?: string
  /** Timestamp when lead was created. */
  createdAt?: string
  /** Whether this record originated from a brand-new lead or an already-completed customer returning for another project. */
  customerOrigin?: 'New Lead' | 'Existing Customer'
  /** If customerOrigin is 'Existing Customer', the id of the prior completed project this customer is linked to. */
  priorProjectId?: string
}

export interface Customer {
  id: string
  name: string
  mobile: string
  alternateMobile?: string
  email?: string
  customerType: 'Residential' | 'Commercial' | 'Industrial'
  address?: string
  area?: string
  city?: string
  sourceLeadId?: string
}

export interface GlobalCustomerView {
  id: string
  customerName: string
  mobile: string
  address?: string
  area?: string
  city?: string
  customerType: string
  leadSource: string
  productInterested?: string
  paymentType?: string
  leadStatus: string
  assignedEmployeeName?: string
  projectCode?: string
  projectStage?: string
  createdAt: string
}

export type SiteVisitStatus = 'Upcoming' | 'In Progress' | 'Completed' | 'Revisit Required' | 'Rejected'

export type FeasibilityResult =
  | 'Feasible'
  | 'Feasible with Conditions'
  | 'Revisit Required'
  | 'Not Feasible'
  | 'Customer Requirement Not Supported'

export type SiteType = 'Rooftop - RCC' | 'Rooftop - Sheet' | 'Ground Mount' | 'Industrial Shed' | 'Other'

export interface SiteVisit {
  id: string
  leadId?: string
  projectId?: string
  systemType?: string
  completedStages?: string[]
  customerName: string
  customerMobile: string
  siteAddress: string
  area: string
  customerLatitude?: number
  customerLongitude?: number
  visitDate: string
  visitTime: string
  employeeId: string
  employeeName: string
  siteType: SiteType | string
  installationArea?: string
  measurements?: string
  roofGroundDetails?: string
  productRequirement?: string
  estimatedCapacity?: string
  rawMaterials?: string
  rawMaterialDetails?: { itemId: string; itemName: string; quantity: number }[]
  stockAvailabilityStatus?: 'Pending Check' | 'Available'
  cableAccessories?: string
  notes?: string
  status: SiteVisitStatus
  feasibilityResult?: FeasibilityResult
  rejectionReason?: LostReason
  rejectionRemarks?: string
  photos?: any[]
  sitePhotos?: string[]
  videos?: string[]
  measurementImages?: string[]
  documents?: string[]
  /** Linked FieldMovement id used to simulate live location tracking during the visit. */
  fieldMovementId?: string
  completedOn?: string
  scheduledById?: string
  // Tool / Equipment photo tracking
  toolPhotoBefore?: string
  toolPhotoAfter?: string
  submittedAt?: string
  startedAt?: string
  createdAt?: string
}

export type ProjectStage =
  | 'Awaiting Advance Payment'
  | 'Site Visit'
  | 'Quotation'
  | 'Advance Payment'
  | 'Project Execution'
  | 'Installation'
  | 'Final Connection'
  | 'Completed'

export type ProjectStatus = 'On Track' | 'Delayed' | 'On Hold' | 'Completed' | 'Issue Raised'

export interface Project {
  id: string
  projectCode: string
  customerName: string
  customerMobile: string
  site: string
  area: string
  quotationId: string
  projectValue: number
  advanceReceived: number
  balanceAmount: number
  assignedTechnicianId?: string
  assignedDocEmployeeId?: string
  warehouseStatus: 'Not Requested' | 'Requested' | 'Reserved' | 'Issued'
  ebStatus: 'Not Started' | 'Application Submitted' | 'Meter Installed' | 'Connected'
  installationStatus: 'Not Started' | 'In Progress' | 'Completed'
  currentStage: ProjectStage
  status: ProjectStatus
  nextAction: string
  dueDate: string
  capacityKw: number
  priority: 'Low' | 'Medium' | 'High'
  /** Reason recorded by the Project Head when a project is placed on hold. */
  holdReason?: string
  /** Free-text instructions the Project Head has logged for the field/document team. */
  instructionNotes?: { date: string; note: string; by: string }[]
  /** True once the Project Head has flagged this project for CEO escalation. */
  escalated?: boolean
  escalationNote?: string
  /** Customer review completion — required before a project can reach 'Completed'. */
  reviewCompleted?: boolean
  documentsCompleted?: boolean
  assignments?: ProjectAssignment[]
  uploads?: ProjectUpload[]
  paymentBreakdown?: {
    totalAmount: number
    first_50Required: number
    first_50Paid: number
    first_50Pending: number
    excessAdvanceGenerated: number
    verifiedAdditionalAdvance: number
    advanceAdjusted: number
    second_50Required: number
    second_50Paid: number
    second_50Pending: number
    second_50Excess: number
    totalVerifiedPaid: number
    finalOutstanding: number
  }
}

export interface ProjectAssignment {
  id: string
  employeeId: string
  role: 'Technician' | 'Follow-Up'
  assignmentType: 'Primary' | 'Additional'
  status: string
  assignedById?: string
  createdAt: string
}

export interface ProjectUpload {
  id: string
  employeeId: string
  fileType: string
  fileUrl: string
  stage?: string
  latitude?: number
  longitude?: number
  createdAt: string
}

export type StockRequestStatus = 'Requested' | 'Reserved' | 'Issued' | 'Shortage Flagged'

export interface StockRequest {
  id: string
  projectId: string
  projectCode: string
  itemName: string
  /** Links this request to a Product Master item so warehouse operations move real stock. */
  stockItemId?: string
  requiredQuantity: number
  unit: string
  status: StockRequestStatus
  requestedBy: string
  requestedOn: string
  notes?: string
}

export type ProjectIssueStatus = 'Open' | 'Resolved'

export interface ProjectIssue {
  id: string
  projectId: string
  projectCode: string
  raisedBy: string
  raisedOn: string
  description: string
  status: ProjectIssueStatus
  resolutionNotes?: string
  resolvedOn?: string
}

export type QuotationStatus =
  | 'Quotation Created'
  | 'Submitted'
  | 'Sent'
  | 'Customer Review'
  | 'Revision Required'
  | 'Customer Approved'
  | 'Customer Rejected'
  | 'Awaiting Advance'
  | 'Verified'
  | 'Expired'

export interface QuotationLineItem {
  id: string
  product: string
  brand?: string
  description?: string
  quantity: number
  unit: string
  unitPrice: number
  discount: number
  gstPercent: number
  labourCharge: number
}

export interface Product {
  id: string
  name: string
  category: string
  description?: string
  unit: string
  unitPrice: number
  gstPercent: number
  sortOrder?: number
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Quotation {
  id: string
  quotationNumber: string
  customerName: string
  customerPhone?: string
  site: string
  date: string
  validUntil: string
  preparedBy: string
  preparedById?: string
  projectType: string
  ebNumber?: string
  solarPanel?: string
  solarInverter?: string
  lineItems?: QuotationLineItem[]
  subtotal?: number
  discountTotal?: number
  taxTotal?: number
  labourTotal?: number
  otherCharges?: number
  taxableAmount?: number
  gstPercent?: number
  gstAmount?: number
  grandTotal: number
  advancePercentage: number
  advanceAmount: number
  balanceAmount: number
  paymentTerms?: string
  installationTerms?: string
  warrantyTerms?: string
  termsAndConditions?: string
  notes?: string
  status: QuotationStatus
  revisionNumber: number
  revisionReason?: string
  /** Links to the previous version in the revision chain. The previous quotation is kept, never overwritten. */
  previousQuotationId?: string
  /** Id of the lead this quotation was generated for, if any. */
  leadId?: string
  /** True when created directly by the CEO (bypassing marketing origination). */
  createdByCeo?: boolean
}

export interface Invoice {
  id: string
  invoiceNumber: string
  quotationId: string
  quotationNumber: string
  customerName: string
  site: string
  projectType: string
  issueDate: string
  dueDate: string
  grandTotal: number
  advanceAmount: number
  balanceAmount: number
  /** Editable GST configuration for GST reporting. If absent, use quotation GST. */
  taxableAmount?: number
  gstPercent?: number
  gstAmount?: number
  billingAddress?: string
  notes?: string
  paymentTerms?: string
  installationTerms?: string
  termsAndConditions?: string
}

export type PaymentType = 'Advance' | 'Advance (50%)' | 'Balance Payment' | 'Partial Payment' | 'Full Payment' | 'Other'
export type PaymentState =
  | 'Pending'
  | 'Partial'
  | 'Proof Uploaded'
  | 'Under Verification'
  | 'Verified'
  | 'Rejected'

export interface Payment {
  id: string
  projectId?: string
  customerName: string
  quotationId?: string
  expectedAmount: number
  actualAmount: number
  paymentType: PaymentType
  paymentDate: string
  paymentMode: 'UPI' | 'Bank Transfer' | 'Cheque' | 'Cash' | 'Card'
  transactionReference?: string
  proofs?: { id: string; fileUrl: string; uploadedAt: string }[]
  state: PaymentState
  submittedBy?: string
  verifiedBy?: string
  verifiedAmount?: number
  remarks?: string
  /** Set by the Accountant when a follow-up call/visit is needed for the balance/shortfall. */
  followUpDate?: string
  /** Timestamp of the most recent verification action, for Payment History ordering. */
  verifiedOn?: string
}

export interface StockItem {
  id: string
  productName: string
  category: string
  brand: string
  model: string
  unit: string
  /** Applicable for serialised items like inverters/batteries. */
  serialPrefix?: string
  currentQuantity: number
  reservedQuantity: number
  availableQuantity: number
  minimumLevel: number
  costPerUnit: number
  /** Free-text purchase/supplier reference for the last stock receipt. */
  supplier?: string
  lastReceiptDate?: string
}

export type StockMovementType =
  | 'Receipt'
  | 'Reservation'
  | 'Issue'
  | 'Return'
  | 'Adjustment'
  | 'Damage'
  | 'Missing'
  | 'Transfer'

export interface StockMovement {
  id: string
  itemId: string
  itemName: string
  unit: string
  type: StockMovementType
  quantity: number
  date: string
  performedBy: string
  projectId?: string
  projectCode?: string
  notes?: string
  /** Links back to the StockRequest this movement fulfilled, if any. */
  referenceStockRequestId?: string
}

/** Per-project, per-item material accountability, per the Warehouse portal's
 * required/reserved/issued/used/returned/balance tracking. */
export interface ProjectAllocation {
  id: string
  projectId: string
  projectCode: string
  itemId: string
  itemName: string
  unit: string
  requiredQuantity: number
  reservedQuantity: number
  issuedQuantity: number
  usedQuantity: number
  returnedQuantity: number
}

export interface FieldMovement {
  id: string
  employeeId: string
  employeeName: string
  role: string
  status: 'Checked In' | 'On Field' | 'Returning' | 'Checked Out'
  currentLocation: string
  destination?: string
  startTime: string
  lastUpdate: string
  routeHistory: { time: string; location: string }[]
  /** Mock captured site/visit photos (data URLs), used by field visit + marketing field visit flows. */
  photos?: string[]
  /** Free-text visit notes/log entries captured during the field visit. */
  visitNotes?: string[]
  /** Linked lead/customer this field visit relates to, if any. */
  leadId?: string
  /** Free-text task/purpose description captured when the visit was started. */
  purpose?: string
  /** Real GPS "last known position", populated once the field employee's app sends its first fix. */
  lastLatitude?: number | null
  lastLongitude?: number | null
  lastAccuracy?: number | null
  lastSpeed?: number | null
  lastHeading?: number | null
  lastLocationAt?: string | null
}

export interface FieldMovementLocation {
  id: string
  fieldMovementId: string
  employeeId: string
  latitude: number
  longitude: number
  accuracy: number
  speed?: number | null
  heading?: number | null
  capturedAt: string
}

export interface Notification {
  id: string
  title: string
  message: string
  department?: Department
  recipientId?: string
  timestamp: string
  read: boolean
  priority: 'Low' | 'Medium' | 'High'
  category: 'Approval' | 'Payment' | 'Stock' | 'Project' | 'Leave' | 'System' | 'Lead' | 'Feedback' | 'Quotation' | 'Site Request' | 'GST' | string
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  leaveType: 'Casual' | 'Sick' | 'Emergency' | 'Unpaid'
  fromDate: string
  toDate: string
  reason: string
  medicalCertificate?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  appliedOn: string
  ceoRemarks?: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  department: Department
  date: string
  type: 'Office' | 'Field'
  checkInTime?: string
  checkOutTime?: string
  status: 'Present' | 'Half Day' | 'Absent' | 'On Leave'
}

export interface PerformanceRecord {
  id: string
  employeeId: string
  employeeName: string
  department: Department
  role: string
  period: string
  score: number
  rank: number
  completedWork: number
  pendingWork: number
  efficiency: number
  remarks?: string
}

export interface ActivityLog {
  id: string
  timestamp: string
  actor: string
  department: Department
  action: string
  entity: string
  detail: string
}

export type DeliveryStatus =
  | 'Assigned'
  | 'Trip Started'
  | 'On Route'
  | 'Arrived'
  | 'Delivered'
  | 'Returning'
  | 'Completed'

/** Driver / Transport portal — a single pickup-to-delivery (and return) trip tied to a project. */
export interface Delivery {
  id: string
  projectId: string
  projectCode: string
  customerName: string
  pickup: string
  destination: string
  /** Free-text summary of what is being carried, e.g. "10 Sets Mounting Structure (GI)". */
  materialSummary: string
  /** Optional link back to the Warehouse stock request this delivery fulfils. */
  stockRequestId?: string
  assignedDriverId: string
  assignedDriverName: string
  status: DeliveryStatus
  scheduledDate: string
  /** Links to the shared FieldMovement record used to simulate live GPS + route history. */
  fieldMovementId?: string
  pickupPhoto?: string
  deliveryPhoto?: string
  deliveryConfirmation?: { receivedBy: string; notes?: string; confirmedOn: string }
  returnedMaterialEvidence?: string[]
  returnedMaterialNotes?: string
  startedOn?: string
  completedOn?: string
}

export interface WorkUpdate {
  time: string
  status: string
  photos: string[]
  materialsUsed?: string
  remarks?: string
  problems?: string
}

export interface EndOfDayReport {
  workCompleted: string
  remainingWork?: string
  materialsRemaining?: string
  toolStatus: string
  sitePhotos: string[]
  remarks?: string
  submittedOn: string
}

/** Field Technician portal — one field-work session for a project, with mandatory 3-hourly updates. */
export interface FieldWorkLog {
  id: string
  projectId: string
  technicianId: string
  date: string
  startTime: string
  locationActivated: boolean
  toolsTaken: string[]
  materialsTaken: string[]
  startingPhotos: string[]
  updates: WorkUpdate[]
  endOfDay?: EndOfDayReport
}

export interface InstallationCompletion {
  id: string
  projectId: string
  technicianId: string
  completionDate: string
  materialsConsumed: string
  unusedMaterials?: string
  photos: string[]
  videos: string[]
  finalRemarks?: string
  materialsReturnedToWarehouse: boolean
}

export interface ChecklistItem {
  label: string
  checked: boolean
}

export interface FinalVerification {
  id: string
  projectId: string
  technicianId: string
  technicianName: string
  date: string
  time: string
  location: string
  ebMeterDetails: string
  connectionDetails: string
  technicalChecklist: ChecklistItem[]
  measurements: string
  finalPhotos: string[]
  issues?: string
  resolution?: string
  finalRemarks?: string
  submittedOn: string
}

export interface CustomerReview {
  id: string
  projectId: string
  customerName: string
  technicianId: string
  technicianName: string
  rating: number
  installationQuality: number
  technicianBehaviour: number
  overallSatisfaction: number
  comments?: string
  complaint?: string
  customerConfirmation: boolean
  submittedOn: string
}

export interface EbDocument {
  id: string
  ebApplicationId: string
  documentType: string
  fileUrl: string
  remarks?: string
  uploadedById?: string
  createdAt: string
}

export interface EbApplication {
  id: string
  projectId: string
  projectCode: string
  customerName: string
  customerMobile?: string
  projectDetails?: string
  assignedTeam: string
  assignedById?: string
  assignedAt: string
  assignedEmployeeId?: string
  currentStage: 'Application Received' | 'Document Collection' | 'Document Verification' | 'EB/TANGEDCO Portal Submission' | 'EB Process / Awaiting Further Action' | 'Handover Application with EB Meter Supply'
  
  verificationStatus: 'Pending' | 'VERIFIED' | 'NOT_VERIFIED'
  verificationReason?: string
  verifiedById?: string
  verificationDate?: string
  
  portalSubmissionStatus: 'Pending' | 'COMPLETED'
  submittedById?: string
  submissionDate?: string
  portalReference?: string
  portalRemarks?: string
  
  handoverStatus: 'Pending' | 'COMPLETED'
  handedOverById?: string
  handoverDate?: string
  meterSupplyDetails?: string
  handoverRemarks?: string

  followUpDate?: string
  contactedPerson?: string
  ebStatus?: string

  createdAt: string
  updatedAt: string
  
  documents: EbDocument[]
}

export interface EbStageHistory {
  id: string
  ebApplicationId: string
  fromStage?: string
  toStage: string
  changedAt: string
  changedById?: string
  remarks?: string
}

export interface EbDashboardCounters {
  application_received: number
  documents_pending: number
  documents_not_verified: number
  documents_verified: number
  portal_submission_pending: number
  portal_submitted: number
  handover_pending: number
  completed: number
}

export interface FollowUpLog {
  id: string
  ebApplicationId: string
  lastContact: string
  nextContact?: string
  customerResponse: string
  governmentStatus: string
  followUpRemarks?: string
  loggedOn: string
}

export interface Approval {
  id: string
  type: 'Quotation Revision' | 'Stock Purchase Flag' | 'Leave Request' | 'Project Hold' | 'Discount Exception'
  requestedBy: string
  department: Department
  summary: string
  raisedOn: string
  status: 'Pending' | 'Approved' | 'Rejected'
  priority: 'Low' | 'Medium' | 'High'
}

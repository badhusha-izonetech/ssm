import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/shared/Layout'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppProvider } from './store/AppStore'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Leads from './pages/Leads'
import Customers from './pages/Customers'
import Quotations from './pages/Quotations'
import Invoices from './pages/Invoices'
import Revenue from './pages/Revenue'
import GST from './pages/GST'
import Payments from './pages/Payments'
import Stock from './pages/Stock'
import Employees from './pages/Employees'
import Departments from './pages/Departments'
import FieldMovement from './pages/FieldMovement'
import NotificationsPage from './pages/Notifications'
import Leave from './pages/Leave'
import Performance from './pages/Performance'
import Reports from './pages/Reports'
import Activity from './pages/Activity'
import Approvals from './pages/Approvals'
import MarketingDashboard from './pages/marketing/MarketingDashboard'
import LeadInbox from './pages/marketing/LeadInbox'
import CustomerList from './pages/marketing/CustomerList'
import CallHistory from './pages/marketing/CallHistory'
import FollowUps from './pages/marketing/FollowUps'
import FieldVisit from './pages/marketing/FieldVisit'
import SiteProducts from './pages/marketing/SiteProducts'
import SiteVisitDashboard from './pages/sitevisit/SiteVisitDashboard'
import SiteVisitList from './pages/sitevisit/SiteVisitList'
import PartnerDashboard from './pages/partner/PartnerDashboard'
import PartnerPayments from './pages/partner/PartnerPayments'
import AccountantDashboard from './pages/accountant/AccountantDashboard'
import AccountantPayments from './pages/accountant/AccountantPayments'
import PaymentReports from './pages/accountant/PaymentReports'
import AccountantEmployees from './pages/accountant/AccountantEmployees'
import ProjectHeadDashboard from './pages/projecthead/ProjectHeadDashboard'
import ProjectHeadList from './pages/projecthead/ProjectHeadList'
import StockRequests from './pages/projecthead/StockRequests'
import ProjectIssues from './pages/projecthead/ProjectIssues'
import CompletionMonitoring from './pages/projecthead/CompletionMonitoring'
import ProjectApprovals from './pages/projecthead/ProjectApprovals'
import WarehouseDashboard from './pages/warehouse/WarehouseDashboard'
import ProductMaster from './pages/warehouse/ProductMaster'
import WarehouseRequests from './pages/warehouse/WarehouseRequests'
import StockOperations from './pages/warehouse/StockOperations'
import ProjectAllocations from './pages/warehouse/ProjectAllocations'
import MovementHistory from './pages/warehouse/MovementHistory'
import TransportDashboard from './pages/transport/TransportDashboard'
import DeliveryTasks from './pages/transport/DeliveryTasks'
import TransportMovement from './pages/transport/TransportMovement'
import TechnicianDashboard from './pages/technician/TechnicianDashboard'
import MyProjects from './pages/technician/MyProjects'
import DocumentDashboard from './pages/documents/DocumentDashboard'
import EbApplications from './pages/documents/EbApplications'
import FollowUpCalendar from './pages/documents/FollowUpCalendar'
import FieldMobility from './pages/FieldMobility'
import TechnicianSiteVisits from './pages/technician/TechnicianSiteVisits'
import TechnicianFinalReviews from './pages/technician/TechnicianFinalReviews'
import QuotationDashboard from './pages/quotationdashboard/QuotationDashboard'

function Home() {
  const { portal } = useAuth()
  if (portal === 'CEO') return <Dashboard />
  if (portal === 'Site Visit') return <SiteVisitDashboard />
  if (portal === 'Partner') return <PartnerDashboard />
  if (portal === 'Accountant') return <AccountantDashboard />
  if (portal === 'Project Head') return <ProjectHeadDashboard />
  if (portal === 'Warehouse') return <WarehouseDashboard />
  if (portal === 'Transport') return <TransportDashboard />
  if (portal === 'Field Technician') return <TechnicianDashboard />
  if (portal === 'Document Follow-up') return <DocumentDashboard />
  if (portal === 'Quotation Dashboard') return <QuotationDashboard />
  return <MarketingDashboard />
}

function AppRoutes() {
  const { portal } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/quotations" element={<Quotations />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/leave" element={<Leave />} />
                <Route path="/field-mobility" element={<FieldMobility />} />
                <Route path="/performance" element={<Performance />} />
                <Route path="/customers" element={<Customers />} />

                {portal === 'CEO' && (
                  <>
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/leads" element={<Leads />} />
                    <Route path="/ceo/quotation-dashboard" element={<QuotationDashboard />} />
                    <Route path="/revenue" element={<Revenue />} />
                    <Route path="/gst" element={<GST />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/stock" element={<Stock />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/departments" element={<Departments />} />
                    <Route path="/site-visit/visits" element={<SiteVisitList />} />
                    <Route path="/field-movement" element={<FieldMovement />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/approvals" element={<Approvals />} />
                  </>
                )}

                {portal !== 'CEO' && portal !== 'Site Visit' && portal !== 'Partner' && (
                  <>
                    <Route path="/marketing/leads" element={<LeadInbox />} />
                    <Route path="/marketing/customers" element={<CustomerList />} />
                    <Route path="/marketing/calls" element={<CallHistory />} />
                    <Route path="/marketing/follow-ups" element={<FollowUps />} />
                    <Route path="/marketing/site-products" element={<SiteProducts />} />
                    {portal === 'Direct Marketing' && (
                      <Route path="/marketing/field-visit" element={<FieldVisit />} />
                    )}
                  </>
                )}

                {portal === 'Site Visit' && (
                  <Route path="/site-visit/visits" element={<SiteVisitList />} />
                )}

                {portal === 'Partner' && (
                  <>
                    <Route path="/partner/payments" element={<PartnerPayments />} />
                    <Route path="/projects" element={<Projects />} />
                  </>
                )}

                {portal === 'Accountant' && (
                  <>
                    <Route path="/accountant/verification" element={<AccountantPayments />} />
                    <Route path="/accountant/payments" element={<AccountantPayments />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/accountant/reports" element={<PaymentReports />} />
                    <Route path="/accountant/employees" element={<AccountantEmployees />} />
                  </>
                )}

                {portal === 'Project Head' && (
                  <>
                    <Route path="/project-head/projects" element={<ProjectHeadList />} />
                    <Route path="/project-head/technicians" element={<ProjectHeadList />} />
                    <Route path="/project-head/documents" element={<ProjectHeadList />} />
                    <Route path="/project-head/stock" element={<StockRequests />} />
                    <Route path="/project-head/issues" element={<ProjectIssues />} />
                    <Route path="/project-head/completion" element={<CompletionMonitoring />} />
                    <Route path="/project-head/approvals" element={<ProjectApprovals />} />
                    <Route path="/field-movement" element={<FieldMovement />} />
                  </>
                )}

                {portal === 'Warehouse' && (
                  <>
                    <Route path="/warehouse/products" element={<ProductMaster />} />
                    <Route path="/warehouse/requests" element={<WarehouseRequests />} />
                    <Route path="/warehouse/operations" element={<StockOperations />} />
                    <Route path="/warehouse/allocations" element={<ProjectAllocations />} />
                    <Route path="/warehouse/movements" element={<MovementHistory />} />
                  </>
                )}

                {portal === 'Transport' && (
                  <>
                    <Route path="/transport/tasks" element={<DeliveryTasks />} />
                    <Route path="/transport/movement" element={<TransportMovement />} />
                  </>
                )}

                {portal === 'Field Technician' && (
                  <>
                    <Route path="/technician/projects" element={<MyProjects />} />
                    <Route path="/technician/visits" element={<TechnicianSiteVisits />} />
                    <Route path="/technician/final-reviews" element={<TechnicianFinalReviews />} />
                  </>
                )}

                {portal === 'Document Follow-up' && (
                  <>
                    <Route path="/documents/applications" element={<EbApplications />} />
                    <Route path="/documents/followup" element={<FollowUpCalendar />} />
                  </>
                )}

                {portal === 'Quotation Dashboard' && (
                  <>
                    <Route path="/ceo/quotation-dashboard" element={<QuotationDashboard />} />
                    <Route path="/quotations" element={<Quotations />} />
                  </>
                )}
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

import { WebSocketProvider } from './websocket/WebSocketProvider'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <AppProvider>
            <AppRoutes />
          </AppProvider>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

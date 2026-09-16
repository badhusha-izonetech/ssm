# Success Solar ERP — Backend API Contract

This document is the reference contract for building the real backend. It is derived directly
from the frontend's current source of truth:

- `frontend/src/store/AppStore.tsx` — every state array + action function (this maps 1:1 to entities + endpoints)
- `frontend/src/auth/AuthContext.tsx` — login / session / employee provisioning
- `frontend/src/types/models.ts` — request/response shapes
- `frontend/src/store/persist.ts` — the localStorage keys each endpoint replaces (namespace `essolar:v1:<key>`)

The frontend currently has **no network calls** — every action mutates React state and mirrors it
to `localStorage`. Request/response shapes below are a strong starting point, not a guarantee —
confirm each one as you wire it up.

**Runtime status: verified.** The three flows from the gap report have now actually been run
end-to-end against a built preview server (CEO creates an employee → sign out → new employee logs
in and lands on the correct portal; CEO "Reset demo data" wipes and reseeds correctly; data
survives a real hard browser reload). One real bug was found and fixed in the process — see
`CHANGES.md` in this folder for exactly what was wrong and what was changed.

## Conventions used below

- Base URL: `/api/v1` (adjust to whatever the backend team picks)
- Auth: `Authorization: Bearer <token>` on every route except `POST /auth/login`
- All `id` fields are currently client-generated strings (e.g. `l12`, `q4`, `at7`) via in-memory
  counters (`array.length + 1`). The backend should switch these to server-generated IDs
  (UUID or DB auto-increment) — the frontend does not depend on the `l`/`q`/`at` prefix format,
  it just needs *some* unique string back.
- Dates are ISO strings (`YYYY-MM-DD`); timestamps are locale time strings (e.g. `"11:20 AM"`) —
  worth normalizing to real ISO datetimes server-side even though the frontend currently sends/reads
  the display-formatted string directly.
- "Replaces localStorage key" = the `essolar:v1:<key>` entry in `persist.ts` this endpoint's data
  currently lives in. Once wired to the backend, that localStorage array becomes a cache/fallback
  or is removed entirely.
- Role column uses the `Designation` enum from `models.ts`. "Any authenticated" means any active
  employee, portal-checked client-side today, should be role-checked server-side.

---

## 1. Auth & Employees

Source: `AuthContext.tsx`. Today "login" is username-only, no password — this is a demo shortcut
that must not ship as-is; flag this back to the team before building the real endpoint.

| # | Endpoint | Method | Request | Response | Auth/Role | Replaces localStorage key |
|---|----------|--------|---------|----------|-----------|---------------------------|
| 1.1 | `/auth/login` | POST | `{ username: string, password: string }` (frontend today only sends `username`) | `{ token, employee: Employee }` or `401 { error }` | Public | `ssc-erp-session` (holds `employee.id`) |
| 1.2 | `/auth/logout` | POST | — | `204` | Any authenticated | `ssc-erp-session` (cleared) |
| 1.3 | `/auth/me` | GET | — | `Employee` (session restore on app load) | Any authenticated | `ssc-erp-session` |
| 1.4 | `/employees` | GET | Query: `?department=&designation=&status=` | `Employee[]` | Any authenticated | `essolar:v1:employees` |
| 1.5 | `/employees` | POST | `Omit<Employee, 'id'\|'employeeCode'\|'avatarColor'>` (see `Employee` shape below) | `201 Employee` | `CEO` only | `essolar:v1:employees` |
| 1.6 | `/employees/:id` | PATCH | `Partial<Employee>` (e.g. status change to Suspended/Relieved) | `Employee` | `CEO` only | `essolar:v1:employees` |

**`Employee` shape** (`models.ts`):
```
{ id, employeeCode, name, mobile, email, joiningDate, department: Department,
  designation: Designation, username, employmentStatus: 'Active'|'On Leave'|'Suspended'|'Relieved',
  avatarColor, location? }
```
`Designation` → portal mapping (client-side today in `portalFor()`, should be enforced server-side
on every route below): CEO→CEO, Telecaller/Direct Marketing Executive→Marketing, Site Visitor→Site
Visit, Partner / Payment Receiver→Partner, Accountant→Accountant, Project Head→Project Head,
Warehouse Maintenance→Warehouse, Driver→Transport, Field Technician→Field Technician,
Document Follow-up Executive→Document Follow-up.

---

## 2. Leads & Call Logs (Marketing / Telecalling)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 2.1 | `/leads` | GET | `?status=&assignedEmployeeId=` | `Lead[]` | Telecaller, Direct Marketing Executive, CEO | `essolar:v1:leads` |
| 2.2 | `/leads` | POST | `Omit<Lead,'id'>` | `201 Lead` | Telecaller, Direct Marketing Executive, CEO | `essolar:v1:leads` |
| 2.3 | `/leads/:id/status` | PATCH | `{ status: LeadStatus, lostReason?, lostReasonDetail?, remarks? }` | `Lead` | same | `essolar:v1:leads` |
| 2.4 | `/leads/:id/reassign` | PATCH | `{ employeeId: string }` | `Lead` | CEO, Project Head | `essolar:v1:leads` |
| 2.5 | `/call-logs` | GET | `?leadId=` | `CallLogEntry[]` | Telecaller, CEO | `essolar:v1:callLogs` |
| 2.6 | `/call-logs` | POST | `Omit<CallLogEntry,'id'>` (`leadId, date, time, calledBy, outcome, notes, nextFollowUpDate?`) | `201 CallLogEntry` | Telecaller | `essolar:v1:callLogs` |

`LeadStatus`: New, Contacted, Interested, Follow-up, Site Visit Required, Site Visit Scheduled,
Quotation Stage, Lost, Converted. `LostReason`: Price, Product Unavailable, Company Cannot Provide
Requirement, Customer Postponed, Competitor, Not Interested, Technical Infeasibility, Other.

---

## 3. Quotations

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 3.1 | `/quotations` | GET | `?leadId=&status=` | `Quotation[]` | Marketing, Accountant, Project Head, CEO | `essolar:v1:quotations` |
| 3.2 | `/quotations` | POST | `Omit<Quotation,'id'\|'quotationNumber'\|'revisionNumber'>` | `201 Quotation` (server assigns `quotationNumber`, format `SSC-QT-2026-####`) | Marketing, CEO | `essolar:v1:quotations` |
| 3.3 | `/quotations/:id/revise` | POST | `{ updates: Partial<Quotation>, reason: string }` | `201 Quotation` (new row, `previousQuotationId` set to original; original is never overwritten) | Marketing, CEO | `essolar:v1:quotations` |
| 3.4 | `/quotations/:id/status` | PATCH | `{ status: QuotationStatus, customerRejectionReason? }` | `Quotation` | Marketing, Accountant, CEO | `essolar:v1:quotations` |

`QuotationStatus`: Draft, Submitted, Sent, Customer Review, Revision Required, Customer Approved,
Customer Rejected, Awaiting Advance, Expired.

---

## 4. Field Movements (shared: live-location simulation for Marketing/Site Visit/Transport)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 4.1 | `/field-movements` | GET | `?employeeId=` | `FieldMovement[]` | Any authenticated | `essolar:v1:fieldMovements` |
| 4.2 | `/field-movements` | POST | `Omit<FieldMovement,'id'\|'routeHistory'\|'photos'\|'visitNotes'>` | `201 FieldMovement` | Direct Marketing Executive, Site Visitor, Driver | `essolar:v1:fieldMovements` |
| 4.3 | `/field-movements/:id` | PATCH | `{ location?, note?, photo?, status? }` (appends to `routeHistory`/`photos`/`visitNotes` server-side) | `FieldMovement` | same | `essolar:v1:fieldMovements` |

---

## 5. Site Visits

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 5.1 | `/site-visits` | GET | `?leadId=&status=&employeeId=` | `SiteVisit[]` | Site Visitor, CEO, Project Head | `essolar:v1:siteVisits` |
| 5.2 | `/site-visits` | POST | `Omit<SiteVisit,'id'\|'status'\|'sitePhotos'\|'siteVideos'\|'measurementImages'\|'documents'>` | `201 SiteVisit` (status defaults `Upcoming`) | Site Visitor, CEO | `essolar:v1:siteVisits` |
| 5.3 | `/site-visits/:id/start` | POST | — | `SiteVisit` (status → `In Progress`) | Site Visitor | `essolar:v1:siteVisits` |
| 5.4 | `/site-visits/:id/evidence` | POST | `{ photo?, video?, measurementImage?, document?, location?, note? }` (multipart if uploading files directly rather than data-URLs) | `SiteVisit` | Site Visitor | `essolar:v1:siteVisits` |
| 5.5 | `/site-visits/:id/complete` | POST | `{ feasibilityResult: FeasibilityResult, measurements?, roofGroundDetails?, rawMaterials?, cableAccessories?, installationArea?, notes?, rejectionReason?, rejectionRemarks? }` | `SiteVisit` (status → `Completed`/`Rejected`) | Site Visitor | `essolar:v1:siteVisits` |

`FeasibilityResult`: Feasible, Feasible with Conditions, Revisit Required, Not Feasible, Customer
Requirement Not Supported.

---

## 6. Payments (Accountant / Partner)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 6.1 | `/payments` | GET | `?projectId=&state=` | `Payment[]` | Accountant, Partner / Payment Receiver, CEO | `essolar:v1:payments` |
| 6.2 | `/payments` | POST | `Omit<Payment,'id'\|'state'\|'verifiedBy'>` | `201 Payment` (state defaults `Pending`) | Partner / Payment Receiver, Accountant | `essolar:v1:payments` |
| 6.3 | `/payments/:id/submit-for-verification` | POST | — | `Payment` (state → `Under Verification`) | Partner / Payment Receiver | `essolar:v1:payments` |
| 6.4 | `/payments/:id/verify` | POST | `{ verifiedAmount: number, remarks?: string }` | `Payment` (state → `Verified`, `verifiedBy` = caller) | Accountant | `essolar:v1:payments` |
| 6.5 | `/payments/:id/reject` | POST | `{ remarks: string }` | `Payment` (state → `Rejected`) | Accountant | `essolar:v1:payments` |
| 6.6 | `/payments/:id/partial` | POST | `{ verifiedAmount: number, remarks?, followUpDate? }` | `Payment` (state → `Partial`) | Accountant | `essolar:v1:payments` |
| 6.7 | `/payments/:id/follow-up` | PATCH | `{ followUpDate: string }` | `Payment` | Accountant | `essolar:v1:payments` |

Note: `verifiedBy` on 6.4/6.5/6.6 is currently passed in from the frontend as a plain string
(caller's name) — the backend should instead derive it from the authenticated session.

---

## 7. Projects & Project Issues (Project Head / CEO)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 7.1 | `/projects` | GET | `?status=&assignedTechnicianId=` | `Project[]` | Project Head, CEO, and cross-referenced by Warehouse/Transport/Technician/Document portals | `essolar:v1:projects` |
| 7.2 | `/projects/:id/assign-technician` | PATCH | `{ employeeId: string }` | `Project` | Project Head | `essolar:v1:projects` |
| 7.3 | `/projects/:id/assign-doc-employee` | PATCH | `{ employeeId: string }` | `Project` | Project Head | `essolar:v1:projects` |
| 7.4 | `/projects/:id/hold` | POST | `{ reason: string }` | `Project` (status → `On Hold`) | Project Head | `essolar:v1:projects` |
| 7.5 | `/projects/:id/resume` | POST | — | `Project` | Project Head | `essolar:v1:projects` |
| 7.6 | `/projects/:id/escalate` | POST | `{ note: string }` | `Project` (`escalated: true`) | Project Head | `essolar:v1:projects` |
| 7.7 | `/projects/:id/instructions` | POST | `{ note: string, by: string }` | `Project` (appends to `instructionNotes[]`) | Project Head | `essolar:v1:projects` |
| 7.8 | `/project-issues` | GET | `?projectId=&status=` | `ProjectIssue[]` | Project Head, CEO | `essolar:v1:projectIssues` |
| 7.9 | `/project-issues` | POST | `Omit<ProjectIssue,'id'\|'status'>` | `201 ProjectIssue` (status defaults `Open`) | Project Head, Field Technician | `essolar:v1:projectIssues` |
| 7.10 | `/project-issues/:id/resolve` | POST | `{ resolutionNotes: string }` | `ProjectIssue` (status → `Resolved`) | Project Head | `essolar:v1:projectIssues` |

`Project` also carries computed/rollup fields (`warehouseStatus`, `ebStatus`, `installationStatus`,
`currentStage`, `documentsCompleted`, `reviewCompleted`) that today get mutated as a side effect
of actions in *other* modules (stock, EB, technician). The backend should decide whether these stay
denormalized on `projects` (updated transactionally alongside the source action) or become a
computed view — the frontend currently expects them present directly on the `Project` object.

---

## 8. Warehouse (Stock Items, Movements, Allocations, Stock Requests)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 8.1 | `/stock-items` | GET | `?category=` | `StockItem[]` | Warehouse Maintenance, CEO | `essolar:v1:stockItems` |
| 8.2 | `/stock-items` | POST | `Omit<StockItem,'id'\|'currentQuantity'\|'reservedQuantity'\|'availableQuantity'> & { openingQuantity: number }` | `201 StockItem` | Warehouse Maintenance | `essolar:v1:stockItems` |
| 8.3 | `/stock-items/:id/receive` | POST | `{ quantity: number, supplier?, notes? }` | `StockItem` + `201 StockMovement` (type `Receipt`) | Warehouse Maintenance | `essolar:v1:stockItems`, `essolar:v1:stockMovements` |
| 8.4 | `/stock-items/:id/adjust` | POST | `{ type: 'Adjustment'\|'Damage'\|'Missing', quantity: number, notes? }` | `StockItem` + `201 StockMovement` | Warehouse Maintenance | same |
| 8.5 | `/stock-items/:id/transfer` | POST | `{ quantity: number, notes? }` | `StockItem` + `201 StockMovement` (type `Transfer`) | Warehouse Maintenance | same |
| 8.6 | `/stock-items/:id/return-material` | POST | `{ projectId: string, quantity: number, notes? }` | `ProjectAllocation` (increments `returnedQuantity`) + `201 StockMovement` (type `Return`) | Warehouse Maintenance | `essolar:v1:projectAllocations`, `essolar:v1:stockMovements` |
| 8.7 | `/stock-movements` | GET | `?itemId=&projectId=&type=` | `StockMovement[]` | Warehouse Maintenance, CEO | `essolar:v1:stockMovements` |
| 8.8 | `/project-allocations` | GET | `?projectId=` | `ProjectAllocation[]` | Warehouse Maintenance, Project Head, CEO | `essolar:v1:projectAllocations` |
| 8.9 | `/stock-requests` | GET | `?projectId=&status=` | `StockRequest[]` | Warehouse Maintenance, Project Head, CEO | `essolar:v1:stockRequests` |
| 8.10 | `/stock-requests` | POST | `Omit<StockRequest,'id'\|'status'>` | `201 StockRequest` (status defaults `Requested`) | Project Head | `essolar:v1:stockRequests` |
| 8.11 | `/stock-requests/:id/reserve` | POST | — | `StockRequest` (status → `Reserved`) | Warehouse Maintenance | `essolar:v1:stockRequests` |
| 8.12 | `/stock-requests/:id/issue` | POST | — | `StockRequest` (status → `Issued`) | Warehouse Maintenance | `essolar:v1:stockRequests` |
| 8.13 | `/stock-requests/shortage` | POST | `Omit<StockRequest,'id'\|'status'>` | `201 StockRequest` (status `Shortage Flagged`) | Warehouse Maintenance | `essolar:v1:stockRequests` |

`currentQuantity`/`reservedQuantity`/`availableQuantity` on `StockItem` are derived server-side from
movements + reservations — the frontend only ever reads them, it never sets them directly except at
creation (`openingQuantity`).

---

## 9. Transport / Deliveries (Driver)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 9.1 | `/deliveries` | GET | `?assignedDriverId=&status=` | `Delivery[]` | Driver, CEO | `essolar:v1:deliveries` |
| 9.2 | `/deliveries/:id/start-trip` | POST | — | `Delivery` (status → `Trip Started`) | Driver | `essolar:v1:deliveries` |
| 9.3 | `/deliveries/:id/location` | PATCH | `{ location: string }` | `Delivery` (status → `On Route`) | Driver | `essolar:v1:deliveries` |
| 9.4 | `/deliveries/:id/arrival` | POST | — | `Delivery` (status → `Arrived`) | Driver | `essolar:v1:deliveries` |
| 9.5 | `/deliveries/:id/pickup-photo` | POST | `{ photo: string }` (or multipart file) | `Delivery` | Driver | `essolar:v1:deliveries` |
| 9.6 | `/deliveries/:id/delivery-photo` | POST | `{ photo: string }` | `Delivery` | Driver | `essolar:v1:deliveries` |
| 9.7 | `/deliveries/:id/confirm` | POST | `{ receivedBy: string, notes?: string }` | `Delivery` (status → `Delivered`) | Driver | `essolar:v1:deliveries` |
| 9.8 | `/deliveries/:id/start-return` | POST | — | `Delivery` (status → `Returning`) | Driver | `essolar:v1:deliveries` |
| 9.9 | `/deliveries/:id/returned-material` | POST | `{ photo: string, notes?: string }` | `Delivery` | Driver | `essolar:v1:deliveries` |
| 9.10 | `/deliveries/:id/end-trip` | POST | — | `Delivery` (status → `Completed`) | Driver | `essolar:v1:deliveries` |

---

## 10. Field Technician (Work Logs, Installation, Final Verification, Customer Review)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 10.1 | `/field-work-logs` | GET | `?projectId=&technicianId=` | `FieldWorkLog[]` | Field Technician, Project Head, CEO | `essolar:v1:fieldWorkLogs` |
| 10.2 | `/field-work-logs/start` | POST | `{ projectId, technicianId, toolsTaken: string[], materialsTaken: string[], startingPhoto: string }` | `201 FieldWorkLog` | Field Technician | `essolar:v1:fieldWorkLogs` |
| 10.3 | `/field-work-logs/:id/updates` | POST | `Omit<WorkUpdate,'time'>` (`status, photos, materialsUsed?, remarks?, problems?`) | `FieldWorkLog` (appends to `updates[]`) | Field Technician | `essolar:v1:fieldWorkLogs` |
| 10.4 | `/field-work-logs/:id/end-of-day` | POST | `Omit<EndOfDayReport,'submittedOn'>` | `FieldWorkLog` | Field Technician | `essolar:v1:fieldWorkLogs` |
| 10.5 | `/installation-completions` | POST | `{ projectId, technicianId, materialsConsumed, unusedMaterials?, photos: string[], videos: string[], finalRemarks?, unusedItemId?, unusedQuantity? }` | `201 InstallationCompletion` (also updates `Project.installationStatus`) | Field Technician | `essolar:v1:installationCompletions` |
| 10.6 | `/final-verifications` | POST | `Omit<FinalVerification,'id'\|'submittedOn'>` | `201 FinalVerification` | Field Technician | `essolar:v1:finalVerifications` |
| 10.7 | `/customer-reviews` | POST | `Omit<CustomerReview,'id'\|'submittedOn'>` | `201 CustomerReview` (also sets `Project.reviewCompleted=true`, `status='Completed'`) | Field Technician (captured on customer's behalf) | `essolar:v1:customerReviews` |

---

## 11. Document Follow-up (EB Applications)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 11.1 | `/eb-applications` | GET | `?projectId=&status=` | `EbApplication[]` | Document Follow-up Executive, CEO | `essolar:v1:ebApplications` |
| 11.2 | `/eb-applications/:id/document-submitted` | POST | `{ documentName: string, evidence?: string }` | `EbApplication` (also sets `Project.documentsCompleted=true` once all required docs submitted) | Document Follow-up Executive | `essolar:v1:ebApplications` |
| 11.3 | `/eb-applications/:id/submit` | POST | `{ applicationDate: string }` | `EbApplication` (`ebStatus` → `Application Submitted`) | Document Follow-up Executive | `essolar:v1:ebApplications` |
| 11.4 | `/eb-applications/:id/status` | PATCH | `{ status: EbApplicationStatus }` | `EbApplication` | Document Follow-up Executive | `essolar:v1:ebApplications` |
| 11.5 | `/follow-up-logs` | GET | `?ebApplicationId=` | `FollowUpLog[]` | Document Follow-up Executive | `essolar:v1:followUpLogs` |
| 11.6 | `/follow-up-logs` | POST | `{ ebApplicationId, nextContact?, customerResponse, governmentStatus, followUpRemarks? }` | `201 FollowUpLog` | Document Follow-up Executive | `essolar:v1:followUpLogs` |

`EbApplicationStatus`: Not Started, Documents Pending, Application Submitted, Inspection Scheduled,
Meter Installed, Connected.

---

## 12. Leave & Attendance (all departments)

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 12.1 | `/leave-requests` | GET | `?employeeId=&status=` | `LeaveRequest[]` | Any authenticated (own), CEO (all) | `essolar:v1:leaveRequests` |
| 12.2 | `/leave-requests` | POST | `{ employeeId, employeeName, leaveType: 'Casual'\|'Sick'\|'Emergency'\|'Unpaid', fromDate, toDate, reason, medicalCertificate? }` | `201 LeaveRequest` or `400 { error }` — server must enforce: Casual needs ≥3 days advance notice; Sick requires `medicalCertificate` | Any authenticated | `essolar:v1:leaveRequests` |
| 12.3 | `/leave-requests/:id/decide` | POST | `{ status: 'Approved'\|'Rejected', remarks?: string }` | `LeaveRequest` | CEO | `essolar:v1:leaveRequests` |
| 12.4 | `/attendance/check-in` | POST | `{ employeeId, employeeName, department, type: 'Office'\|'Field' }` | `AttendanceRecord` (upsert: one record per employee per day) | Any authenticated | `essolar:v1:attendanceRecords` |
| 12.5 | `/attendance/check-out` | POST | `{ employeeId: string }` | `AttendanceRecord` | Any authenticated | `essolar:v1:attendanceRecords` |

---

## 13. Demo/Admin

| # | Endpoint | Method | Request | Response | Role | Replaces key |
|---|----------|--------|---------|----------|------|--------------|
| 13.1 | `/admin/reset-demo-data` | POST | — | `204` | CEO only | Clears every `essolar:v1:*` key client-side; server equivalent should truncate/reseed all tables listed above |

This is the CEO "Reset demo data" button (`resetDemoData` in `AppStore.tsx`). Today it wipes every
`essolar:v1:` localStorage key and reloads, which re-seeds from `frontend/src/data/mockData.ts`. The
server-side equivalent needs an explicit reseed dataset/migration — this has **not** been decided yet.

---

## Open questions for the backend team

1. **Auth**: current `login()` is username-only (no password, no token). Needs a real auth flow —
   this doc assumes password + bearer token but that's a proposal, not a confirmed spec.
2. **File uploads**: every `photo`/`video`/`document`/`evidence` field is currently a raw data-URL
   string held in React state / localStorage. Decide whether the backend accepts data-URLs directly,
   or wants multipart upload + returns a URL/id instead — this changes several request shapes above
   (sections 5, 9, 10, 11).
3. **ID generation**: switch from client-generated sequential IDs (`l12`, `q4`, `at7`) to
   server-generated IDs. Frontend doesn't care about the format.
4. **Derived/rollup fields** (Section 7 note): decide whether `Project.warehouseStatus`,
   `ebStatus`, `installationStatus` etc. are updated transactionally by the source-of-truth action,
   or computed on read.
5. **Runtime verification not yet done** (see project status): the localStorage wiring this contract
   is based on has only been confirmed to compile, not been click-tested end-to-end. Recommend
   running the flows in the gap report (new employee → login → correct portal; CEO reset demo data;
   reload persistence) before treating this contract as final — a bug in the wiring could mean an
   endpoint here doesn't match what the UI actually calls.

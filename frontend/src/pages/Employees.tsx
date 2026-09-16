import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Employee, Department, Designation } from '../types/models'
import { Card, SectionHeading, Pill, Avatar } from '../components/shared/Primitives'
import { DataTable, type Column } from '../components/shared/DataTable'
import { Pagination } from '../components/shared/Pagination'
import { formatDate, formatINR } from '../lib/utils'
import { Plus, X, Edit2, Trash2 } from 'lucide-react'
import { employeesApi } from '../api/employees'
import { revenueApi, type EmployeeRevenueDetail } from '../api/revenue'
import { employeeFinancialsApi } from '../api/employeeFinancials'
import { ApiError } from '../api/client'

const DEPT_DESIGNATIONS: Record<Department, Designation[]> = {
  CEO: ['CEO'],
  Marketing: ['Telecaller', 'Direct Marketing Executive'],
  'Site Visit': ['Site Visitor'],
  Accounts: ['Accountant', 'Partner / Payment Receiver'],
  Project: ['Project Head', 'Field Technician', 'Document Follow-up Executive'],
  Warehouse: ['Stock Maintenance'],
  Transport: ['Driver'],
  Quotation: ['Quotation Manager'],
}

const DEPT_OPTIONS: Department[] = ['CEO', 'Marketing', 'Site Visit', 'Accounts', 'Project', 'Warehouse', 'Transport', 'Quotation']

const emptyForm = {
  name: '', mobile: '', email: '', joiningDate: '', department: 'Marketing' as Department,
  designation: 'Telecaller' as Designation, username: '', password: '',
  familyNumber: '', officeNumber: '', document1: '', document2: '', document3: ''
}

export default function Employees() {
  const { refreshEmployees } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('All Departments')
  const [showForm, setShowForm] = useState(false)
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [files, setFiles] = useState<{ document1: File | null, document2: File | null, document3: File | null }>({ document1: null, document2: null, document3: null })
  const [replaceFlags, setReplaceFlags] = useState({ document1: false, document2: false, document3: false })
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [viewMode, setViewMode] = useState<'revenue' | 'ctc'>('revenue')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const [selectedEmployeeRevenue, setSelectedEmployeeRevenue] = useState<EmployeeRevenueDetail | null>(null)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [revenueLoading, setRevenueLoading] = useState(false)
  const [revenueSummaryMap, setRevenueSummaryMap] = useState<Record<string, number>>({})

  const [ctcDataMap, setCtcDataMap] = useState<Record<string, any>>({})
  const [selectedEmployeeCtc, setSelectedEmployeeCtc] = useState<any>(null)
  const [showCtcModal, setShowCtcModal] = useState(false)
  const [ctcLoading, setCtcLoading] = useState(false)
  const [showDailyExpenses, setShowDailyExpenses] = useState(false)
  const [dailyExpenses, setDailyExpenses] = useState<any[]>([])
  const [dailyExpensesLoading, setDailyExpensesLoading] = useState(false)

  useEffect(() => {
    loadEmployees()
  }, [])

  async function loadEmployees() {
    try {
      const data = await employeesApi.getAll()
      setEmployees(data)
      loadFinancialData('revenue', selectedMonth)
    } catch (err) {
      console.error('Failed to load employees', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadFinancialData(mode: 'revenue' | 'ctc', month: string) {
    try {
      if (mode === 'revenue') {
        const revData = await revenueApi.getEmployeeSummary()
        const rMap: Record<string, number> = {}
        revData.forEach(r => rMap[r.employeeId] = r.totalRevenue)
        setRevenueSummaryMap(rMap)
      } else {
        const ctcData = await employeeFinancialsApi.getAll(month)
        const cMap: Record<string, any> = {}
        ctcData.forEach(c => cMap[c.employee_id] = { salary: c.salary, expenses: c.expenses })
        setCtcDataMap(cMap)
      }
    } catch (err) {
      console.error('Failed to load financial data', err)
    }
  }

  useEffect(() => {
    loadFinancialData(viewMode, selectedMonth)
  }, [viewMode, selectedMonth])

  const filtered = useMemo(
    () => employees.filter((e) => deptFilter === 'All Departments' || e.department === deptFilter),
    [employees, deptFilter],
  )
  const paginatedEmployees = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.mobile || !form.email || !form.joiningDate || !form.username) return
    if (!editEmployeeId && (!files.document1 || !files.document2 || !files.document3)) {
      setError('All three documents are mandatory for new employees.')
      return
    }

    try {
      let employeeIdToUpdate: string | null = null;
      if (editEmployeeId) {
        const updatePayload: any = {
          name: form.name,
          mobile: String(form.mobile),
          email: form.email,
          joiningDate: form.joiningDate,
          department: form.department,
          designation: form.designation,
          username: form.username,
          familyNumber: String(form.familyNumber),
          officeNumber: String(form.officeNumber),
        };
        if (form.password) {
          updatePayload.password = form.password;
        }
        
        const updatedEmployee = await employeesApi.update(editEmployeeId, updatePayload);
        employeeIdToUpdate = updatedEmployee.id;
        setEmployees(prev => prev.map(emp => emp.id === editEmployeeId ? updatedEmployee : emp));
        await refreshEmployees();
        setToast(`${updatedEmployee.name}'s details updated successfully.`);
      } else {
        const newEmployee = await employeesApi.create({
          name: form.name,
          mobile: String(form.mobile),
          email: form.email,
          joiningDate: form.joiningDate,
          department: form.department,
          designation: form.designation,
          username: form.username,
          employmentStatus: 'Active',
          password: form.password, 
          familyNumber: String(form.familyNumber),
          officeNumber: String(form.officeNumber),
        })
        employeeIdToUpdate = newEmployee.id;
        setEmployees(prev => [newEmployee, ...prev])
        await refreshEmployees();
        setToast(`${newEmployee.name} added to ${newEmployee.department} as ${newEmployee.designation}. They can sign in immediately.`)
      }

      if (employeeIdToUpdate) {
        if (files.document1) {
          const emp = await employeesApi.uploadDocument(employeeIdToUpdate, 'document_1', files.document1);
          setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
        }
        if (files.document2) {
          const emp = await employeesApi.uploadDocument(employeeIdToUpdate, 'document_2', files.document2);
          setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
        }
        if (files.document3) {
          const emp = await employeesApi.uploadDocument(employeeIdToUpdate, 'document_3', files.document3);
          setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
        }
      }

      setForm(emptyForm)
      setFiles({ document1: null, document2: null, document3: null })
      setReplaceFlags({ document1: false, document2: false, document3: false })
      setShowForm(false)
      setEditEmployeeId(null)
      setTimeout(() => setToast(''), 6000)
    } catch (err: any) {
      if (err instanceof ApiError) {
        const detail = err.data?.detail
        if (Array.isArray(detail)) {
          setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(', '))
        } else {
          setError(typeof detail === 'string' ? detail : 'Failed to create employee')
        }
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return
    try {
      await employeesApi.delete(id)
      setEmployees(prev => prev.filter(e => e.id !== id))
      await refreshEmployees()
      setToast(`${name} has been deleted.`)
      setTimeout(() => setToast(''), 6000)
    } catch (err: any) {
      if (err instanceof ApiError) {
        const detail = err.data?.detail
        setError(typeof detail === 'string' ? detail : 'Failed to delete employee')
      } else {
        setError('Failed to delete employee')
      }
    }
  }

  function openEditForm(emp: Employee) {
    setEditEmployeeId(emp.id)
    setForm({
      name: emp.name,
      mobile: emp.mobile,
      email: emp.email,
      joiningDate: emp.joiningDate,
      department: emp.department,
      designation: emp.designation,
      username: emp.username,
      password: '', // Leave password empty on edit
      familyNumber: emp.familyNumber || '',
      officeNumber: emp.officeNumber || '',
      document1: (emp as any).document_1 || emp.document1 || '',
      document2: (emp as any).document_2 || emp.document2 || '',
      document3: (emp as any).document_3 || emp.document3 || '',
    })
    setFiles({ document1: null, document2: null, document3: null })
    setReplaceFlags({ document1: false, document2: false, document3: false })
    setShowForm(true)
  }

  async function handleRowClick(emp: Employee) {
    if (viewMode === 'revenue') {
      setShowRevenueModal(true)
      setRevenueLoading(true)
      setSelectedEmployeeRevenue(null)
      try {
        const details = await revenueApi.getEmployeeDetails(emp.id)
        setSelectedEmployeeRevenue(details)
      } catch (err) {
        console.error(err)
      } finally {
        setRevenueLoading(false)
      }
    } else {
      if (emp.designation === 'CEO') return; // CEO does not have CTC
      setShowCtcModal(true)
      setCtcLoading(true)
      setShowDailyExpenses(false)
      setSelectedEmployeeCtc(null)
      try {
        const details = await employeeFinancialsApi.getByEmployeeId(emp.id, selectedMonth)
        if (details) {
          setSelectedEmployeeCtc({ ...details, employee: emp })
        } else {
          setSelectedEmployeeCtc({ salary: null, expenses: null, employee: emp })
        }
      } catch (err: any) {
        console.error(err)
        setSelectedEmployeeCtc({ salary: null, expenses: null, employee: emp })
      } finally {
        setCtcLoading(false)
      }
    }
  }

  const columns: Column<Employee>[] = [
    {
      header: 'Employee', cell: (e) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={e.name} color={e.avatarColor} />
          <div>
            <div className="font-medium text-text">{e.name}</div>
            <div className="text-xs text-text-dim">{e.employeeCode}</div>
          </div>
        </div>
      )
    },
    { header: 'Department', cell: (e) => e.department },
    { header: 'Designation', cell: (e) => <span className="text-text-dim">{e.designation}</span> },
    {
      header: 'Contact', cell: (e) => (
        <div className="text-xs">
          <div>{e.mobile}</div>
          <div className="text-text-dim">{e.email}</div>
        </div>
      )
    },
    { header: 'Joined', cell: (e) => <span className="text-text-dim">{formatDate(e.joiningDate)}</span> },
    { header: 'Status', cell: (e) => <Pill status={e.employmentStatus} /> },
    {
      header: viewMode === 'revenue' ? 'Revenue' : 'CTC',
      cell: (e) => {
        if (viewMode === 'revenue') {
          if (e.designation === 'Partner / Payment Receiver') {
            return <span className="font-medium text-text-dim">—</span>
          }
          return <span className="font-medium text-teal">{formatINR(revenueSummaryMap[e.id] || 0)}</span>
        } else {
          if (e.designation === 'CEO') {
            return <span className="font-medium text-text-dim">—</span>
          }
          const c = ctcDataMap[e.id]
          if (!c || (c.salary == null && c.expenses == null)) {
            return <span className="text-text-dim text-xs">Not configured</span>
          }
          return <span className="font-medium text-rose">{formatINR(Number(c.salary || 0) + Number(c.expenses || 0))}</span>
        }
      }
    },
    {
      header: 'Actions', cell: (row) => (
        <div className="flex gap-1.5">
          <button onClick={(ev) => { ev.stopPropagation(); openEditForm(row); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Edit">
            <Edit2 size={15} />
          </button>
          <button onClick={(ev) => { ev.stopPropagation(); handleDelete(row.id, row.name); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="CEO Only"
        title="Employees"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition"
          >
            <Plus size={15} /> Create Employee
          </button>
        }
      />

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-2.5 font-medium">{toast}</div>
      )}

      <Card className="p-3.5 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2.5 items-center flex-wrap">
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="bg-panel border border-border rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 shadow-xs transition">
            <option>All Departments</option>
            {DEPT_OPTIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
          {viewMode === 'ctc' && (
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="bg-panel border border-border rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 shadow-xs transition"
            />
          )}
          <div className="flex rounded-xl p-1 bg-panel-raised border border-border shadow-xs">
            <button
              onClick={() => setViewMode('revenue')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'revenue' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'}`}
            >
              Revenue
            </button>
            <button
              onClick={() => setViewMode('ctc')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${viewMode === 'ctc' ? 'bg-emerald-600 text-white shadow-xs' : 'text-text-dim hover:text-text'}`}
            >
              CTC
            </button>
          </div>
        </div>
        <span className="text-xs text-text-dim font-medium">{filtered.length} of {employees.length} employees</span>
      </Card>

      {loading ? (
        <div className="py-10 text-center text-sm text-text-dim">Loading employees...</div>
      ) : (
        <div className="flex flex-col drop-shadow-xs">
          <DataTable
            columns={columns}
            rows={paginatedEmployees}
            keyFn={(e) => e.id}
            onRowClick={handleRowClick}
            mobileCard={(e) => (
              <Card className="p-4 flex items-center gap-3">
                <Avatar name={e.name} color={e.avatarColor} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.name}</div>
                  <div className="text-xs text-text-dim truncate">{e.designation} · {e.department}</div>
                </div>
                <Pill status={e.employmentStatus} />
              </Card>
            )}
          />
          <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowForm(false)} />
          <Card className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-sun font-semibold">Only the CEO can create accounts</div>
                <h3 className="text-lg font-display font-semibold">{editEmployeeId ? 'Edit Employee' : 'New Employee'}</h3>
              </div>
              <button onClick={() => { setShowForm(false); setEditEmployeeId(null); setForm(emptyForm); setFiles({ document1: null, document2: null, document3: null }); setReplaceFlags({ document1: false, document2: false, document3: false }); }} className="text-text-dim hover:text-text"><X size={18} /></button>
            </div>

            {error && (
              <div className="mb-4 bg-rose/10 border border-rose/30 text-rose text-xs rounded-lg px-3 py-2">{error}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <Field label="Employee Name" required>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Dinesh Kumar" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mobile Number" required>
                  <input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })} maxLength={10} className="input" placeholder="98XXXXXXXX" />
                </Field>
                <Field label="Email" required>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="name@successsolar.in" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Joining Date" required>
                  <input required type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="input" />
                </Field>
                <Field label="Employment Status">
                  <input disabled value="Active" className="input opacity-60" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department" required>
                  <select
                    value={form.department}
                    onChange={(e) => {
                      const d = e.target.value as Department
                      setForm({ ...form, department: d, designation: DEPT_DESIGNATIONS[d][0] })
                    }}
                    className="input"
                  >
                    {DEPT_OPTIONS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Designation / Role" required>
                  <select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value as Designation })} className="input">
                    {DEPT_DESIGNATIONS[form.department].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username" required>
                  <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input" placeholder="dinesh.kumar" />
                </Field>
                <Field label="Temporary Password" required={!editEmployeeId}>
                  <input required={!editEmployeeId} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" placeholder={editEmployeeId ? "Leave blank to keep current" : "Set initial password"} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Family Number" required>
                  <input required value={form.familyNumber} onChange={(e) => setForm({ ...form, familyNumber: e.target.value.replace(/\D/g, '') })} maxLength={10} className="input" placeholder="Family contact" />
                </Field>
                <Field label="Office Number" required>
                  <input required value={form.officeNumber} onChange={(e) => setForm({ ...form, officeNumber: e.target.value.replace(/\D/g, '') })} maxLength={10} className="input" placeholder="Office extension" />
                </Field>
              </div>
              <div className="space-y-3">
                <Field label="Document 1" required={!editEmployeeId || replaceFlags.document1}>
                  {form.document1 && !replaceFlags.document1 ? (
                    <div className="flex flex-col gap-2 p-2.5 border border-border bg-panel-raised rounded-lg text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-dim">Existing: Document 1</span>
                        <div className="flex items-center gap-3">
                          <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/employees/${editEmployeeId}/documents/document_1?token=${localStorage.getItem('access_token')}`} target="_blank" rel="noreferrer" className="text-teal hover:underline font-medium">View</a>
                          <button type="button" onClick={() => setReplaceFlags({ ...replaceFlags, document1: true })} className="text-rose hover:underline font-medium">Replace</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <input type="file" required={!editEmployeeId || replaceFlags.document1} onChange={(e) => setFiles({ ...files, document1: e.target.files?.[0] || null })} className="input" accept="image/*,.pdf" />
                  )}
                </Field>
                <Field label="Document 2" required={!editEmployeeId || replaceFlags.document2}>
                  {form.document2 && !replaceFlags.document2 ? (
                    <div className="flex flex-col gap-2 p-2.5 border border-border bg-panel-raised rounded-lg text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-dim">Existing: Document 2</span>
                        <div className="flex items-center gap-3">
                          <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/employees/${editEmployeeId}/documents/document_2?token=${localStorage.getItem('access_token')}`} target="_blank" rel="noreferrer" className="text-teal hover:underline font-medium">View</a>
                          <button type="button" onClick={() => setReplaceFlags({ ...replaceFlags, document2: true })} className="text-rose hover:underline font-medium">Replace</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <input type="file" required={!editEmployeeId || replaceFlags.document2} onChange={(e) => setFiles({ ...files, document2: e.target.files?.[0] || null })} className="input" accept="image/*,.pdf" />
                  )}
                </Field>
                <Field label="Document 3" required={!editEmployeeId || replaceFlags.document3}>
                  {form.document3 && !replaceFlags.document3 ? (
                    <div className="flex flex-col gap-2 p-2.5 border border-border bg-panel-raised rounded-lg text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-dim">Existing: Document 3</span>
                        <div className="flex items-center gap-3">
                          <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/employees/${editEmployeeId}/documents/document_3?token=${localStorage.getItem('access_token')}`} target="_blank" rel="noreferrer" className="text-teal hover:underline font-medium">View</a>
                          <button type="button" onClick={() => setReplaceFlags({ ...replaceFlags, document3: true })} className="text-rose hover:underline font-medium">Replace</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <input type="file" required={!editEmployeeId || replaceFlags.document3} onChange={(e) => setFiles({ ...files, document3: e.target.files?.[0] || null })} className="input" accept="image/*,.pdf" />
                  )}
                </Field>
              </div>
              <p className="text-[11px] text-text-dim">The selected department and designation determine which portal this employee lands on after first login.</p>
              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button type="button" onClick={() => { setShowForm(false); setEditEmployeeId(null); setForm(emptyForm); setFiles({ document1: null, document2: null, document3: null }); setReplaceFlags({ document1: false, document2: false, document3: false }); }} className="px-4 py-2.5 rounded-xl text-xs font-medium text-text-dim hover:bg-slate-100 transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition">{editEmployeeId ? 'Save Changes' : 'Create Employee'}</button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {showRevenueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRevenueModal(false)} />
          <Card className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-0 flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-panel z-10">
              <h3 className="text-lg font-semibold">Employee Revenue Details</h3>
              <button onClick={() => setShowRevenueModal(false)} className="text-text-dim hover:text-text"><X size={18} /></button>
            </div>
            <div className="p-5">
              {revenueLoading ? (
                <div className="py-10 text-center text-sm text-text-dim">Loading revenue details...</div>
              ) : selectedEmployeeRevenue ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-end pb-4 border-b border-border">
                    <div>
                      <div className="text-xl font-bold">{selectedEmployeeRevenue.employeeName}</div>
                      <div className="text-sm text-text-dim">{selectedEmployeeRevenue.department} — {selectedEmployeeRevenue.designation}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-text-dim uppercase tracking-wider mb-1">Total Revenue</div>
                      <div className="text-2xl font-bold text-teal">{formatINR(selectedEmployeeRevenue.totalRevenue)}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-3">Project Breakdown</h4>
                    <div className="space-y-3">
                      {selectedEmployeeRevenue.projects.length === 0 ? (
                        <div className="text-center text-sm text-text-dim py-6 border border-dashed border-border rounded-lg">No revenue generating projects found.</div>
                      ) : (
                        selectedEmployeeRevenue.projects.map(p => (
                          <div key={p.invoiceId} className="flex justify-between items-center p-3 border border-border rounded-lg">
                            <div>
                              <div className="font-medium text-sm">{p.projectName}</div>
                              <div className="text-xs text-text-dim mt-0.5">Inv: {p.invoiceNumber} • {formatDate(p.invoiceDate)}</div>
                            </div>
                            <div className="font-semibold text-sm">{formatINR(p.revenue)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-rose">Failed to load revenue details.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {showCtcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCtcModal(false)} />
          <Card className="relative w-full max-w-sm p-0 flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-panel z-10">
              <h3 className="text-lg font-semibold">Employee CTC Details</h3>
              <button onClick={() => setShowCtcModal(false)} className="text-text-dim hover:text-text"><X size={18} /></button>
            </div>
            <div className="p-5">
              {ctcLoading ? (
                <div className="py-10 text-center text-sm text-text-dim">Loading CTC details...</div>
              ) : selectedEmployeeCtc ? (
                <div className="space-y-6">
                  <div>
                    <div className="text-xl font-bold">{selectedEmployeeCtc.employee.name}</div>
                    <div className="text-sm text-text-dim">{selectedEmployeeCtc.employee.employeeCode}</div>
                    <div className="text-sm text-text-dim mt-1">{selectedEmployeeCtc.employee.department} — {selectedEmployeeCtc.employee.designation}</div>
                    <div className="text-xs font-semibold text-sun mt-2 bg-sun/10 inline-block px-2 py-1 rounded">
                      Month: {selectedMonth}
                    </div>
                  </div>

                  {selectedEmployeeCtc.salary == null ? (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-dim">Salary:</span>
                        <span className="font-medium">Not configured</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-dim">Expenses:</span>
                        <span className="font-medium">Not configured</span>
                      </div>
                      <div className="flex justify-between pt-3 border-t border-border">
                        <span className="font-semibold text-text-dim">Total CTC:</span>
                        <span className="font-bold text-lg">Not configured</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-dim">Salary:</span>
                        <span className="font-medium">{formatINR(selectedEmployeeCtc.salary)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-dim">Expenses:</span>
                        <span className="font-medium">{formatINR(selectedEmployeeCtc.expenses)}</span>
                      </div>
                      <div className="flex justify-between pt-3 border-t border-border">
                        <span className="font-semibold text-text-dim">Total CTC:</span>
                        <span className="font-bold text-lg text-rose">
                          {formatINR(Number(selectedEmployeeCtc.salary) + Number(selectedEmployeeCtc.expenses))}
                        </span>
                      </div>
                      
                      {!showDailyExpenses ? (
                        <div className="mt-4 pt-4 border-t border-border">
                          <button 
                            onClick={async () => {
                              setShowDailyExpenses(true)
                              setDailyExpensesLoading(true)
                              try {
                                const exps = await employeeFinancialsApi.getDailyExpenses(selectedEmployeeCtc.employee.id, selectedMonth)
                                setDailyExpenses(exps)
                              } catch (err) {
                                console.error(err)
                              } finally {
                                setDailyExpensesLoading(false)
                              }
                            }}
                            className="w-full py-2 bg-panel-raised border border-border rounded-lg text-xs font-medium hover:bg-panel transition text-text-dim hover:text-text"
                          >
                            View Daily Expenses
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold">Daily Expenses Breakdown</h4>
                            <button onClick={() => setShowDailyExpenses(false)} className="text-xs text-text-dim hover:text-text">Hide</button>
                          </div>
                          
                          {dailyExpensesLoading ? (
                            <div className="text-xs text-center py-4 text-text-dim">Loading records...</div>
                          ) : dailyExpenses.length === 0 ? (
                            <div className="text-xs text-center py-4 text-text-dim border border-dashed border-border rounded-lg">No daily expenses recorded for this month.</div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {dailyExpenses.map((exp: any) => (
                                <div key={exp.id} className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-panel-raised">
                                  <div>
                                    <div className="text-xs font-medium">{exp.description}</div>
                                    <div className="text-[10px] text-text-dim flex items-center gap-2">
                                      {exp.expense_date}
                                      {exp.proof_url && (
                                        <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/employee-financials/expenses/${exp.id}/proof?token=${localStorage.getItem('access_token')}`} target="_blank" rel="noreferrer" className="text-teal hover:underline flex items-center gap-1">
                                          View Proof
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-sm font-semibold text-rose">{formatINR(exp.amount)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-rose">Failed to load CTC details.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: 0.75rem;
          padding: 0.55rem 0.85rem;
          font-size: 0.825rem;
          color: var(--color-text);
          outline: none;
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .input:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12);
        }
      `}</style>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-text-dim font-medium">{label}{required && <span className="text-rose"> *</span>}</span>
      {children}
    </label>
  )
}

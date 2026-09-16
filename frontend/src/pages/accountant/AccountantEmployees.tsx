import { useEffect, useMemo, useState } from 'react'
import type { Employee, Department, EmployeeDailyExpense } from '../../types/models'
import { Card, SectionHeading, Pill, Avatar } from '../../components/shared/Primitives'
import { DataTable, type Column } from '../../components/shared/DataTable'
import { Pagination } from '../../components/shared/Pagination'
import { employeesApi } from '../../api/employees'
import { employeeFinancialsApi } from '../../api/employeeFinancials'
import { formatINR } from '../../lib/utils'
import { X } from 'lucide-react'

const DEPT_OPTIONS: Department[] = ['CEO', 'Marketing', 'Site Visit', 'Accounts', 'Project', 'Warehouse', 'Transport']

export default function AccountantEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [ctcDataMap, setCtcDataMap] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('All Departments')

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ salary: '' })
  const [dailyExpenses, setDailyExpenses] = useState<EmployeeDailyExpense[]>([])
  const [expenseForm, setExpenseForm] = useState<{date: string, amount: string, description: string, proof: File | null}>({ date: '', amount: '', description: '', proof: null })
  const [saving, setSaving] = useState(false)
  const [expenseLoading, setExpenseLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  async function loadData() {
    setLoading(true)
    try {
      const emps = await employeesApi.getAll()
      setEmployees(emps.filter(e => e.designation !== 'CEO' && e.designation !== 'Partner / Payment Receiver'))

      const ctcData = await employeeFinancialsApi.getAll(selectedMonth)
      const cMap: Record<string, any> = {}
      ctcData.forEach(c => cMap[c.employee_id] = { salary: c.salary, expenses: c.expenses })
      setCtcDataMap(cMap)
    } catch (err) {
      console.error('Failed to load data', err)
      setError('Failed to load employee data')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(
    () => employees.filter((e) => deptFilter === 'All Departments' || e.department === deptFilter),
    [employees, deptFilter],
  )

  const [currentPage, setCurrentPage] = useState(1)
  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 25, currentPage * 25), [filtered, currentPage])

  async function handleRowClick(emp: Employee) {
    setSelectedEmp(emp)
    const existing = ctcDataMap[emp.id]
    if (existing) {
      setForm({ salary: existing.salary?.toString() || '' })
    } else {
      setForm({ salary: '' })
    }
    setExpenseForm({ date: '', amount: '', description: '', proof: null })
    setShowModal(true)
    
    setExpenseLoading(true)
    try {
      const expenses = await employeeFinancialsApi.getDailyExpenses(emp.id, selectedMonth)
      setDailyExpenses(expenses)
    } catch (err) {
      console.error(err)
      setDailyExpenses([])
    } finally {
      setExpenseLoading(false)
    }
  }

  async function handleSaveSalary(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEmp) return
    setError('')
    setSaving(true)

    const salary = Number(form.salary)

    try {
      if (ctcDataMap[selectedEmp.id]) {
        await employeeFinancialsApi.update(selectedEmp.id, { financial_month: selectedMonth, salary })
      } else {
        await employeeFinancialsApi.create({ employee_id: selectedEmp.id, financial_month: selectedMonth, salary })
      }
      
      setCtcDataMap(prev => ({
        ...prev,
        [selectedEmp.id]: { ...prev[selectedEmp.id], salary }
      }))
      
      setToast(`Salary saved for ${selectedEmp.name}`)
      setTimeout(() => setToast(''), 4000)
    } catch (err) {
      console.error(err)
      setError('Failed to save salary data')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEmp) return
    
    const amount = Number(expenseForm.amount)
    if (amount < 0) {
      setError('Expense amount cannot be negative')
      return
    }

    setSaving(true)
    try {
      const newExpense = await employeeFinancialsApi.createDailyExpense({
        employee_id: selectedEmp.id,
        expense_date: expenseForm.date,
        amount,
        description: expenseForm.description,
        proof: expenseForm.proof || undefined
      })
      
      setDailyExpenses(prev => [...prev, newExpense])
      setExpenseForm({ date: '', amount: '', description: '', proof: null })
      
      // Update local sum
      setCtcDataMap(prev => {
        const existing = prev[selectedEmp.id] || { salary: 0, expenses: 0 }
        return {
          ...prev,
          [selectedEmp.id]: { ...existing, expenses: Number(existing.expenses || 0) + amount }
        }
      })
    } catch (err) {
      console.error(err)
      setError('Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteExpense(expense: EmployeeDailyExpense) {
    if (!window.confirm('Delete this expense?')) return
    setSaving(true)
    try {
      await employeeFinancialsApi.deleteDailyExpense(expense.id)
      setDailyExpenses(prev => prev.filter(e => e.id !== expense.id))
      
      // Update local sum
      setCtcDataMap(prev => {
        const existing = prev[expense.employee_id] || { salary: 0, expenses: 0 }
        return {
          ...prev,
          [expense.employee_id]: { ...existing, expenses: Math.max(0, Number(existing.expenses || 0) - expense.amount) }
        }
      })
    } catch (err) {
      console.error(err)
      setError('Failed to delete expense')
    } finally {
      setSaving(false)
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
    { header: 'Status', cell: (e) => <Pill status={e.employmentStatus} /> },
    {
      header: 'Salary', cell: (e) => {
        const c = ctcDataMap[e.id]
        if (!c || c.salary == null) return <span className="text-text-dim text-xs">Not configured</span>
        return <span>{formatINR(c.salary)}</span>
      }
    },
    {
      header: 'Expenses', cell: (e) => {
        const c = ctcDataMap[e.id]
        if (!c || c.expenses == null) return <span className="text-text-dim text-xs">Not configured</span>
        return <span>{formatINR(c.expenses)}</span>
      }
    },
    {
      header: 'CTC', cell: (e) => {
        const c = ctcDataMap[e.id]
        if (!c || (c.salary == null && c.expenses == null)) return <span className="text-text-dim text-xs">Not configured</span>
        return <span className="font-medium text-rose">{formatINR(Number(c.salary || 0) + Number(c.expenses || 0))}</span>
      }
    },
  ]

  return (
    <div className="space-y-5">
      <SectionHeading
        eyebrow="Accountant Portal"
        title="Employee Financial Management"
      />

      {toast && (
        <div className="bg-teal/10 border border-teal/30 text-teal text-xs rounded-lg px-3 py-2">{toast}</div>
      )}

      {error && !showModal && (
        <div className="bg-rose/10 border border-rose/30 text-rose text-xs rounded-lg px-3 py-2">{error}</div>
      )}

      <Card className="p-3 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-3 items-center">
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="bg-panel-raised border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none">
            <option>All Departments</option>
            {DEPT_OPTIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
          
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="bg-panel-raised border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sun transition"
          />
        </div>
        <span className="text-xs text-text-dim">{filtered.length} of {employees.length} employees</span>
      </Card>

      {loading ? (
        <div className="py-10 text-center text-sm text-text-dim">Loading employees...</div>
      ) : (
        <div className="flex flex-col drop-shadow-xs">
          <DataTable
            columns={columns}
            rows={paginatedFiltered}
            keyFn={(e) => e.id}
            onRowClick={handleRowClick}
            mobileCard={(e) => {
              const c = ctcDataMap[e.id]
              return (
                <Card className="p-4 flex items-center gap-3">
                  <Avatar name={e.name} color={e.avatarColor} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.name}</div>
                    <div className="text-xs text-text-dim truncate">{e.designation} · {e.department}</div>
                    <div className="text-xs font-medium text-rose mt-1">
                      {c && c.salary != null ? `CTC: ${formatINR(Number(c.salary) + Number(c.expenses))}` : 'Not configured'}
                    </div>
                  </div>
                </Card>
              )
            }}
          />
          <Pagination currentPage={currentPage} totalItems={filtered.length} onPageChange={setCurrentPage} />
        </div>
      )}

      {showModal && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !saving && setShowModal(false)} />
          <Card className="relative w-full max-w-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-display font-semibold">Update Financials</h3>
                <div className="text-sm text-text-dim mt-0.5">{selectedEmp.name} — {selectedEmp.employeeCode}</div>
              </div>
              <button disabled={saving} onClick={() => setShowModal(false)} className="text-text-dim hover:text-text"><X size={18} /></button>
            </div>

            {error && (
              <div className="mb-4 bg-rose/10 border border-rose/30 text-rose text-xs rounded-lg px-3 py-2">{error}</div>
            )}

            <div className="max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleSaveSalary} className="space-y-4 mb-6 pb-6 border-b border-border">
                <label className="block space-y-1">
                  <span className="text-[11px] text-text-dim font-medium">Monthly Salary <span className="text-rose">*</span></span>
                  <div className="flex gap-2">
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.salary}
                      onChange={(e) => setForm({ ...form, salary: e.target.value })}
                      className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-sun transition"
                      placeholder="e.g. 35000"
                      disabled={saving}
                    />
                    <button type="submit" disabled={saving} className="whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition disabled:opacity-50">
                      Save Salary
                    </button>
                  </div>
                </label>
              </form>

              <div>
                <h4 className="text-sm font-semibold mb-3">Daily Expenses</h4>
                
                <form onSubmit={handleAddExpense} className="mb-4 bg-panel-raised p-3.5 rounded-xl border border-border space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-[11px] text-text-dim font-medium">Date <span className="text-rose">*</span></span>
                      <input
                        required
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                        className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-emerald-500 shadow-xs transition"
                        disabled={saving}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] text-text-dim font-medium">Amount <span className="text-rose">*</span></span>
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={expenseForm.amount}
                        onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-emerald-500 shadow-xs transition"
                        placeholder="e.g. 500"
                        disabled={saving}
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-text-dim font-medium">Category/Description <span className="text-rose">*</span></span>
                    <input
                      required
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-emerald-500 shadow-xs transition"
                      placeholder="e.g. Travel to site"
                      disabled={saving}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-text-dim font-medium">Proof Document (Optional)</span>
                    <input
                      type="file"
                      onChange={(e) => setExpenseForm({ ...expenseForm, proof: e.target.files?.[0] || null })}
                      className="w-full bg-panel border border-border rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-emerald-500 shadow-xs transition"
                      accept="image/*,.pdf"
                      disabled={saving}
                    />
                  </label>
                  <div className="flex justify-end">
                    <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition disabled:opacity-50">
                      Add Expense
                    </button>
                  </div>
                </form>

                {expenseLoading ? (
                  <div className="text-xs text-center py-4 text-text-dim">Loading expenses...</div>
                ) : dailyExpenses.length === 0 ? (
                  <div className="text-xs text-center py-4 text-text-dim border border-dashed border-border rounded-lg">No expenses recorded for this month.</div>
                ) : (
                  <div className="space-y-2">
                    {dailyExpenses.map(exp => (
                      <div key={exp.id} className="flex items-center justify-between p-2.5 border border-border rounded-lg bg-panel-raised">
                        <div>
                          <div className="text-xs font-medium">{exp.description}</div>
                          <div className="text-[10px] text-text-dim">{exp.expense_date}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-rose">{formatINR(exp.amount)}</span>
                          <button onClick={() => handleDeleteExpense(exp)} disabled={saving} className="text-text-dim hover:text-rose" title="Delete">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-dim">Monthly Salary:</span>
                  <span className="font-medium">{formatINR(Number(form.salary || 0))}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-dim">Total Expenses:</span>
                  <span className="font-medium text-rose">{formatINR(dailyExpenses.reduce((sum, e) => sum + Number(e.amount), 0))}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                  <span className="text-sm font-semibold text-text-dim">Total CTC:</span>
                  <span className="text-lg font-bold text-teal">
                    {formatINR(Number(form.salary || 0) + dailyExpenses.reduce((sum, e) => sum + Number(e.amount), 0))}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

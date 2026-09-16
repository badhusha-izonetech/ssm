import { fetchClient } from './client'
import type { EmployeeFinancial, EmployeeFinancialDetails, EmployeeDailyExpense } from '../types/models'

export const employeeFinancialsApi = {
  getAll: async (month: string): Promise<EmployeeFinancialDetails[]> => {
    return await fetchClient(`/employee-financials?month=${encodeURIComponent(month)}`)
  },

  getByEmployeeId: async (employeeId: string, month: string): Promise<EmployeeFinancial> => {
    return await fetchClient(`/employee-financials/${employeeId}?month=${encodeURIComponent(month)}`)
  },

  create: async (data: { employee_id: string; financial_month: string; salary: number }): Promise<EmployeeFinancial> => {
    return await fetchClient('/employee-financials', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  update: async (employeeId: string, data: { financial_month: string; salary: number }): Promise<EmployeeFinancial> => {
    return await fetchClient(`/employee-financials/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  getDailyExpenses: async (employeeId: string, month: string): Promise<EmployeeDailyExpense[]> => {
    return await fetchClient(`/employee-financials/${employeeId}/expenses?month=${encodeURIComponent(month)}`)
  },

  createDailyExpense: async (data: { employee_id: string; expense_date: string; amount: number; description: string; proof?: File }): Promise<EmployeeDailyExpense> => {
    const formData = new FormData()
    formData.append('employee_id', data.employee_id)
    formData.append('expense_date', data.expense_date)
    formData.append('amount', data.amount.toString())
    formData.append('description', data.description)
    if (data.proof) {
      formData.append('proof', data.proof)
    }
    
    return await fetchClient('/employee-financials/expenses', {
      method: 'POST',
      body: formData
    })
  },

  updateDailyExpense: async (expenseId: string, data: { expense_date: string; amount: number; description: string }): Promise<EmployeeDailyExpense> => {
    return await fetchClient(`/employee-financials/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },

  deleteDailyExpense: async (expenseId: string): Promise<void> => {
    return await fetchClient(`/employee-financials/expenses/${expenseId}`, {
      method: 'DELETE'
    })
  }
}

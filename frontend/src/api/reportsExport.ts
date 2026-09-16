import { API_BASE_URL } from './client'

async function downloadReport(endpoint: string, fromDate: string, toDate: string, filename: string) {
  const token = localStorage.getItem('access_token')
  if (!token) {
    throw new Error('No authentication token found')
  }

  const url = `${API_BASE_URL}${endpoint}?from_date=${fromDate}&to_date=${toDate}`
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to download report')
  }

  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
}

export const reportsExportApi = {
  downloadCtcReport: (fromDate: string, toDate: string) => 
    downloadReport('/reports/ctc/export', fromDate, toDate, `CEO_CTC_Report_${fromDate}_to_${toDate}.pdf`),
    
  downloadGstReport: (fromDate: string, toDate: string) => 
    downloadReport('/reports/gst/export', fromDate, toDate, `CEO_GST_Report_${fromDate}_to_${toDate}.pdf`),
    
  downloadRevenueReport: (fromDate: string, toDate: string) => 
    downloadReport('/reports/revenue/export', fromDate, toDate, `CEO_Revenue_Report_${fromDate}_to_${toDate}.pdf`),
    
  downloadEmployeeRevenueReport: (fromDate: string, toDate: string) => 
    downloadReport('/reports/employee-revenue/export', fromDate, toDate, `CEO_Employee_Revenue_Report_${fromDate}_to_${toDate}.pdf`),
    
  downloadStockReport: (fromDate: string, toDate: string) => 
    downloadReport('/reports/stock/export', fromDate, toDate, `CEO_Stock_Report_${fromDate}_to_${toDate}.pdf`),
    
  downloadExistingCustomerReport: (fromDate: string, toDate: string) => 
    downloadReport('/reports/existing-customers/export', fromDate, toDate, `CEO_Existing_Customers_Report_${fromDate}_to_${toDate}.pdf`),
}

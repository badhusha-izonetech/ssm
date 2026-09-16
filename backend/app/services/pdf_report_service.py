import io
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from app.models.employee import Employee
from app.models.employee_financial import EmployeeFinancial
from app.models.employee_daily_expense import EmployeeDailyExpense
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.employee_revenue import EmployeeRevenue
from app.models.stock_item import StockTransaction
from app.models.payment import Payment

def get_base_styles():
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    title_style.alignment = 1 # Center
    return styles, title_style

def create_table(data):
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    return table

async def generate_ctc_report(db: AsyncSession, from_date: date, to_date: date) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles, title_style = get_base_styles()
    elements = []
    
    elements.append(Paragraph(f"CTC Report ({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})", title_style))
    elements.append(Spacer(1, 12))
    
    stmt = select(Employee).order_by(Employee.name)
    result = await db.execute(stmt)
    employees = result.scalars().all()
    
    data = [["Emp ID", "Name", "Dept", "Designation", "Salary", "Total Expenses", "Total CTC"]]
    
    start_month = from_date.strftime("%Y-%m")
    end_month = to_date.strftime("%Y-%m")
    
    for emp in employees:
        sal_stmt = select(func.sum(EmployeeFinancial.salary)).where(
            EmployeeFinancial.employee_id == emp.id,
            EmployeeFinancial.financial_month >= start_month,
            EmployeeFinancial.financial_month <= end_month
        )
        sal_res = await db.execute(sal_stmt)
        total_salary = sal_res.scalar_one_or_none() or 0
        
        exp_stmt = select(func.sum(EmployeeDailyExpense.amount)).where(
            EmployeeDailyExpense.employee_id == emp.id,
            EmployeeDailyExpense.expense_date >= from_date,
            EmployeeDailyExpense.expense_date <= to_date
        )
        exp_res = await db.execute(exp_stmt)
        total_expenses = exp_res.scalar_one_or_none() or 0
        
        if total_salary > 0 or total_expenses > 0:
            total_ctc = total_salary + total_expenses
            data.append([
                emp.employee_code,
                emp.name,
                emp.department,
                emp.designation,
                f"Rs. {total_salary:,.2f}",
                f"Rs. {total_expenses:,.2f}",
                f"Rs. {total_ctc:,.2f}"
            ])
            
    if len(data) == 1:
        elements.append(Paragraph("No financial data found for the given date range.", styles['Normal']))
    else:
        elements.append(create_table(data))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer

async def generate_gst_report(db: AsyncSession, from_date: date, to_date: date) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles, title_style = get_base_styles()
    elements = []
    
    elements.append(Paragraph(f"GST Payable Report ({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})", title_style))
    elements.append(Spacer(1, 12))
    
    stmt = select(Invoice).where(
        Invoice.issue_date >= from_date.strftime('%Y-%m-%d'),
        Invoice.issue_date <= to_date.strftime('%Y-%m-%d'),
        Invoice.status != 'Cancelled'
    ).order_by(Invoice.issue_date)
    
    result = await db.execute(stmt)
    invoices = result.scalars().all()
    
    data = [["Inv Number", "Customer", "Date", "Taxable Amount", "GST Amount", "Total"]]
    
    total_taxable = 0
    total_gst = 0
    total_val = 0
    
    for inv in invoices:
        taxable = float(inv.taxable_amount or 0)
        gst_amt = float(inv.gst_amount or 0)
        total = float(inv.grand_total or 0)
        
        total_taxable += taxable
        total_gst += gst_amt
        total_val += total
        
        data.append([
            inv.invoice_number,
            inv.customer_name or "N/A",
            inv.issue_date or "N/A",
            f"Rs. {taxable:,.2f}",
            f"Rs. {gst_amt:,.2f}",
            f"Rs. {total:,.2f}"
        ])
        
    if len(data) == 1:
        elements.append(Paragraph("No invoices found for the given date range.", styles['Normal']))
    else:
        data.append([
            "TOTAL", "", "", f"Rs. {total_taxable:,.2f}", f"Rs. {total_gst:,.2f}", f"Rs. {total_val:,.2f}"
        ])
        elements.append(create_table(data))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer

async def generate_revenue_report(db: AsyncSession, from_date: date, to_date: date) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles, title_style = get_base_styles()
    elements = []
    
    elements.append(Paragraph(f"Revenue Report ({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})", title_style))
    elements.append(Spacer(1, 12))
    
    stmt = select(Payment).where(
        Payment.payment_date >= from_date.strftime('%Y-%m-%d'),
        Payment.payment_date <= to_date.strftime('%Y-%m-%d'),
        Payment.state == 'Verified'
    ).options(selectinload(Payment.project)).order_by(Payment.payment_date)
    
    result = await db.execute(stmt)
    payments = result.scalars().all()
    
    data = [["Date", "Project", "Payment Ref", "Amount"]]
    total_rev = 0
    
    for p in payments:
        amt = float(p.actual_amount or 0)
        total_rev += amt
        data.append([
            p.payment_date or "N/A",
            p.project.project_code if p.project else "N/A",
            p.transaction_reference or "N/A",
            f"Rs. {amt:,.2f}"
        ])
        
    if len(data) == 1:
        elements.append(Paragraph("No verified payments found for the given date range.", styles['Normal']))
    else:
        data.append(["TOTAL", "", "", f"Rs. {total_rev:,.2f}"])
        elements.append(create_table(data))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer

async def generate_employee_revenue_report(db: AsyncSession, from_date: date, to_date: date) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles, title_style = get_base_styles()
    elements = []
    
    elements.append(Paragraph(f"Employee Revenue Report ({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})", title_style))
    elements.append(Spacer(1, 12))
    
    stmt = select(EmployeeRevenue).join(Invoice).where(
        Invoice.issue_date >= from_date.strftime('%Y-%m-%d'),
        Invoice.issue_date <= to_date.strftime('%Y-%m-%d')
    ).options(selectinload(EmployeeRevenue.employee), selectinload(EmployeeRevenue.invoice)).order_by(Invoice.issue_date)
    
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    data = [["Emp Name", "Dept", "Designation", "Invoice No", "Date", "Revenue"]]
    total_rev = 0
    
    for r in records:
        if r.employee and r.employee.department == 'Accounts':
            continue
            
        rev_amt = float(r.revenue_amount or 0)
        total_rev += rev_amt
        data.append([
            r.employee.name if r.employee else "N/A",
            r.employee.department if r.employee else "N/A",
            r.employee.designation if r.employee else "N/A",
            r.invoice.invoice_number if r.invoice else "N/A",
            r.invoice.issue_date if r.invoice else "N/A",
            f"Rs. {rev_amt:,.2f}"
        ])
        
    if len(data) == 1:
        elements.append(Paragraph("No employee revenue found for the given date range.", styles['Normal']))
    else:
        data.append(["TOTAL", "", "", "", "", f"Rs. {total_rev:,.2f}"])
        elements.append(create_table(data))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer

async def generate_stock_report(db: AsyncSession, from_date: date, to_date: date) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles, title_style = get_base_styles()
    elements = []
    
    elements.append(Paragraph(f"Stock Report ({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})", title_style))
    elements.append(Spacer(1, 12))
    
    stmt = select(StockTransaction).where(
        func.date(StockTransaction.timestamp) >= from_date,
        func.date(StockTransaction.timestamp) <= to_date
    ).options(selectinload(StockTransaction.stock_item)).order_by(StockTransaction.timestamp)
    
    result = await db.execute(stmt)
    transactions = result.scalars().all()
    
    data = [["Date", "Product", "Model", "Type", "Quantity", "Reference"]]
    
    total_in = 0
    total_out = 0
    
    for t in transactions:
        qty = float(t.quantity or 0)
        # Note: Depending on 'Adjustment' it might be positive or negative, but we'll group standard INs/OUTs
        if t.transaction_type in ('Stock In', 'Return'):
            total_in += qty
        elif t.transaction_type in ('Stock Out', 'Issue'):
            total_out += qty
            
        data.append([
            t.timestamp.strftime('%Y-%m-%d') if t.timestamp else "N/A",
            t.stock_item.product_name if t.stock_item else "N/A",
            t.stock_item.model if t.stock_item and t.stock_item.model else "N/A",
            t.transaction_type or "N/A",
            f"{qty:,.3f}",
            t.reference or ""
        ])
        
    if len(data) == 1:
        elements.append(Paragraph("No stock transactions found for the given date range.", styles['Normal']))
    else:
        data.append(["TOTAL IN", f"{total_in:,.3f}", "TOTAL OUT", f"{total_out:,.3f}", "", ""])
        elements.append(create_table(data))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer

async def generate_existing_customers_report(db: AsyncSession, from_date: date, to_date: date) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    styles, title_style = get_base_styles()
    elements = []
    
    elements.append(Paragraph(f"Existing Customers Report ({from_date.strftime('%Y-%m-%d')} to {to_date.strftime('%Y-%m-%d')})", title_style))
    elements.append(Spacer(1, 12))
    
    stmt = select(Customer).where(
        func.date(Customer.created_at) >= from_date,
        func.date(Customer.created_at) <= to_date
    ).order_by(Customer.created_at)
    
    result = await db.execute(stmt)
    customers = result.scalars().all()
    
    data = [["Date", "Name", "Phone", "Email", "Type"]]
    
    for c in customers:
        data.append([
            c.created_at.strftime('%Y-%m-%d'),
            c.name,
            c.mobile,
            c.email or "N/A",
            c.customer_type
        ])
        
    if len(data) == 1:
        elements.append(Paragraph("No customers found for the given date range.", styles['Normal']))
    else:
        elements.append(create_table(data))
        
    doc.build(elements)
    buffer.seek(0)
    return buffer

# Trigger reload

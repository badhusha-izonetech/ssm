import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, date, timedelta
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.gst_period import GSTPeriod
from app.models.notification import Notification
from app.websocket.manager import manager
from app.websocket.events import WebSocketEvent, Events

logger = logging.getLogger(__name__)

async def check_gst_reminders():
    try:
        async with AsyncSessionLocal() as db:
            today = date.today()
            
            # The previous month's period
            first = today.replace(day=1)
            last_month = first - timedelta(days=1)
            period_month = last_month.strftime("%Y-%m")
            
            # Only trigger on 1st/2nd or first weekend (Saturday=5, Sunday=6)
            is_start_of_month = today.day in [1, 2]
            is_first_weekend = today.day <= 7 and today.weekday() >= 5
            
            if not is_start_of_month and not is_first_weekend:
                return

            result = await db.execute(select(GSTPeriod).where(GSTPeriod.period_month == period_month))
            period = result.scalar_one_or_none()
            
            if not period:
                # If no period is recorded yet, there might not be any GST payable, or it hasn't been fetched.
                return
                
            if period.is_paid:
                return
                
            # If start of month and initial reminder not sent
            if is_start_of_month and not period.initial_reminder_sent:
                notif = Notification(
                    title="GST PAYMENT REMINDER",
                    message=f"The GST payable of ₹{period.gst_payable:,.2f} for {period_month} is pending.\nInvoices: {period.total_invoices}\nTaxable Amount: ₹{period.taxable_amount:,.2f}",
                    department="Finance",
                    priority="High",
                    category="Payment"
                )
                db.add(notif)
                period.initial_reminder_sent = True
                await db.commit()
                await manager.send_to_authorized_users(WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if getattr(notif, "recipient_id", None) else set(), {notif.department} if getattr(notif, "department", None) else set(), set())
                logger.info(f"Generated initial GST reminder for {period_month}")
                
            # If first weekend and weekend reminder not sent
            if is_first_weekend and not period.weekend_reminder_sent:
                notif = Notification(
                    title="GST PAYMENT REMINDER",
                    message=f"Reminder: The GST payable of ₹{period.gst_payable:,.2f} for {period_month} is still unpaid.\nInvoices: {period.total_invoices}\nTaxable Amount: ₹{period.taxable_amount:,.2f}",
                    department="Finance",
                    priority="High",
                    category="Payment"
                )
                db.add(notif)
                period.weekend_reminder_sent = True
                await db.commit()
                await manager.send_to_authorized_users(WebSocketEvent.create(Events.NOTIFICATION_CREATED, "Notification", "Create", notif.id), {notif.recipient_id} if getattr(notif, "recipient_id", None) else set(), {notif.department} if getattr(notif, "department", None) else set(), set())
                logger.info(f"Generated weekend GST reminder for {period_month}")

    except Exception as e:
        logger.error(f"Error in check_gst_reminders: {e}")

def start_scheduler():
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    scheduler = AsyncIOScheduler()
    scheduler.add_job(check_gst_reminders, 'cron', hour=9, minute=0)
    scheduler.start()
    logger.debug("Scheduler started.")

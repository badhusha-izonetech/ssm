from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime, timezone

class WebSocketEvent(BaseModel):
    event: str
    module: str
    action: str
    entity_id: Optional[str] = None
    data: dict[str, Any] = {}
    timestamp: str

    @classmethod
    def create(
        cls, 
        event: str, 
        module: str, 
        action: str, 
        entity_id: Optional[str] = None, 
        data: Optional[dict[str, Any]] = None
    ) -> "WebSocketEvent":
        return cls(
            event=event,
            module=module,
            action=action,
            entity_id=entity_id,
            data=data or {},
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# Event Constants
class Events:
    LEAD_CREATED = "lead.created"
    LEAD_UPDATED = "lead.updated"
    LEAD_DELETED = "lead.deleted"
    
    PROJECT_CREATED = "project.created"
    PROJECT_UPDATED = "project.updated"
    PROJECT_DELETED = "project.deleted"
    
    PAYMENT_CREATED = "payment.created"
    PAYMENT_UPDATED = "payment.updated"
    
    QUOTATION_CREATED = "quotation.created"
    QUOTATION_UPDATED = "quotation.updated"
    
    INVOICE_CREATED = "invoice.created"
    INVOICE_UPDATED = "invoice.updated"
    
    PRODUCT_CREATED = "product.created"
    PRODUCT_UPDATED = "product.updated"
    
    STOCK_CREATED = "stock.created"
    STOCK_UPDATED = "stock.updated"
    
    STOCK_REQUEST_CREATED = "stock_request.created"
    STOCK_REQUEST_UPDATED = "stock_request.updated"
    
    SITE_VISIT_CREATED = "site_visit.created"
    SITE_VISIT_UPDATED = "site_visit.updated"
    
    APPROVAL_CREATED = "approval.created"
    APPROVAL_UPDATED = "approval.updated"
    
    ATTENDANCE_UPDATED = "attendance.updated"
    
    NOTIFICATION_CREATED = "notification.created"
    NOTIFICATION_UPDATED = "notification.updated"
    NOTIFICATION_READ = "notification.read"
    
    DASHBOARD_UPDATED = "dashboard.updated"

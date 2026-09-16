"""
Schemas for EB Applications.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class EbStageHistoryRead(BaseModel):
    id: str
    eb_application_id: str
    from_stage: Optional[str] = None
    to_stage: str
    changed_at: datetime
    changed_by_id: Optional[str] = None
    remarks: Optional[str] = None

    model_config = {"from_attributes": True}

class EbDocumentRead(BaseModel):
    id: str
    eb_application_id: str
    document_type: str
    file_url: str
    remarks: Optional[str] = None
    uploaded_by_id: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class EbApplicationRead(BaseModel):
    id: str
    project_id: str
    assigned_team: str
    assigned_by_id: Optional[str] = None
    assigned_at: datetime
    assigned_employee_id: Optional[str] = None
    
    current_stage: str
    
    verification_status: str
    verification_reason: Optional[str] = None
    verified_by_id: Optional[str] = None
    verification_date: Optional[datetime] = None
    
    portal_submission_status: str
    submitted_by_id: Optional[str] = None
    submission_date: Optional[datetime] = None
    portal_reference: Optional[str] = None
    portal_remarks: Optional[str] = None
    
    handover_status: str
    handed_over_by_id: Optional[str] = None
    handover_date: Optional[datetime] = None
    meter_supply_details: Optional[str] = None
    handover_remarks: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    
    # We might want some project details here for convenience, or we can fetch them separately
    project_code: Optional[str] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    project_details: Optional[str] = None
    
    documents: List[EbDocumentRead] = []

    model_config = {"from_attributes": True}


class EbVerificationUpdate(BaseModel):
    status: str  # "VERIFIED" or "NOT_VERIFIED"
    reason: Optional[str] = None

class EbPortalSubmission(BaseModel):
    reference_number: Optional[str] = None
    remarks: Optional[str] = None

class EbHandover(BaseModel):
    meter_supply_details: Optional[str] = None
    remarks: Optional[str] = None

class EbDashboardCounters(BaseModel):
    application_received: int
    documents_pending: int
    documents_not_verified: int
    documents_verified: int
    portal_submission_pending: int
    portal_submitted: int
    handover_pending: int
    completed: int

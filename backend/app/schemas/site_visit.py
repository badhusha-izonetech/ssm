from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator

# ── Site Visit Tracking & Locations ───────────────────────────────────────

class SiteVisitLocationCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: float
    captured_at: datetime


class SiteVisitLocationRead(SiteVisitLocationCreate):
    id: str
    site_visit_id: str
    employee_id: str
    distance_from_customer: Optional[float]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SiteVisitPhotoCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: float
    captured_at: datetime
    # The actual photo data will be a multipart upload, or data URL
    # So this schema might be used as a JSON payload, or fields in a Form


class SiteVisitPhotoRead(BaseModel):
    id: str
    site_visit_id: str
    employee_id: str
    file_path: str
    stage: Optional[str] = None
    latitude: float
    longitude: float
    accuracy: float
    distance_from_customer: float
    captured_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Site Visit Models ───────────────────────────────────────────────────

class SiteVisitCreate(BaseModel):
    lead_id: Optional[str] = None
    project_id: Optional[str] = None
    customer_name: str
    customer_mobile: str
    site_address: str = ""
    area: str = ""
    customer_latitude: Optional[float] = None
    customer_longitude: Optional[float] = None
    visit_date: str
    visit_time: str
    employee_id: str
    employee_name: str
    site_type: str
    system_type: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def coerce_none_strings(cls, values):
        """Coerce None to empty string for optional text fields that DB requires as non-null."""
        if isinstance(values, dict):
            for field in ('site_address', 'area', 'customer_mobile'):
                if values.get(field) is None:
                    if field in ('site_address', 'area'):
                        values[field] = ''
                else:
                    values[field] = str(values[field])
        return values


class SiteVisitRead(SiteVisitCreate):
    id: str
    status: str
    feasibility_result: Optional[str]
    rejection_reason: Optional[str]
    rejection_remarks: Optional[str]
    notes: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    submitted_at: Optional[datetime] = None
    created_at: datetime
    
    photos: List[SiteVisitPhotoRead] = []
    videos: Optional[List[str]] = []
    documents: Optional[List[str]] = []
    measurement_images: Optional[List[str]] = []
    completed_stages: List[str] = []
    
    # Site Details
    installation_area: Optional[str] = None
    measurements: Optional[str] = None
    roof_ground_details: Optional[str] = None
    raw_materials: Optional[str] = None
    raw_material_details: List[dict] = []
    cable_accessories: Optional[str] = None
    stock_availability_status: Optional[str] = None
    
    # Tool / Equipment photos
    tool_photo_before: Optional[str] = None
    tool_photo_after: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StartSiteVisitRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: float


class CompleteSiteVisitRequest(BaseModel):
    feasibility_result: Optional[str] = None
    rejection_reason: Optional[str] = None
    rejection_remarks: Optional[str] = None
    notes: Optional[str] = None
    
    installation_area: Optional[str] = None
    measurements: Optional[str] = None
    roof_ground_details: Optional[str] = None
    raw_materials: Optional[str] = None
    raw_material_details: Optional[List[dict]] = None
    cable_accessories: Optional[str] = None

class AddSiteVisitEvidenceRequest(BaseModel):
    photo: Optional[str] = None
    video: Optional[str] = None
    measurement_image: Optional[str] = None
    document: Optional[str] = None
    note: Optional[str] = None
    stage: Optional[str] = None
    stock_availability_status: Optional[str] = None


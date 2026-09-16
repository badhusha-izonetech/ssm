from pydantic import BaseModel
from typing import Optional

class AttendanceCheckIn(BaseModel):
    type: str

class AttendanceRecordRead(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    date: str
    check_in_time: Optional[str] = None
    check_out_time: Optional[str] = None
    status: str
    type: str

    model_config = {"from_attributes": True}

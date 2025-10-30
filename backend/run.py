from pydantic import BaseModel
from typing import List, Optional

class StudentPayload(BaseModel):
    student_id: str
    name: str
    pickup_time: str
    latitude: float
    longitude: float


class StopPayload(BaseModel):
    latitude: float
    longitude: float
    sequence_number: int
    students: List[StudentPayload]

class RoutePayload(BaseModel):
    bus_number: int
    total_students: int
    total_distance_km: float
    estimated_duration_hr: Optional[float] = None
    stops: List[StopPayload]
    map_path: Optional[str] = None

class RunPayload(BaseModel):
    name: str
    total_students_uploaded: int
    total_walkers: int
    total_bus_riders: int
    buses_needed: int
    overview: Optional[List[dict]] = None
    map_path: Optional[str] = None
    route_details: List[RoutePayload]


class FeedbackPayload(BaseModel):
    user_id: Optional[int] = None
    route_id: Optional[int] = None
    run_id: Optional[int] = None
    rating: Optional[str] = None
    options: Optional[List[str]] = None
    comment: Optional[str] = None

class LocationUpdate(BaseModel):
    bus_number: str
    latitude: float
    longitude: float

class AdminSignupRequest(BaseModel):
    email: str
    password: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str

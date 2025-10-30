from sqlalchemy import Column, Integer, String, Boolean, DECIMAL, Time, ForeignKey, DateTime, JSON, Float, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Student(Base):
    __tablename__ = "students"
    
    student_id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    home_latitude = Column(DECIMAL(10, 8), nullable=False)
    home_longitude = Column(DECIMAL(11, 8), nullable=False)
    is_walker = Column(Boolean, default=False)
    walking_distance_km = Column(DECIMAL(10, 2), nullable=True)  



    # Relationships
    feedback = relationship("Feedback", back_populates="student")
    assignments = relationship("StudentAssignment", back_populates="student", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True)
    email = Column(String(200), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    student_id = Column(String(50), ForeignKey("students.student_id"))
    
    # Relationship
    student = relationship("Student")


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"
    
    run_id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    name = Column(String(100))
    is_published = Column(Boolean, default=False)
    total_students_uploaded = Column(Integer)
    total_walkers = Column(Integer)
    total_bus_riders = Column(Integer)
    buses_needed = Column(Integer)
    overview_json = Column(JSON)
    map_path = Column(Text)
    
    # Relationships
    routes = relationship("Route", back_populates="run", cascade="all, delete-orphan")
    assignments = relationship("StudentAssignment", back_populates="run", cascade="all, delete-orphan")


class Route(Base):
    __tablename__ = "routes"
    
    route_id = Column(Integer, primary_key=True, autoincrement=True)
    bus_number = Column(Integer, nullable=False)
    total_students = Column(Integer, default=0)
    total_distance_km = Column(DECIMAL(10, 2))
    estimated_duration_hr = Column(Float)
    run_id = Column(Integer, ForeignKey("optimization_runs.run_id", ondelete="CASCADE"))
    map_path = Column(String, nullable=True)
    
    # Relationships
    run = relationship("OptimizationRun", back_populates="routes")
    stops = relationship("Stop", back_populates="route", cascade="all, delete-orphan")
    assignments = relationship("StudentAssignment", back_populates="route", cascade="all, delete-orphan")


class Stop(Base):
    __tablename__ = "stops"
    
    stop_id = Column(Integer, primary_key=True, autoincrement=True)
    latitude = Column(DECIMAL(10, 8), nullable=False)
    longitude = Column(DECIMAL(11, 8), nullable=False)
    address = Column(Text)
    sequence_number = Column(Integer, nullable=False)
    route_id = Column(Integer, ForeignKey("routes.route_id", ondelete="CASCADE"))
    
    # Relationships
    route = relationship("Route", back_populates="stops")
    assignments = relationship("StudentAssignment", back_populates="stop", cascade="all, delete-orphan")


class StudentAssignment(Base):

    __tablename__ = "student_assignments"
    
    assignment_id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=False)
    run_id = Column(Integer, ForeignKey("optimization_runs.run_id", ondelete="CASCADE"), nullable=False)
    route_id = Column(Integer, ForeignKey("routes.route_id", ondelete="CASCADE"), nullable=False)
    stop_id = Column(Integer, ForeignKey("stops.stop_id", ondelete="CASCADE"), nullable=False)
    pickup_time = Column(Time)
    
    __table_args__ = (
        UniqueConstraint('student_id', 'run_id', name='uq_student_run'),
    )
    
    # Relationships
    student = relationship("Student", back_populates="assignments")
    run = relationship("OptimizationRun", back_populates="assignments")
    route = relationship("Route", back_populates="assignments")
    stop = relationship("Stop", back_populates="assignments")


class Feedback(Base):
    __tablename__ = "feedback"
    
    feedback_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(String, ForeignKey("students.student_id"), nullable=True)  # Changed from user_id
    route_id = Column(Integer, ForeignKey("routes.route_id"), nullable=True)
    run_id = Column(Integer, ForeignKey("optimization_runs.run_id"), nullable=True)
    bus_number = Column(Integer, nullable=True)  
    rating = Column(String, nullable=True)
    options = Column(JSON, nullable=True)
    comment = Column(Text, nullable=True)
    stop = Column(String, nullable=True)
    boarding_time = Column(String, nullable=True)
    wait_time = Column(String, nullable=True)
    crowdedness = Column(String, nullable=True)
    extra_metadata = Column(JSON, nullable=True) 
    submitted_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    student = relationship("Student", back_populates="feedback")
    route = relationship("Route")
    run = relationship("OptimizationRun")

class BusLocation(Base):
    __tablename__ = "bus_locations"
    id = Column(Integer, primary_key=True, index=True)
    bus_number = Column(String, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)

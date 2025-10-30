'''
    - FastAPI application which handles API endpoints for Safe Miles's system.
    - Backend API
'''

import os
import io
import hashlib
import requests
from datetime import datetime
from typing import List, Dict
from dotenv import load_dotenv
import pandas as pd
from passlib.context import CryptContext
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Body,
    status
)
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db, SessionLocal
from db_models import (
    Student,
    Route,
    Stop,
    OptimizationRun,
    Feedback,
    Admin,
    StudentAssignment,
    User,
    BusLocation
)
from models.optimizer import full_optimization_pipeline
from run import RunPayload, AdminLoginRequest, LocationUpdate, AdminSignupRequest
import re

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Adjust as needed for frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory="assets"), name="assets")

def normalize_csv_columns(df):
    column_mapping = {}
    
    for col in df.columns:
        col_lower = col.lower().strip()
        
        # Student ID variations
        if col_lower in ['studentid', 'student_id', 'id', 'student id']:
            column_mapping[col] = 'StudentID'
        
        # Name variations
        elif col_lower in ['name', 'student_name', 'studentname', 'student name', 'full_name', 'fullname']:
            column_mapping[col] = 'Name'
        
        # Latitude variations
        elif col_lower in ['latitude', 'lat', 'y']:
            column_mapping[col] = 'Latitude'
        
        # Longitude variations
        elif col_lower in ['longitude', 'long', 'lon', 'lng', 'x']:
            column_mapping[col] = 'Longitude'
    
    if column_mapping:
        df = df.rename(columns=column_mapping)
    
    # Verifies required columns exist
    required = ['StudentID', 'Name', 'Latitude', 'Longitude']
    missing = [col for col in required if col not in df.columns]
    
    if missing:
        # Tries to find & report actual column names
        raise ValueError(f"CSV must have columns: {required}. Found: {df.columns.tolist()}")
    
    return df

# Accepts CSV of students, normalizes columns, runs optimization pipeline, & stores walkers & bus riders
@app.post("/upload_csv")
async def upload_csv(file: UploadFile = File(...), num_bus: int = Form(60), bus_capacity: int = Form(45), db: Session = Depends(get_db)):
    try:
    
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        
        # Normalizes column names
        df = normalize_csv_columns(df)

        # Drops rows with missing data
        initial_count = len(df)
        df.dropna(inplace=True)
        dropped_count = initial_count - len(df)
        if dropped_count > 0:
            print(f"Dropped {dropped_count} rows with missing data")

        num_bus = int(num_bus)
        bus_capacity = int(bus_capacity)

        # Runs pipeline
        results = full_optimization_pipeline(
            df=df,
            school_coords=(40.496296, -74.654846),
            bus_capacity=bus_capacity,
            num_bus=num_bus,
            safe_walk_miles=1.5,
            generate_map=True,
            precompute=True
        )

        # Stores all students (walkers + bus riders)
        stored_walkers = 0
        stored_riders = 0
        
        if 'df_with_analysis' in results:
            df_analyzed = results['df_with_analysis']
            
            for _, row in df_analyzed.iterrows():
                student_id = str(row['StudentID'])
                name = str(row['Name'])
                latitude = float(row['Latitude'])
                longitude = float(row['Longitude'])
                needs_bus = bool(row['needs_bus'])
                distance_to_school = float(row.get('distance_to_school_km', 0))
                
                # Checks if student exists
                db_student = db.query(Student).filter_by(student_id=student_id).first()
                
                if db_student:
                    db_student.name = name
                    db_student.home_latitude = latitude
                    db_student.home_longitude = longitude
                    db_student.is_walker = not needs_bus  
                    db_student.walking_distance_km = distance_to_school 
                else:
                    db_student = Student(
                        student_id=student_id,
                        name=name,
                        home_latitude=latitude,
                        home_longitude=longitude,
                        is_walker=not needs_bus, 
                        walking_distance_km=distance_to_school 
                    )
                    db.add(db_student)
                
                if needs_bus:
                    stored_riders += 1
                else:
                    stored_walkers += 1
                    
            db.commit()
        else:
            print("WARNING: df_with_analysis not found in results.")

        return {
            "filename": file.filename,
            "num_rows": len(df),
            "num_buses": results.get("num_bus", 0),
            "bus_loads": results.get("bus_loads", []),
            "overview": results.get("overview", []),
            "route_details": results.get("route_details", []),
            "map_path": results.get("map_path"),
            "walkers_stored": stored_walkers,
            "riders_stored": stored_riders
        }

    except Exception as e:
        db.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"ERROR in upload_csv: {str(e)}")
        print(error_details)
        return {"error": str(e), "details": error_details}

# Returns the student's current bus assignment & stop info for the published run (or indicates it's a walker)
@app.get("/student/{student_id}")
def get_student_route(student_id: str, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Gets published run
    published_run = db.query(OptimizationRun).filter_by(is_published=True).first()
    if not published_run:
        return {
            "student_id": student.student_id,
            "name": student.name,
            "bus_number": None,
            "pickup_time": None,
            "stop_location": None,
            "route_map_path": None,
            "message": "No published route plan available"
        }
    
    # Gets student's assignment for published run
    assignment = db.query(StudentAssignment).filter_by(
        student_id=student_id,
        run_id=published_run.run_id
    ).first()
    
    if not assignment:
        return {
            "student_id": student.student_id,
            "name": student.name,
            "bus_number": None,
            "pickup_time": None,
            "stop_location": None,
            "route_map_path": None,
            "message": "Student is a walker (no bus assignment)"
        }
    
    return {
        "student_id": student.student_id,
        "name": student.name,
        "bus_number": assignment.route.bus_number,
        "pickup_time": assignment.pickup_time.isoformat() if assignment.pickup_time else None,
        "stop_location": {
            "latitude": float(assignment.stop.latitude),
            "longitude": float(assignment.stop.longitude),
            "address": assignment.stop.address
        },
        "route_map_path": assignment.route.map_path
    }

    try:
        # This will try to create a database session
        db = next(get_db())
        db.close()
        return {"status": "Database connection successful"}
    except Exception as e:
        return {"status": "Database connection failed", "error": str(e)}
    
def get_address_from_coordinates(lat, lon, api):
    try:
        # Uses Google Geocoding API to get address from lat/lon
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lon}&key={api}"
       
        response = requests.get(url, timeout=5)
        data = response.json()
        
    
        if data["status"] == "OK":
            address = data["results"][0]["formatted_address"]
            return address
        elif data["status"] == "OVER_QUERY_LIMIT":
            print("Google API rate limit exceeded!")
            return "Address unavailable (rate limit)"
        elif data["status"] == "REQUEST_DENIED":
            print(f"API request denied: {data.get('error_message', 'No error message')}")
            return "Address unavailable (API denied)"
        else:
            print(f"Geocoding failed with status: {data['status']}")
            return f"Address unavailable ({data['status']})"
    except Exception as e:
        print(f"Geocoding error: {str(e)}")
        return "Address unavailable (error)"

# Saves completed optimization run, including routes, stops, & student assignments
@app.post("/save_run")
def save_run(run_data: RunPayload, db: Session = Depends(get_db)):
    try:
       
        # Checks first route
        if run_data.route_details:
            first_route = run_data.route_details[0]
        else:
            print("NO ROUTE DETAILS IN PAYLOAD")
        

        
        # Saves the run
        new_run = OptimizationRun(
            timestamp=datetime.utcnow(),
            is_published=False,
            total_students_uploaded=run_data.total_students_uploaded,
            total_walkers=run_data.total_walkers,
            total_bus_riders=run_data.total_bus_riders,
            buses_needed=run_data.buses_needed,
            name=run_data.name,
            overview_json=run_data.overview if hasattr(run_data, "overview") else None,
            map_path=run_data.map_path if hasattr(run_data, "map_path") else None
        )
        db.add(new_run)
        db.commit()
        db.refresh(new_run)

        student_count = 0
        
        # Saves routes
        for route_idx, route in enumerate(run_data.route_details):
            
            db_route = Route(
                run_id=new_run.run_id,
                bus_number=route.bus_number,
                total_students=route.total_students,
                total_distance_km=route.total_distance_km,
                estimated_duration_hr=route.estimated_duration_hr,
                map_path=getattr(route, "map_path", None)
            )
            db.add(db_route)
            db.flush()
         

            # Saves stops
            for stop_idx, stop in enumerate(route.stops):
                
                address = get_address_from_coordinates(stop.latitude, stop.longitude, GOOGLE_API_KEY)
               
                db_stop = Stop(
                    route_id=db_route.route_id,
                    latitude=stop.latitude,
                    longitude=stop.longitude,
                    sequence_number=stop.sequence_number,
                    address=address
                )
                db.add(db_stop)
                db.flush()

                # Saves students & creates assignments
                for student_idx, student in enumerate(stop.students):
                  
                    pickup_time = None
                    if student.pickup_time:
                        try:
                            pickup_time = datetime.fromisoformat(student.pickup_time).time()
                        except:
                            pickup_time = None

                    # Checks if student exists in students table
                    db_student = db.query(Student).filter_by(student_id=student.student_id).first()
                    
                    if not db_student:
                        # Creates new student (only basic info, no assignment fields)
                        db_student = Student(
                            student_id=student.student_id,
                            name=student.name,
                            home_latitude=student.latitude,
                            home_longitude=student.longitude,
                        )
                        db.add(db_student)
                        db.flush()
                    else:
                        # Updates student basic info if needed
                        db_student.name = student.name
                        db_student.home_latitude = student.latitude
                        db_student.home_longitude = student.longitude
                    
                    # Creates assignment linking student to this run/route/stop
                    assignment = StudentAssignment(
                        student_id=student.student_id,
                        run_id=new_run.run_id,
                        route_id=db_route.route_id,
                        stop_id=db_stop.stop_id,
                        pickup_time=pickup_time
                    )
                    db.add(assignment)
                    student_count += 1

        
        if student_count == 0:
            print("WARNING: NO STUDENTS WERE SAVED")
        
        db.commit()
        
        return {
            "message": "Run saved successfully",
            "run_id": new_run.run_id,
            "students_saved": student_count
        }

    except Exception as e:
        db.rollback()
        import traceback
        print(f"ERROR in save_run: {str(e)}")
        print(traceback.format_exc())
        return {"error": str(e), "traceback": traceback.format_exc()}

# Stores all students from CSV, regardless of bus assignment
@app.post("/store_all_students")
async def store_all_students(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        df.dropna(inplace=True)
        
        stored_count = 0
        updated_count = 0
        
        for _, row in df.iterrows():
            student_id = str(row.get('StudentID', row.get('student_id', row.get('ID'))))
            name = str(row.get('Name', row.get('name', row.get('StudentName', 'Unknown'))))
            latitude = float(row.get('Latitude', row.get('latitude', 0)))
            longitude = float(row.get('Longitude', row.get('longitude', 0)))
            
            # Checks if student exists
            db_student = db.query(Student).filter_by(student_id=student_id).first()
            
            if db_student:
                # Updates only if not assigned to a route yet
                if not db_student.assigned_route_id:
                    db_student.name = name
                    db_student.home_latitude = latitude
                    db_student.home_longitude = longitude
                    updated_count += 1
            else:
                # Creates new student (walker - no route assigned)
                db_student = Student(
                    student_id=student_id,
                    name=name,
                    home_latitude=latitude,
                    home_longitude=longitude
                )
                db.add(db_student)
                stored_count += 1
        
        db.commit()
        
        total_in_db = db.query(Student).count()
        
        return {
            "message": "All students stored",
            "new_students": stored_count,
            "updated_students": updated_count,
            "total_in_db": total_in_db
        }
        
    except Exception as e:
        db.rollback()
        import traceback
        print(f"ERROR: {str(e)}")
        print(traceback.format_exc())
        return {"error": str(e)}
    
# Retrieves currently published run with route & stop details
@app.get("/get_published_run")
def get_published_run(db: Session = Depends(get_db)):
    run = db.query(OptimizationRun).filter_by(is_published=True).first()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active run found")

    try:
        routes_data = []
        for route in run.routes:
            stops_data = []
            for stop in route.stops:
                # Gets assignments for this stop
                assignments = db.query(StudentAssignment).filter_by(
                    run_id=run.run_id,
                    stop_id=stop.stop_id
                ).all()
                
                students_data = []
                for assignment in assignments:
                    students_data.append({
                        "student_id": assignment.student.student_id,
                        "name": assignment.student.name,
                        "pickup_time": assignment.pickup_time.isoformat() if assignment.pickup_time else None,
                        "latitude": float(assignment.student.home_latitude),
                        "longitude": float(assignment.student.home_longitude)
                    })
                
                stops_data.append({
                    "stop_id": stop.stop_id,
                    "address": stop.address,
                    "latitude": float(stop.latitude),
                    "longitude": float(stop.longitude),
                    "sequence_number": stop.sequence_number,
                    "students": students_data
                })
            
            routes_data.append({
                "route_id": route.route_id,
                "bus_number": route.bus_number,
                "stops": stops_data,
                "total_students": route.total_students,
                "total_distance_km": route.total_distance_km,
                "estimated_duration_hr": route.estimated_duration_hr,
                "map_path": route.map_path
            })

        return {
            "run_id": run.run_id,
            "name": run.name,
            "timestamp": run.timestamp,
            "buses_needed": run.buses_needed,
            "total_students_uploaded": run.total_students_uploaded,
            "total_walkers": run.total_walkers,
            "total_bus_riders": run.total_bus_riders,
            "overview": run.overview_json or [],
            "route_details": routes_data,
            "map_path": run.map_path
        }

    except Exception as e:
        print(f"Unexpected error in get_published_run: {e}")
        raise HTTPException(status_code=500, detail="Unexpected server error")

# Lists all saved optimization runs with summary info
@app.get("/get_all_runs")
def get_all_runs(db: Session = Depends(get_db)):
    runs = db.query(OptimizationRun).all()
    return [
        {
            "run_id": run.run_id,
            "name": run.name,
            "timestamp": run.timestamp,
            "buses_needed": run.buses_needed,
            "total_students_uploaded": run.total_students_uploaded,
            "total_walkers": run.total_walkers,
            "total_bus_riders": run.total_bus_riders,
            "is_published": run.is_published
        }
        for run in runs
    ]

# Publishes a specific run, unpublishing any previously published run
@app.post("/publish_run/{run_id}")
def publish_run(run_id: int, db: Session = Depends(get_db)):
    db.query(OptimizationRun).update({OptimizationRun.is_published: False})
    run = db.query(OptimizationRun).filter(OptimizationRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.is_published = True
    db.commit()
    return {"message": f"Run {run_id} published"}

# Retrieves a specific run by ID with full details
@app.get("/get_run/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(OptimizationRun).filter(OptimizationRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    routes_data = []
    for route in run.routes:
        stops_data = []
        for stop in route.stops:
            # Gets assignments for this stop in this specific run
            assignments = db.query(StudentAssignment).filter_by(
                run_id=run_id,
                stop_id=stop.stop_id
            ).all()
            
            students_data = []
            for assignment in assignments:
                students_data.append({
                    "student_id": assignment.student.student_id,
                    "name": assignment.student.name,
                    "pickup_time": assignment.pickup_time.isoformat() if assignment.pickup_time else None,
                    "latitude": float(assignment.student.home_latitude),
                    "longitude": float(assignment.student.home_longitude)
                })
            
            stops_data.append({
                "stop_id": stop.stop_id,
                "address": stop.address,
                "latitude": float(stop.latitude),
                "longitude": float(stop.longitude),
                "sequence_number": stop.sequence_number,
                "students": students_data
            })
        
        routes_data.append({
            "route_id": route.route_id,
            "bus_number": route.bus_number,
            "total_students": route.total_students,
            "total_distance_km": float(route.total_distance_km) if route.total_distance_km else 0,
            "estimated_duration_hr": route.estimated_duration_hr,
            "stops": stops_data,
            "map_path": route.map_path
        })

    return {
        "run_id": run.run_id,
        "routes": routes_data,
        "overview": run.overview_json,
        "map_path": run.map_path
    }

# Retrieves a specific route by ID with full details
@app.get("/get_route/{route_id}")
def get_route_details(route_id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.route_id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    stops_data = []
    for stop in route.stops:
        students_data = []
        for student in stop.students:
            students_data.append({
                "student_id": student.student_id,
                "name": student.name,
                "pickup_time": student.pickup_time.isoformat() if student.pickup_time else None,
            })
        stops_data.append({
            "stop_id": stop.stop_id,
            "address": stop.address,
            "latitude": float(stop.latitude) if stop.latitude else None,
            "longitude": float(stop.longitude) if stop.longitude else None,
            "sequence_number": stop.sequence_number,
            "students": students_data
        })

    return {
        "route_id": route.route_id,
        "bus_number": route.bus_number,
        "stops": stops_data
    }

# Deletes a specific optimization run & all associated data
@app.delete("/delete_run/{run_id}")
def delete_run(run_id: int, db: Session = Depends(get_db)):
 
    try:
        run = db.query(OptimizationRun).filter(OptimizationRun.run_id == run_id).first()
        if not run:
            raise HTTPException(status_code=404, detail="Run not found")
        
        # Doesn't allow deleting the currently published run
        if run.is_published:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete a published run. Please publish a different run first."
            )
        
        
        # Deletes the run (CASCADE will handle assignments, routes, stops)
        db.delete(run)
        db.commit()
        
        return {
            "message": f"Run {run_id} deleted successfully",
            "run_id": run_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        (f"ERROR deleting run: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to delete run: {str(e)}")

# Saves feedback from students, distinguishing between published & unpublished runs 
@app.post("/feedback")
def save_feedback(feedback: dict = Body(...), db: Session = Depends(get_db)):
    try:
        student_id = feedback.get("user_id")  
        route_field = feedback.get("route_id") or feedback.get("route")  # flexible
        run_id = feedback.get("run_id")
        bus_number = feedback.get("bus_number")  

        # Normalizes route_id:
        route_id = None
        if route_field is not None:
            if isinstance(route_field, int):
                route_obj = db.query(Route).filter(Route.route_id == route_field).first()
                if route_obj:
                    route_id = route_obj.route_id
            else:
                # Tries to extract digits from strings

                m = re.search(r"(\d+)", str(route_field))
                if m:
                    bus_number = int(m.group(1))
                    # Tries to find by Route.bus_number
                    route_obj = db.query(Route).filter(Route.bus_number == bus_number).first()
                    if route_obj:
                        route_id = route_obj.route_id

        # Gathers options (array)
        options = feedback.get("options")
        if not options:
            positives = feedback.get("positives", []) or []
            issues = feedback.get("issues", []) or []
            # ensure both are lists
            if not isinstance(positives, list):
                positives = [positives]
            if not isinstance(issues, list):
                issues = [issues]
            options = positives + issues


        comment = feedback.get("comment") or feedback.get("comments") or ""

        rating = feedback.get("rating")

        new_feedback = Feedback(
            student_id=student_id,
            route_id=route_id,
            run_id=run_id,
            bus_number=bus_number,  
            rating=rating,
            options=options,
            comment=comment,
            stop=feedback.get("stop"),
            boarding_time=feedback.get("boarding_time"),
            wait_time=feedback.get("wait_time"),
            crowdedness=feedback.get("crowdedness"),
            extra_metadata=feedback.get("metadata"), 
        )


        db.add(new_feedback)
        db.commit()
        db.refresh(new_feedback)
        return {"message": "Feedback saved", "feedback_id": new_feedback.feedback_id}
    except Exception as e:
        db.rollback()
        print(f"Error saving feedback: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Stores real-time bus location updates from drivers (currently simulated)
@app.post("/update-location")
def update_location(data: LocationUpdate):
    db = SessionLocal()
    new_entry = BusLocation(
        bus_number=data.bus_number,
        latitude=data.latitude,
        longitude=data.longitude,
        timestamp=datetime.utcnow()
    )
    db.add(new_entry)
    db.commit()
    return {"message": "Location updated"}

# Retrieves the latest location for a specific bus
@app.get("/bus-location/{bus_number}")
def get_latest_bus_location(bus_number: str, db: Session = Depends(get_db)):
    bus = (
        db.query(BusLocation)
        .filter(BusLocation.bus_number == bus_number)
        .order_by(BusLocation.timestamp.desc())
        .first()
    )
    if not bus:
        return {"error": "No data for this bus yet"}
    return {
        "bus_number": bus.bus_number,
        "latitude": bus.latitude,
        "longitude": bus.longitude,
        "timestamp": bus.timestamp.isoformat()
    }

# Retrieves all feedback, adjusting details based on whether the run was published
@app.get("/feedback/all")
def get_all_feedback(db: Session = Depends(get_db)):
    # Joins Feedback with OptimizationRun to get the is_published status
    results = db.query(
        Feedback, 
        OptimizationRun.is_published
    ).outerjoin(
        OptimizationRun, Feedback.run_id == OptimizationRun.run_id
    ).order_by(Feedback.feedback_id.desc()).all() 

    response_list = []
    
    for f, is_published in results:
        
       
        if is_published:

            response_list.append({
                "feedback_id": f.feedback_id,
                "student_id": f.student_id,
                "bus_number": f.bus_number,
                "route_id": f.route_id,
                "run_id": f.run_id,
                "rating": f.rating,
                "options": f.options,
                "comment": f.comment,
                "stop": f.stop,
                "boarding_time": f.boarding_time,
                "wait_time": f.wait_time,
                "crowdedness": f.crowdedness,
                "is_published_feedback": True 
            })
        else:
            response_list.append({
                "feedback_id": f.feedback_id,
                "comment": "No feedback for this plan (not published).",
                "is_published_feedback": False,
                
               
                "student_id": None, 
                "bus_number": None,  
                "route_id": None,
                "run_id": f.run_id,
                "rating": None,
                "options": [],
                "stop": None,
                "boarding_time": None,
                "wait_time": None,
                "crowdedness": None
            })
    
    return response_list

# Retrieves the current active trip for a student, including walker status
@app.get("/current_trip/{student_id}")
def get_current_trip(student_id: str, db: Session = Depends(get_db)):

    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.is_walker:
        return {
            "student_id": student.student_id,
            "name": student.name,
            "is_walker": True,
            "walking_distance_km": float(student.walking_distance_km) if student.walking_distance_km else None,
            "bus_number": None,
            "route_id": None,
            "pickup_time": None,
            "stop": None,
            "route_map_path": None,
            "run_id": None,
            "message": "Student is a walker (no bus assignment)"
        }

    # Gets published optimization run
    published_run = db.query(OptimizationRun).filter_by(is_published=True).first()
    if not published_run:
        raise HTTPException(status_code=404, detail="No published run found")

    # Finds the student's assignment for this run
    assignment = db.query(StudentAssignment).filter_by(
        student_id=student_id,
        run_id=published_run.run_id
    ).first()
    
    if not assignment:
        if student.is_walker:
            return {
                "student_id": student.student_id,
                "name": student.name,
                "is_walker": True,
                "message": "Student is a walker (no bus assignment)"
            }
        
        return {
            "student_id": student.student_id,
            "name": student.name,
            "is_walker": False,
            "message": "Student not assigned to a bus for this run"
        }

    # Gets route & stop info
    route = db.query(Route).filter(Route.route_id == assignment.route_id).first()
    stop = db.query(Stop).filter(Stop.stop_id == assignment.stop_id).first()

    return {
        "student_id": student.student_id,
        "name": student.name,
        "is_walker": False,
        "bus_number": route.bus_number if route else None,
        "route_id": route.route_id if route else None,  
        "pickup_time": assignment.pickup_time.isoformat() if assignment.pickup_time else None,
        "stop": {
            "latitude": float(stop.latitude) if stop else None,
            "longitude": float(stop.longitude) if stop else None,
            "address": stop.address if stop else None
        },
        "route_map_path": route.map_path if route else None,
        "run_id": published_run.run_id  
    }

# Creates a new admin account with hashed password
@app.post("/admin/signup")
def admin_signup(data: AdminSignupRequest, db: Session = Depends(get_db)):
    existing_admin = db.query(Admin).filter(Admin.email == data.email).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin with this email already exists")

    # Simple SHA-256 hash
    hashed_password = hashlib.sha256(data.password.encode()).hexdigest()
    new_admin = Admin(email=data.email, password_hash=hashed_password)

    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return {"message": "Admin account created successfully", "email": new_admin.email}

# Authenticates admin login credentials
@app.post("/admin/login")
def admin_login(data: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.query(Admin).filter(Admin.email == data.email).first()
    if not admin or hashlib.sha256(data.password.encode()).hexdigest() != admin.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    
    return {"message": "Login successful", "email": admin.email}

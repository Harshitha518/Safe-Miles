'''
    - Calculates metrics & generates overviews for bus routes including student details students
    - Computes metrics per bus & per stop
    - Generates detailed route information including student assignments
'''

import pandas as pd
import numpy as np

# Calculates basic administrative metrics
def calculate_admin_metrics(stop_df, routes, vehicle_capacities):
    metrics = {
        "total_stops": len(stop_df) - 1, 
        "total_buses": len(routes),
        "total_students": stop_df[stop_df['stop_id'] != 'school']['num_students'].sum()
    }
    return metrics

# Generates an overview DataFrame with metrics
def generate_overview_metrics(stop_df, routes, vehicle_capacities, dist_matrix_km):
    depot_mask = stop_df['stop_id'] == 'school'
    total_students = stop_df[~depot_mask]['num_students'].sum()
    total_buses = len(routes)
    total_stops = len(stop_df[~depot_mask])
    
    overloaded = []
    underutilized = []
    total_distance = 0
    
    for bus_idx, route in enumerate(routes):
        load = sum(stop_df.iloc[i]['num_students'] for i in route if not depot_mask.iloc[i])
        capacity = vehicle_capacities[bus_idx] if bus_idx < len(vehicle_capacities) else vehicle_capacities[0]
        
        if load > capacity:
            overloaded.append(bus_idx)
        elif load < capacity * 0.5:
            underutilized.append(bus_idx)
        
        for i in range(len(route) - 1):
            total_distance += dist_matrix_km[route[i]][route[i + 1]]
    
    avg_students_per_stop = total_students / total_stops if total_stops > 0 else 0
    avg_distance = total_distance / total_buses if total_buses > 0 else 0
    
    overview = [
        {"Metric": "Total Students", "Value": int(total_students)},
        {"Metric": "Total Buses", "Value": total_buses},
        {"Metric": "Overloaded Buses", "Value": {"count": len(overloaded), "bus_ids": overloaded}},
        {"Metric": "Underutilized Buses", "Value": {"count": len(underutilized), "bus_ids": underutilized}},
        {"Metric": "Total Stops", "Value": total_stops},
        {"Metric": "Average Students per Stop", "Value": round(avg_students_per_stop, 2)},
        {"Metric": "Total Route Distance (km)", "Value": round(total_distance, 2)},
        {"Metric": "Average Route Distance (km)", "Value": round(avg_distance, 2)},
    ]
    
    return pd.DataFrame(overview)

# Generates detailed route information including per stop student lists & estimated route distances
def generate_route_details(stop_df, routes, dist_matrix_km, df_bus=None, individual_map_paths=None):

    if df_bus is None:
        print("WARNING: df_bus is None. Students will not be populated")
    
    route_details = []
    depot_mask = stop_df['stop_id'] == 'school'
    
    for bus_idx, route in enumerate(routes):
        if len(route) <= 1:
            continue

        map_path = individual_map_paths[bus_idx] if individual_map_paths and bus_idx < len(individual_map_paths) else None
        
 
        total_distance = 0
        for i in range(len(route) - 1):
            total_distance += dist_matrix_km[route[i]][route[i + 1]]

        stops_data = []
        total_students_on_bus = 0
        
        for seq_num, stop_idx in enumerate(route):
      
            if depot_mask.iloc[stop_idx]:
                continue
            
            stop_row = stop_df.iloc[stop_idx]
            stop_lat = float(stop_row['latitude'])
            stop_lon = float(stop_row['longitude'])

            students_list = []
            
          
            if 'student_ids' in stop_row and stop_row['student_ids']:
                student_ids_at_stop = stop_row['student_ids']
                
                if df_bus is not None:
                    
                    for student_id in student_ids_at_stop:
                        student_row = df_bus[df_bus['StudentID'] == student_id]
                        
                        if not student_row.empty:
                            student_row = student_row.iloc[0]
                            students_list.append({
                                'student_id': str(student_id),
                                'name': str(student_row.get('Name', 'Unknown Student')),
                                'latitude': float(student_row.get('Latitude', stop_lat)),
                                'longitude': float(student_row.get('Longitude', stop_lon)),
                                'pickup_time': None
                            })
                
                print(f"Bus {bus_idx}, Stop {seq_num}: Found {len(students_list)} students using stored IDs")
            
          
            elif df_bus is not None and 'assigned_stop_id' in df_bus.columns:
                stop_id = stop_row.get('original_stop_id', stop_row.get('stop_id', stop_idx))
                matched_students = df_bus[df_bus['assigned_stop_id'] == stop_id]
                
                print(f"Bus {bus_idx}, Stop {seq_num}: Found {len(matched_students)} students by stop_id={stop_id}")
                
                for _, student_row in matched_students.iterrows():
                    students_list.append({
                        'student_id': str(student_row.get('StudentID', f'UNKNOWN_{bus_idx}_{seq_num}')),
                        'name': str(student_row.get('Name', 'Unknown Student')),
                        'latitude': float(student_row.get('Latitude', stop_lat)),
                        'longitude': float(student_row.get('Longitude', stop_lon)),
                        'pickup_time': None
                    })
            
            num_students = len(students_list)
            total_students_on_bus += num_students
            
            stops_data.append({
                'latitude': stop_lat,
                'longitude': stop_lon,
                'sequence_number': len(stops_data) + 1, 
                'students': students_list
            })
        
        # Calculates duration (35 km/hr average speed)
        estimated_duration_hr = round(total_distance / 35, 2)
        
        route_info = {
            "bus_number": bus_idx + 1,
            "total_students": total_students_on_bus,
            "total_distance_km": total_distance,    
            "estimated_duration_hr": estimated_duration_hr, 
            "stops": stops_data, 
            "map_path": individual_map_paths[bus_idx] if individual_map_paths and bus_idx < len(individual_map_paths) else None
        }

        
        route_details.append(route_info)
    

    return route_details
'''
    - Implements full bus route optimization pipeline for a school
    - Determines which students need buses vs. who can walk safely
    - Clusters bus riders into stops using machine learning (KMeans) & enforces max walking distance
    - Snaps stops to road network, computes distance matrix, & solves VRP with fleet constraints
    - Generates route maps (overall & individual) using Folium
    - Computes metrics, overview, & detailed route/student information for reporting
'''

import os
import osmnx as ox
from models.loader import load_student_data
from models.clustering import find_optimal_clusters, create_stop_df, enforce_max_distance
from models.routing import build_distance_matrix, solve_vrp_with_fleet_limit, split_large_stops
from models.map import create_route_map, snap_stops_to_graph, precompute_paths, create_individual_route_maps
from models.info import calculate_admin_metrics, generate_overview_metrics, generate_route_details
from sklearn.metrics.pairwise import haversine_distances
import numpy as np
import pandas as pd
from datetime import datetime
import os


def full_optimization_pipeline(
    df: pd.DataFrame,
    school_coords=(40.496296, -74.654846),
    bus_capacity=40,
    num_bus=60,
    safe_walk_miles=1.5,
    map_output_path="assets/optimized_route_map.html",
    generate_map=True,
    precompute=True
):

    SAFE_WALK_KM = (safe_walk_miles / 2.7) * 1.60934

    # DISTANCE TO SCHOOL
    student_coords_rad = np.radians(df[['Latitude', 'Longitude']].to_numpy())
    school_coords_rad = np.radians(np.array([school_coords]))
    distances_rad = haversine_distances(student_coords_rad, school_coords_rad)
    df['distance_to_school_km'] = distances_rad[:, 0] * 6371
    
    # Marks who needs bus vs who can walk
    df['needs_bus'] = df['distance_to_school_km'] > SAFE_WALK_KM
    
    df_bus = df[df['needs_bus']].copy()
    df_walkers = df[~df['needs_bus']].copy()
    
    # CLUSTERING
    coords = df_bus[['Latitude', 'Longitude']].to_numpy()
    optimal_k, kmeans_model, inertias = find_optimal_clusters(coords)
    df_bus['assigned_stop_id'] = kmeans_model.predict(coords)
    centroids_rad = np.radians(kmeans_model.cluster_centers_)
    student_coords_rad = np.radians(coords)
    distances_rad = haversine_distances(student_coords_rad, centroids_rad)
    df_bus['distance_to_stop_km'] = distances_rad[np.arange(len(df_bus)), df_bus['assigned_stop_id']]
    df_bus = enforce_max_distance(df_bus, 1)
    

    # CREATE STOPS
    stop_df = create_stop_df(df_bus, kmeans_model=None, school_coords=school_coords)
    

    # ROAD NETWORK
    
    G = ox.graph_from_point(
        (df_bus['Latitude'].mean(), df_bus['Longitude'].mean()),
        dist=10000,
        network_type='drive'
    )
    stop_df = snap_stops_to_graph(stop_df, G)
    

    # DISTANCE MATRIX
    stop_nodes = stop_df['graph_node'].tolist()
    dist_matrix = build_distance_matrix(G, stop_nodes)

    # BUS CAPACITY
    stop_df = split_large_stops(stop_df, bus_capacity)
    stop_nodes = stop_df['graph_node'].tolist()
    dist_matrix = build_distance_matrix(G, stop_nodes)
    dist_matrix_km = dist_matrix / 1000
    
    # VRP WITH FLEET CONSTRAINTS
    vehicle_capacities = [bus_capacity] * num_bus
    school_indices = stop_df[stop_df['stop_id'] == 'school'].index
    if len(school_indices) == 0:
        raise ValueError("School not found in stop_df")
    depot_index = stop_df.index.get_loc(school_indices[0])
    demands = stop_df['num_students'].tolist()


    routes, vrp_metrics = solve_vrp_with_fleet_limit(
        dist_matrix_km, 
        demands, 
        vehicle_capacities, 
        depot_index=depot_index,
        max_buses=num_bus,
        min_buses=max(1, num_bus // 2)
    )
    
    if not routes:
        raise ValueError("VRP optimization failed - no feasible solution found")
    
    print("VRP solved")

    # REMOVE EMPTY BUSES
    filtered_routes = [r for r in routes if sum(demands[i] for i in r if i != depot_index) > 0]
    bus_loads = [sum(demands[i] for i in r if i != depot_index) for r in filtered_routes]
    routes = filtered_routes
    actual_num_buses = len(routes)
    
    # PRECOMPUTE PATHS & MAP 
    path_dict = {}
    individual_map_paths = []
    
    if precompute:
       
        path_dict = precompute_paths(G, stop_nodes)


    if generate_map:
        m = create_route_map(G, stop_df, routes, school_coords, path_dict)
    
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"optimized_route_map_{timestamp}.html"
        map_output_path = os.path.join("assets", unique_filename)
    
        m.save(map_output_path)
        

        individual_map_paths = create_individual_route_maps(G, stop_df, routes, school_coords, path_dict)
    
    else:
        map_output_path = None

    # METRICS 
    metrics = calculate_admin_metrics(stop_df, routes, vehicle_capacities)
    overview_df = generate_overview_metrics(stop_df, routes, vehicle_capacities, dist_matrix_km)
    
    overview_records = overview_df.to_dict(orient="records")
    
    overview_records.extend([
        {"Metric": "Buses Requested", "Value": num_bus},
        {"Metric": "Buses Actually Used", "Value": actual_num_buses},
        {"Metric": "Bus Efficiency", "Value": vrp_metrics.get("efficiency_gain", "N/A")},
        {"Metric": "Bus Riders", "Value": len(df_bus)},
        {"Metric": "Walkers", "Value": len(df_walkers)},
        {"Metric": "Average Bus Load", "Value": f"{vrp_metrics.get('avg_load', 0):.1f} students"}
    ])
    
    route_details = generate_route_details(
        stop_df, 
        routes, 
        dist_matrix_km, 
        df_bus=df_bus, 
        individual_map_paths=individual_map_paths
    )
    

    # RETURN WALKER DATA
    return {
        "num_bus": actual_num_buses,
        "buses_requested": num_bus,
        "bus_loads": bus_loads,
        "overview": overview_records,
        "route_details": route_details,
        "map_path": map_output_path,
        "individual_map_paths": individual_map_paths,
        "optimization_metrics": vrp_metrics,
        "df_with_analysis": df, 
        "df_walkers": df_walkers,  
        "df_bus_riders": df_bus 
    }
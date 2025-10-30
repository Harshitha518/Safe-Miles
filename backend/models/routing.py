'''
    - Solves the Vehicle Routing Problem (VRP) with flexible fleet size for school buses
    - Splits large stops if student demand exceeds bus capacity
    - Computes shortest driving distance between stops on a road network
    - Returns optimized bus routes, metrics, & adjusted stop data
'''

import numpy as np
import networkx as nx
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from typing import List, Tuple
import pandas as pd
import math


# Solves school bus VRP with flexible fleet size, adjusting number of buses between min and max to serve all students while respecting capacities
def solve_vrp_with_fleet_limit(
    dist_matrix: np.ndarray, 
    demands: List[int], 
    vehicle_capacities: List[int], 
    depot_index: int,
    max_buses: int,
    min_buses: int = None
) -> Tuple[List[List[int]], dict]:
    
    if min_buses is None:
        min_buses = max(1, max_buses // 2)
    
    num_stops = len(dist_matrix)
    total_demand = sum(demands)
    theoretical_min_buses = math.ceil(total_demand / vehicle_capacities[0])
    
    
    # Checks if problem is solvable
    if theoretical_min_buses > max_buses:
        print(f"WARNING: Need at least {theoretical_min_buses} buses, but only {max_buses} available")
        print(f"Consider: increasing bus capacity or fleet size")
        print(f"Proceeding with {max_buses} buses (may result in overcrowding)")
    
    # Tries to find optimal solution within bounds
    best_solution = None
    best_routes = []
    best_num_buses = max_buses
    
    # Starts with theoretical minimum --> work up to maximum
    for num_vehicles in range(max(theoretical_min_buses, min_buses), max_buses + 1):
        print(f"Attempting with {num_vehicles} buses...")
        
        # Creates routing model
        manager = pywrapcp.RoutingIndexManager(num_stops, num_vehicles, depot_index)
        routing = pywrapcp.RoutingModel(manager)
        
        def distance_callback(from_index, to_index):
            return int(dist_matrix[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)])
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
      
        def demand_callback(from_index):
            return demands[manager.IndexToNode(from_index)]
        
        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        
        # Uses same capacity for all buses
        capacities = [vehicle_capacities[0]] * num_vehicles
        
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0, 
            capacities,
            True,
            'Capacity'
        )
        

        search_params = pywrapcp.DefaultRoutingSearchParameters()
        search_params.time_limit.seconds = 30  # Short limit per attempt
        search_params.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
        )
        search_params.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        
        # Solves
        solution = routing.SolveWithParameters(search_params)
        
        if solution:
            routes = []
            total_distance = 0
            buses_used = 0
            
            for vehicle_id in range(num_vehicles):
                index = routing.Start(vehicle_id)
                route = []
                route_distance = 0
                
                while not routing.IsEnd(index):
                    route.append(manager.IndexToNode(index))
                    previous_index = index
                    index = solution.Value(routing.NextVar(index))
                    route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
                
                route.append(manager.IndexToNode(index))
                
                # Only counts routes that serve students (not just depot)
                route_load = sum(demands[i] for i in route if i != depot_index)
                if route_load > 0:
                    routes.append(route)
                    total_distance += route_distance
                    buses_used += 1
            
            print(f"Found solution with {buses_used} active buses")
            print(f"     Total distance: {total_distance/1000:.1f} km")
            
            # Keeps solution with fewest buses
            if buses_used < best_num_buses:
                best_solution = solution
                best_routes = routes
                best_num_buses = buses_used
                
                # If we found a good solution, we can stop early
                if buses_used <= theoretical_min_buses + 2: 
                    print(f"Near-optimal solution found, stopping search")
                    break
        else:
            print(f" No solution found with {num_vehicles} buses")
    
    # Prepares metrics
    if best_routes:
        bus_loads = [sum(demands[i] for i in route if i != depot_index) for route in best_routes]
        overloaded = [i for i, load in enumerate(bus_loads) if load > vehicle_capacities[0]]
        underutilized = [i for i, load in enumerate(bus_loads) if load < vehicle_capacities[0] * 0.5]
        
        metrics = {
            "buses_requested": max_buses,
            "buses_used": best_num_buses,
            "theoretical_minimum": theoretical_min_buses,
            "efficiency_gain": f"{((max_buses - best_num_buses) / max_buses * 100):.1f}%",
            "total_students": total_demand,
            "bus_loads": bus_loads,
            "avg_load": sum(bus_loads) / len(bus_loads),
            "overloaded_buses": overloaded,
            "underutilized_buses": underutilized,
            "status": "optimal" if best_num_buses == theoretical_min_buses else "good"
        }
        
    
        if overloaded:
            print(f"Overloaded buses: {len(overloaded)}")
        if underutilized:
            print(f" Underutilized buses: {len(underutilized)}")
        print(f"{'='*60}\n")
        
        return best_routes, metrics
    else:
        print(f"\nOPTIMIZATION FAILED - No feasible solution found")
        print(f"   Try: increasing max_buses or bus_capacity")
        return [], {}


# Splits stops with demand exceeding bus capacity into multiple sub stops
def split_large_stops(stop_df: pd.DataFrame, bus_capacity: int) -> pd.DataFrame:
    new_stops = []
    
    for _, row in stop_df.iterrows():
        demand = row['num_students']
        if demand <= bus_capacity:
            new_stops.append(row)
        else:
            num_sub_stops = math.ceil(demand / bus_capacity)
            students_per_sub_stop = math.ceil(demand / num_sub_stops)
            
            for i in range(num_sub_stops):
                new_row = row.copy()
                new_row['stop_id'] = f"{row['stop_id']}_part{i+1}"
                if i == num_sub_stops - 1:
                    new_row['num_students'] = demand - students_per_sub_stop*(num_sub_stops-1)
                else:
                    new_row['num_students'] = students_per_sub_stop
                new_stops.append(new_row)
    
    return pd.DataFrame(new_stops)


# Computes shortest driving distances between all stops using netwrok graph
def build_distance_matrix(G: nx.Graph, stop_nodes: List[int]) -> np.ndarray:
    n = len(stop_nodes)
    dist_matrix = np.zeros((n, n))
    np.fill_diagonal(dist_matrix, 0)
    
    for i, source_node in enumerate(stop_nodes):
        try:
            distances = nx.single_source_dijkstra_path_length(G, source_node, weight='length')
            for j, target_node in enumerate(stop_nodes):
                if target_node in distances:
                    dist_matrix[i, j] = distances[target_node]
        except Exception:
            continue
    
    dist_matrix = np.nan_to_num(dist_matrix, nan=1e6, posinf=1e6, neginf=1e6)
    dist_matrix = dist_matrix.astype(int)
    
    return dist_matrix



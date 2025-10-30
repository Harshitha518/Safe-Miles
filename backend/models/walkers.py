'''
    - Calculates each student's walking distance to school using pedestrian network
    - Flags those who exceed a safe walking threshold or have no path as needing bus transport
'''

import osmnx as ox
import networkx as nx

def calculate_safe_walking_distances(df, school_coords, safe_walk_km=2.4):
    # Loads walking network
    center_point = (df['Latitude'].mean(), df['Longitude'].mean())
    G_walk = ox.graph_from_point(center_point, dist=8000, network_type='walk')
    
    # Snaps school to walking network
    school_node = ox.distance.nearest_nodes(G_walk, school_coords[1], school_coords[0])
    
    walking_distances = []
    unsafe_students = []

    for idx, row in df.iterrows():
        try:
            # Snaps student's home to walking network
            student_node = ox.distance.nearest_nodes(G_walk, row['Longitude'], row['Latitude'])

            # Calculates actual walking distance
            walk_distance_m = nx.shortest_path_length(G_walk, student_node, school_node, weight='length')
            walk_distance_km = walk_distance_m / 1000

            walking_distances.append(walk_distance_km)

        except (nx.NetworkXNoPath, Exception):
            walking_distances.append(float('inf'))
            unsafe_students.append(idx)

    df['walking_distance_km'] = walking_distances
        
    # Students need bus if walking distance > threshold or no safe path exists
    df['needs_bus'] = (df['walking_distance_km'] > safe_walk_km) | (df['walking_distance_km'] == float('inf'))
    
    return df, unsafe_students

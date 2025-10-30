'''
    - Snaps bus stops to nearest road network nodes using OSMnx & stores snapped coordinates
    - Precomputes shortest paths between all stops to speed up route plotting
    - Generates interactive Folium maps showing multiple bus routes and stop markers
    - Creates individual HTML maps for each bus route and saves them to disk
'''

import pandas as pd
import osmnx as ox
import networkx as nx
import folium
from typing import List, Tuple
import os, folium
from datetime import datetime

# Snaps stops to nearest road netwrok nodes & stores snapped coordinates
def snap_stops_to_graph(stop_df: pd.DataFrame, G: nx.Graph) -> pd.DataFrame:
    def get_snapped_coords(row):
        if row['stop_id'] == 'school':
            node = ox.distance.nearest_nodes(G, row['longitude'], row['latitude'])
            return pd.Series({
                'graph_node': node,
                'snapped_lat': row['latitude'],
                'snapped_lon': row['longitude']
            })
        else:
            node = ox.distance.nearest_nodes(G, row['longitude'], row['latitude'])
            return pd.Series({
                'graph_node': node,
                'snapped_lat': G.nodes[node]['y'],
                'snapped_lon': G.nodes[node]['x']
            })
    stop_df[['graph_node','snapped_lat','snapped_lon']] = stop_df.apply(get_snapped_coords, axis=1)
    return stop_df

# Precomputes shortest paths between all stop nodes in graph
def precompute_paths(G: nx.Graph, stop_nodes: List[int]):
    path_dict = {}
    for orig in stop_nodes:
        # Runs Dijkstra from orig to all other nodes once
        lengths, paths = nx.single_source_dijkstra(G, source=orig, weight="length")
        for dest in stop_nodes:
            if orig != dest and dest in paths:
                path_dict[(orig, dest)] = paths[dest]
    return path_dict

# Generates folium map with multiple bus routes & stop markers
def create_route_map(G: nx.Graph, stop_df: pd.DataFrame, all_routes: List[List[int]], school_coords: Tuple[float,float], path_dict: dict) -> folium.Map:
    # Creates interactive folium map
    m = folium.Map(location=school_coords, zoom_start=13)
    colors = ['blue', 'green', 'purple', 'orange', 'darkred', 'cadetblue', 'darkgreen', 'pink']


    # Plots each bus route
    for bus_idx, route in enumerate(all_routes):
        route_color = colors[bus_idx % len(colors)]
        for i in range(len(route)-1):
            origin_node = stop_df.iloc[route[i]]['graph_node']
            dest_node   = stop_df.iloc[route[i+1]]['graph_node']
            
            
            # Lookups path instead of recalculating
            path = path_dict.get((origin_node, dest_node))
            if path:
                coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in path]
                folium.PolyLine(coords, color=route_color, weight=4, opacity=0.8).add_to(m)


    # Plots stop markers
    for idx, row in stop_df.iterrows():
        lat, lon = row['snapped_lat'], row['snapped_lon']
        label = "SCHOOL" if row['stop_id']=='school' else f"Stop {row['stop_id']}"
        folium.Marker([lat, lon], popup=label, icon=folium.Icon(color='red' if label=="SCHOOL" else 'blue')).add_to(m)


    return m

# Generates & saves individual HTML maps for each bus route
def create_individual_route_maps(G, stop_df, routes, school_coords, path_dict, output_folder="assets/individual_maps"):

    # Creates a unique subfolder for each run
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_folder = os.path.join(output_folder, f"run_{timestamp}")
    os.makedirs(run_folder, exist_ok=True)

    file_paths = []

    for i, route in enumerate(routes):
        m = folium.Map(location=school_coords, zoom_start=13)
        for j in range(len(route)-1):
            origin_node = stop_df.iloc[route[j]]['graph_node']
            dest_node   = stop_df.iloc[route[j+1]]['graph_node']
            path = path_dict.get((origin_node, dest_node))
            if path:
                coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in path]
                folium.PolyLine(coords, color='blue', weight=4, opacity=0.8).add_to(m)

        # Adds stops
        for idx in route:
            row = stop_df.iloc[idx]
            folium.Marker(
                [row['snapped_lat'], row['snapped_lon']],
                popup=f"Stop {row['stop_id']} ({row['num_students']} students)",
                icon=folium.Icon(color='red' if row['stop_id']=='school' else 'green')
            ).add_to(m)

        filename = f"route_{i+1}.html"
        file_path = os.path.join(run_folder, filename)
        m.save(file_path)
        file_paths.append(file_path)
    
    print(f"Saved {len(routes)} individual route maps to {run_folder}")
    return file_paths

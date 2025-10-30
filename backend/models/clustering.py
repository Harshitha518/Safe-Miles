'''
    - Handles clustering of student locations to determine optimal bus stop locations using machine learning (KMeans clustering)
    - Ensures each stuent is assigned to a stop within a maximum walking distance
    - Allows visualizaition of the elbow method for selecting optimal number of clusters & how it's split to ensure student comfort
'''

from sklearn.cluster import KMeans
from kneed import KneeLocator
from sklearn.metrics.pairwise import haversine_distances
import numpy as np
import pandas as pd
from typing import List, Tuple
import matplotlib.pyplot as plt
import math
    

# Computes optimal number of bus stops using KMeans & elbow method
def find_optimal_clusters(coords: np.ndarray, k_range=range(1,31)) -> Tuple[int, KMeans, List[float]]:
    # Stores inertia (total squared distance from points to cluster centers) values for each K
    inertias = []


    # Finds optimal number of clusters for bus stops
    for k in k_range:
        kmeans = KMeans(n_clusters=k, random_state=42)
        kmeans.fit(coords)
        inertias.append(kmeans.inertia_)

    # Uses KneeLocator to find point where rate of decrease in inertia sharply changes (elbow) --> Where adding more stops gives diminishing returns
    kneedle = KneeLocator(k_range, inertias, curve='convex', direction='decreasing')
    optimal_k = kneedle.elbow

    # Trains a KMeans model using optimal num of clusters --> model knows location of each cluster & which points belong to which cluster
    kmeans_opt = KMeans(n_clusters=optimal_k, random_state=42).fit(coords)


    plt.plot(k_range, inertias, marker='o')
    plt.axvline(optimal_k, color='red', linestyle='--', label=f'Elbow at k={optimal_k}')
    plt.xticks(k_range)
    plt.xlabel('Number of Clusters (k)')
    plt.ylabel('Inertia')
    plt.title('Elbow Method for Optimal k')
    plt.legend()
    plt.grid(True)
    plt.savefig('assets/elbow_method.png', dpi=300, bbox_inches='tight')
    plt.close()

    return optimal_k, kmeans_opt, inertias

# Generates a DataFrame of stops with coordinates, student counts,and optional school depot
def create_stop_df(df, kmeans_model=None, school_coords=None):
    # Gets unique stop IDs
    stop_ids = df['assigned_stop_id'].unique()
    
    stops_data = []
    
    for stop_id in stop_ids:
        # Gets all students assigned to this stop
        students_at_stop = df[df['assigned_stop_id'] == stop_id]
        
        # Calculates centroid (mean of all student coordinates)
        centroid_lat = students_at_stop['Latitude'].mean()
        centroid_lon = students_at_stop['Longitude'].mean()
        
        # Gets student IDs for this stop
        student_ids = students_at_stop['StudentID'].tolist()
        
        stops_data.append({
            'stop_id': int(stop_id),
            'original_stop_id': int(stop_id), 
            'latitude': centroid_lat,
            'longitude': centroid_lon,
            'num_students': len(students_at_stop),
            'student_ids': student_ids 
        })
    
    stop_df = pd.DataFrame(stops_data)
    
    # Adds school as a stop (depot)
    if school_coords:
        school_row = pd.DataFrame([{
            'stop_id': 'school',
            'original_stop_id': 'school',
            'latitude': school_coords[0],
            'longitude': school_coords[1],
            'num_students': 0,
            'student_ids': []
        }])
        stop_df = pd.concat([school_row, stop_df], ignore_index=True)
    
    return stop_df

# Splits clusters so every student is within a max distiance from their assigned stop
def enforce_max_distance(df_bus, max_distance_km):
    new_df = df_bus.copy()
    
    while True:
        # Computes current cluster centers
        stop_centers = []
        cluster_map = {} 
        for new_idx, (stop_id, group) in enumerate(new_df.groupby('assigned_stop_id')):
            stop_centers.append(group[['Latitude', 'Longitude']].mean().to_numpy())
            cluster_map[stop_id] = new_idx
        
        centroids_rad = np.radians(np.array(stop_centers))
        student_coords_rad = np.radians(new_df[['Latitude', 'Longitude']].to_numpy())
        distances_rad = haversine_distances(student_coords_rad, centroids_rad)
        
        # Reindexes assigned_stop_id to match centroids
        new_df['assigned_stop_id_reindexed'] = new_df['assigned_stop_id'].map(cluster_map)
        new_df['distance_to_stop_km'] = distances_rad[np.arange(len(new_df)), new_df['assigned_stop_id_reindexed']] * 6371

        # Finds clusters with students too far
        problematic_clusters = [
            stop_id for stop_id, group in new_df.groupby('assigned_stop_id')
            if group['distance_to_stop_km'].max() > max_distance_km
        ]

        
        if not problematic_clusters:
            break
        
        # Splits each problematic cluster
        max_existing_id = new_df['assigned_stop_id'].max() + 1
        for stop_id in problematic_clusters:
            group = new_df[new_df['assigned_stop_id'] == stop_id]
            num_subclusters = max(2, math.ceil(group['distance_to_stop_km'].max() / max_distance_km))

            # Reclusters into smaller subclusters
            sub_coords = group[['Latitude', 'Longitude']].to_numpy()
            kmeans_sub = KMeans(n_clusters=num_subclusters, random_state=42)
            new_labels = kmeans_sub.fit_predict(sub_coords)

            # Assigns new cluster IDs
            for i, student_idx in enumerate(group.index):
                new_df.at[student_idx, 'assigned_stop_id'] = max_existing_id + new_labels[i]

            max_existing_id += num_subclusters


    new_df.drop(columns='assigned_stop_id_reindexed', inplace=True)
    return new_df


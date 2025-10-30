'''
    - Simulates real time bus location update through GPS
    - Randomly jitters lattitude & longitude to simulate movement
    - Intended for testing/demo purposes only
'''

import requests
import time
import random

bus_number = "21"
lat = 40.5037
lon = -74.6387


while True:
    lat += (random.random() - 0.5) * 0.001
    lon += (random.random() - 0.5) * 0.001

    data = {
        "bus_number": bus_number,
        "latitude": lat,
        "longitude": lon
    }

    try:
        response = requests.post("http://localhost:8000/update-location", json=data)
        print(f"Updated bus {bus_number}: {lat}, {lon} | Status: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

    time.sleep(5)

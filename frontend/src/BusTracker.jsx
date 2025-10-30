/*
  - Live bus tracking for students
  - Fetches current bus location & calculates distance & ETA to student's stop
  - Displays real-time updates, increasing student convenience and safety
*/

import React, { useEffect, useState } from "react";
import { getDistance } from "geolib";
import { Bus, AlertCircle } from "lucide-react";
import "./index.css";

export default function BusTracker({ student, onBack }) {
	const [busLocation, setBusLocation] = useState(null);
	const [distanceKm, setDistanceKm] = useState(null);
	const [etaMinutes, setEtaMinutes] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (!student?.bus_number) return;

		const fetchLocation = async () => {
			try {
				const res = await fetch(
					`http://localhost:8000/bus-location/${student.bus_number}`,
				);
				const data = await res.json();
				if (data.error) {
					setError(data.error);
					setBusLocation(null);
				} else {
					setBusLocation(data);
					setError(null);
				}
			} catch (err) {
				setError("Failed to fetch bus location");
			}
		};

		fetchLocation();
		const interval = setInterval(fetchLocation, 5000);
		return () => clearInterval(interval);
	}, [student?.bus_number]);

	useEffect(() => {
		if (
			busLocation &&
			student?.stop_location &&
			busLocation.latitude &&
			busLocation.longitude &&
			student.stop_location.latitude &&
			student.stop_location.longitude
		) {
			const distanceMeters = getDistance(
				{
					latitude: student.stop_location.latitude,
					longitude: student.stop_location.longitude,
				},
				{ latitude: busLocation.latitude, longitude: busLocation.longitude },
			);

			const distanceKm = distanceMeters / 1000;
			setDistanceKm(distanceKm.toFixed(3));

			const speedKmh = 25 * 1.60934;
			const hours = distanceKm / speedKmh;
			const minutes = hours * 60;

			setEtaMinutes(minutes.toFixed(1));
		}
	}, [busLocation, student]);

	return (
		<div className="page">
			<div className="card">
				<button className="primary-button" onClick={onBack}>
					← Back
				</button>
				<h2 className="bus-tracker-title">Live Bus Tracking</h2>

				{error ? (
					<div className="bus-error">
						<AlertCircle className="bus-error-icon" />
						<p>{error}</p>
					</div>
				) : busLocation ? (
					<div className="bus-tracker-info">
						<div className="bus-number">
							<Bus className="bus-icon" />
							<span>Bus #{student.bus_number}</span>
						</div>

						<div className="bus-tracker-info">
							<div className="bus-info-card top-card">
								<div className="bus-distance">
									<p className="bus-distance-label">Distance from your stop:</p>
									<p className="bus-distance-value">{distanceKm ?? "…"} km</p>
								</div>
							</div>

							<div className="bus-info-card middle-card">
								<div>
									<p className="bus-eta-label">Estimated Time of Arrival:</p>
									<p className="bus-eta-value">
										{etaMinutes ? `${etaMinutes} min` : "…"}
									</p>
								</div>
							</div>
						</div>
					</div>
				) : (
					<p className="bus-loading">Fetching live bus data...</p>
				)}
			</div>
		</div>
	);
}

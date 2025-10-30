/*
    - Component for uploading student data CSV, configuring optimization settings, and creating new bus route plans
    - Saves optimized routes to the backend database
    - Uses ML algorithms for route optimization, focusing on student safety and efficiency
*/

import React, { useState, useEffect } from "react";
import "./index.css";

export default function DataUpload({ onPublish }) {
	const [selectedFile, setSelectedFile] = useState(null);
	const [savedPlan, setSavedPlan] = useState(null);
	const [hasPlan, setHasPlan] = useState(false);
	const [isUploading, setIsUploading] = useState(false);

	const [runName, setRunName] = useState("");
	const [numBuses, setNumBuses] = useState(60);
	const [busCapacity, setBusCapacity] = useState(45);

	const [mapUrl, setMapUrl] = useState(null);
	const [overview, setOverview] = useState([]);
	const [routeDetails, setRouteDetails] = useState([]);

	const [allRuns, setAllRuns] = useState([]);

	const handleFileSelect = (event) => {
		setSelectedFile(event.target.files[0]);
	};

	const handleRunAndSave = async () => {

		if (!selectedFile) {
			alert("Please upload a CSV file first.");
			return;
		}
		if (!runName.trim()) {
			alert("Please enter a plan name.");
			return;
		}

		setIsUploading(true);
		try {
			const formData = new FormData();
			formData.append("file", selectedFile);

			const storeResponse = await fetch(
				"http://localhost:8000/store_all_students",
				{
					method: "POST",
					body: formData,
				},
			);
			if (!storeResponse.ok)
				console.warn("Failed to store all students, continuing...");

			const formData2 = new FormData();

			formData2.append("file", selectedFile);
			formData2.append("num_bus", numBuses);
			formData2.append("bus_capacity", busCapacity);

			const uploadResponse = await fetch("http://localhost:8000/upload_csv", {
				method: "POST",
				body: formData2,
			});
			if (!uploadResponse.ok) throw new Error("Optimization failed!");
			const data = await uploadResponse.json();

			setOverview(data.overview || []);
			setRouteDetails(data.route_details || []);
			if (data.map_path) setMapUrl(`http://localhost:8000/${data.map_path}`);
			setHasPlan(true);

			const payload = {
				name: runName,
				total_students_uploaded:
					data.overview.find((o) => o.Metric === "Total Students")?.Value || 0,
				total_bus_riders:
					data.overview.find((o) => o.Metric === "Bus Riders")?.Value || 0,
				total_walkers:
					data.overview.find((o) => o.Metric === "Walkers")?.Value || 0,
				buses_needed:
					data.overview.find((o) => o.Metric === "Total Buses")?.Value || 0,
				overview: data.overview,
				map_path: data.map_path
					? data.map_path.replace("http://localhost:8000/", "")
					: null,
				route_details: data.route_details.map((route) => ({
					bus_number: route.bus_number,
					total_students: route.total_students,
					total_distance_km: route.total_distance_km,
					estimated_duration_hr: route.estimated_duration_hr,
					map_path: route.map_path || null,
					stops: (route.stops || []).map((stop, stopIndex) => ({
						latitude: Number(stop.latitude || 0),
						longitude: Number(stop.longitude || 0),
						sequence_number: stopIndex + 1,
						students: (stop.students || []).map((student, studentIndex) => ({
							student_id:
								student.student_id ||
								`STUDENT_${route.bus_number}_${stopIndex}_${studentIndex}`,
							name: student.name || `Student ${studentIndex + 1}`,
							pickup_time: student.pickup_time || new Date().toISOString(),
							latitude: Number(student.latitude || stop.latitude || 0),
							longitude: Number(student.longitude || stop.longitude || 0),
						})),
					})),
				})),
			};

			const saveResponse = await fetch("http://localhost:8000/save_run", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!saveResponse.ok) throw new Error("Saving to DB failed!");
			const result = await saveResponse.json();

			alert(`Optimization complete and saved with ID: ${result.run_id}`);
			setSavedPlan(result.run_id);
			setRunName("");
			setHasPlan(false);
		} catch (err) {
			console.error(err);
			alert(`Error: ${err.message}`);
		} finally {
			setIsUploading(false);
		}
	};

	useEffect(() => {
		const fetchAllRuns = async () => {
			try {
				const res = await fetch("http://localhost:8000/get_all_runs");
				if (!res.ok) throw new Error("Failed to fetch all runs");
				const data = await res.json();
				setAllRuns(data);
			} catch (err) {
				console.error("Error fetching runs:", err);
			}
		};
		fetchAllRuns();
	}, []);

	return (
		<div className="page">
			<div>
				<h1>Create New Plan</h1>
				<p>
					Start by uploading your student data and adjusting settings to create
					the most efficient bus routes for your district.
				</p>
			</div>

			<section className="card upload-settings-card">
				<h3>Plan Configuration</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="form-group">
						<label>Plan Name</label>
						<input
							type="text"
							placeholder="ex. 'Fall 2025 Draft'"
							value={runName}
							onChange={(e) => setRunName(e.target.value)}
							style={{ borderColor: "#49CE7A" }}
						/>
					</div>

					<div className="form-group">
						<label>Maximum Number of Buses</label>
						<input
							type="number"
							min="1"
							value={numBuses}
							onChange={(e) => setNumBuses(Number(e.target.value))}
							style={{ borderColor: "#1F5EFF" }}
						/>
					</div>

					<div className="form-group">
						<label>Bus Capacity</label>
						<input
							type="number"
							min="1"
							value={busCapacity}
							onChange={(e) => setBusCapacity(Number(e.target.value))}
							style={{ borderColor: "#9514FF" }}
						/>
					</div>
				</div>
			</section>

			<section className="card upload-card">
				<div>
					<h3>Data Upload</h3>
					<p>
						Upload your student CSV to begin optimization. Make sure your file
						includes the following columns: Student ID, Name, Longitude, and
						Latitude.
					</p>
				</div>
				<div className="upload-row">
					<input type="file" accept=".csv" onChange={handleFileSelect} />
				</div>

				<button
					className={`primary-button ${isUploading ? "loading" : ""}`}
					onClick={handleRunAndSave}
					disabled={!selectedFile || isUploading}
				>
					{isUploading ? (
						<span className="spinner-circle"></span>
					) : (
						"Run Optimization & Save Plan"
					)}
				</button>
			</section>

			{savedPlan && (
				<section className="cta-card">
					<div className="cta-text">
						<h3>Ready to publish your optimized routes?</h3>
						<p>View and finalize your plan before sharing with the district.</p>
					</div>
					<button
						className="cta-button"
						onClick={() => {
							if (!savedPlan) return;
							onPublish(savedPlan);
						}}
					>
						Review and Publish
					</button>
				</section>
			)}
		</div>
	);
}

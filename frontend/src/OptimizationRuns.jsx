/*
    - Displays all route optimization plans (published & drafts)
    - Allows viewing, publishing, and deleting of plans
    - Shows detailed map views and route breakdowns for each plan & each bus
    - Allows admin to manage and activate optimized routes effeciently
*/

import React, { useState, useEffect } from "react";
import { Eye, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import "./index.css";

export default function OptimizationRuns({ autoOpenRunId }) {
	const [savedPlan, setSavedPlan] = useState(null);

	const [isPublishedPlan, setIsPublishedPlan] = useState(false);
	const [planName, setPlanName] = useState(null);

	const [mapUrl, setMapUrl] = useState(null);
	const [overview, setOverview] = useState([]);
	const [routeDetails, setRouteDetails] = useState([]);

	const [allRuns, setAllRuns] = useState([]);

	const [expandedRows, setExpandedRows] = useState([]);

	const [selectedMapView, setSelectedMapView] = useState("all");
	const [currentMapUrl, setCurrentMapUrl] = useState(null);

	const toggleRow = (busNumber) => {
		setExpandedRows((prev) =>
			prev.includes(busNumber)
				? prev.filter((num) => num !== busNumber)
				: [...prev, busNumber],
		);
	};

	const fetchRunDetails = async (runId) => {
		try {
			const res = await fetch(`http://localhost:8000/get_run/${runId}`);
			if (!res.ok) throw new Error("Failed to fetch run");
			const data = await res.json();

			setOverview(data.overview || []);
			setRouteDetails(data.routes || []);
			setMapUrl(
				data.map_path ? `http://localhost:8000/${data.map_path}` : null,
			);
			setCurrentMapUrl(
				data.map_path ? `http://localhost:8000/${data.map_path}` : null,
			);
			setSelectedMapView("all");

			const matchedRun = allRuns.find((r) => r.run_id === runId);
			setPlanName(matchedRun?.name || `Run ${runId}`);
			setSavedPlan(runId);
			setIsPublishedPlan(false);
		} catch (err) {
			console.error("Error loading run:", err);
		}
	};

	const handleMapSelection = (e) => {
		const value = e.target.value;
		setSelectedMapView(value);

		if (value === "all") {
			setCurrentMapUrl(mapUrl);
		} else {
			const routeNum = parseInt(value);
			const route = routeDetails.find((r) => r.bus_number === routeNum);
			if (route && route.map_path) {
				setCurrentMapUrl(`http://localhost:8000/${route.map_path}`);
			} else {
				setCurrentMapUrl(null);
			}
		}
	};

	const publishPlan = async (runId) => {
		try {
			const res = await fetch(`http://localhost:8000/publish_run/${runId}`, {
				method: "POST",
			});

			if (!res.ok) throw new Error("Failed to publish");

			alert("Plan published successfully.");

			const runsRes = await fetch("http://localhost:8000/get_all_runs");
			const runsData = await runsRes.json();

			const prevOrder = allRuns.map((r) => r.run_id);
			runsData.sort(
				(a, b) => prevOrder.indexOf(a.run_id) - prevOrder.indexOf(b.run_id),
			);

			setAllRuns(runsData);

			if (savedPlan === runId) {
				setIsPublishedPlan(true);
			}
		} catch (err) {
			console.error("Error publishing:", err);
			alert("Failed to publish plan");
		}
	};

	const handleDelete = async (runId) => {
		if (!window.confirm("Are you sure you want to delete this plan?")) return;

		try {
			const res = await fetch(`http://localhost:8000/delete_run/${runId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Failed to delete");

			alert("Plan deleted successfully");

			setAllRuns((prevRuns) => prevRuns.filter((run) => run.run_id !== runId));

			if (savedPlan === runId) {
				setSavedPlan(null);
				setRouteDetails([]);
				setOverview([]);
				setMapUrl(null);
				setPlanName(null);
				setIsPublishedPlan(false);
			}
		} catch (err) {
			console.error("Error deleting:", err);
			alert("Failed to delete plan");
		}
	};

	useEffect(() => {
		if (autoOpenRunId) {
			fetchRunDetails(autoOpenRunId);
		}
	}, [autoOpenRunId]);

	useEffect(() => {
		const fetchAllRuns = async () => {
			try {
				const res = await fetch("http://localhost:8000/get_all_runs");
				if (!res.ok) throw new Error("Failed to fetch all runs");
				const data = await res.json();
				setAllRuns(
					data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
				);
			} catch (err) {
				console.error("Error fetching runs:", err);
			}
		};
		fetchAllRuns();
	}, []);

	return (
		<div className="page">
			<div>
				<h1>Optimized Plans</h1>
				<p>Manage and activate your finalized route configurations.</p>
			</div>
			<section>
				<div className=" table-card">
					<table className="styled-table">
						<thead>
							<tr>
								<th>Plan Name</th>
								<th>Buses</th>
								<th>Date Created</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{allRuns.map((run) => (
								<tr key={run.run_id}>
									<td>
										{run.name}
										<br />
										<span className="table-subtext">
											{run.description || ""}
										</span>
									</td>
									<td>{run.buses_needed}</td>
									<td>{new Date(run.timestamp).toLocaleString()}</td>
									<td>
										{run.is_published ? (
											<span className="status active">✓ Published</span>
										) : (
											<span className="status inactive">Draft</span>
										)}
									</td>
									<td className="actions">
										<button
											title="Preview"
											className="icon-btn"
											onClick={() => {
												if (savedPlan === run.run_id) {
													setSavedPlan(null);
													setMapUrl(null);
													setRouteDetails([]);
													setOverview([]);
													setPlanName(null);
												} else {
													fetchRunDetails(run.run_id);
												}
											}}
										>
											<Eye size={16} />
										</button>
										{!run.is_published && (
											<button
												className="activate-btn"
												onClick={() => publishPlan(run.run_id)}
											>
												Publish
											</button>
										)}
										<button
											className="delete-btn"
											onClick={() => handleDelete(run.run_id)}
										>
											<Trash2 size={16} />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{mapUrl && (
				<section>
					<div className="map-preview-header">
						<h3>{planName ? `${planName} — Map Preview` : "Map Preview"}</h3>

						<div className="map-selector-container">
							<label htmlFor="map-selector">View:</label>
							<select
								id="map-selector"
								value={selectedMapView}
								onChange={handleMapSelection}
							>
								<option value="all">All Routes (Overview)</option>
								{routeDetails.map((route) => (
									<option key={route.bus_number} value={route.bus_number}>
										Route {route.bus_number} ({route.total_students} students)
									</option>
								))}
							</select>
						</div>
					</div>

					<div className="card">
						{currentMapUrl ? (
							<iframe
								src={currentMapUrl}
								title="Route Map"
								style={{
									width: "100%",
									height: "500px",
									border: "none",
									borderRadius: "10px",
								}}
							/>
						) : (
							<div
								style={{
									padding: "40px",
									textAlign: "center",
									color: "#777",
									backgroundColor: "#f9f9f9",
									borderRadius: "10px",
								}}
							>
								<p>No map available for this route</p>
							</div>
						)}
					</div>
				</section>
			)}

			{routeDetails.length > 0 && (
				<section className="table-card">
					<table className="styled-table">
						<thead>
							<tr>
								<th></th>
								<th>Bus #</th>
								<th>Stops</th>
								<th>Total Students</th>
								<th>Distance (km)</th>
								<th>Estimated Time (min)</th>
							</tr>
						</thead>
						<tbody>
							{routeDetails.map((bus, index) => (
								<React.Fragment key={index}>
									<tr
										onClick={() => toggleRow(bus.bus_number)}
										style={{ cursor: "pointer" }}
									>
										<td style={{ padding: "8px" }}>
											{expandedRows.includes(bus.bus_number) ? (
												<ChevronDown size={18} />
											) : (
												<ChevronRight size={18} />
											)}
										</td>
										<td>{bus.bus_number}</td>
										<td>{bus.stops.length}</td>
										<td>{bus.total_students}</td>
										<td>{bus.total_distance_km}</td>
										<td>{Math.round(bus.estimated_duration_hr * 60)}</td>
									</tr>

									{expandedRows.includes(bus.bus_number) && (
										<tr>
											<td colSpan="6" className="stop-details-container">
												{bus.stops.map((stop) => (
													<div key={stop.stop_id} className="stop-card">
														<div className="stop-header">
															<div className="stop-number">
																Stop {stop.sequence_number}
															</div>
															<div className="stop-address">{stop.address}</div>
															<div className="stop-coordinates">
																({stop.latitude}, {stop.longitude})
															</div>
														</div>

														<ul className="students-list">
															{stop.students?.length > 0 ? (
																stop.students.map((s) => (
																	<li key={s.student_id}>{s.name}</li>
																))
															) : (
																<li className="no-students">No students</li>
															)}
														</ul>
													</div>
												))}
											</td>
										</tr>
									)}
								</React.Fragment>
							))}
						</tbody>
					</table>
				</section>
			)}
		</div>
	);
}

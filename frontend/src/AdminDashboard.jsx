/*
	- Fetches and displays an overview of the current published route optimization plan
	- Shows key statistics in a dashboard format for quick insights for busy individuals
	- Integrates a performance graph based on user feedback & preview of routes map
*/

import React, { useState, useEffect } from "react";
import {
	Users,
	MapPin,
	Bus,
	User,
	Ruler,
	Route,
	ArrowBigUp,
	ArrowBigDown,
} from "lucide-react";
import "./index.css";
import RatingDistributionChart from "./RatingDistributionChart";

export default function AdminDashboard({ onNavigate }) {
	const [hasPlan, setHasPlan] = useState(false);
	const [isPublishedPlan, setIsPublishedPlan] = useState(false);
	const [savedPlan, setSavedPlan] = useState(null);
	const [planName, setPlanName] = useState(null);
	const [mapUrl, setMapUrl] = useState(null);
	const [overview, setOverview] = useState([]);
	const [routeDetails, setRouteDetails] = useState([]);
	const [feedbackData, setFeedbackData] = useState([]);

	const overloaded = overview.find(
		(o) => o.Metric === "Overloaded Buses",
	)?.Value;
	const underutilized = overview.find(
		(o) => o.Metric === "Underutilized Buses",
	)?.Value;

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
			setPlanName(data.name || `Run ${runId}`);
			setSavedPlan(runId);
			setIsPublishedPlan(false);
		} catch (err) {
			console.error("Error loading run:", err);
		}
	};

	useEffect(() => {
		const fetchPublishedPlan = async () => {
			try {
				const response = await fetch("http://localhost:8000/get_published_run");
				if (response.status === 404) {
					setHasPlan(false);
					setIsPublishedPlan(false);
					return;
				}
				if (!response.ok) throw new Error("Failed to fetch published plan");

				const data = await response.json();
				if (!data || !data.route_details || data.route_details.length === 0) {
					setHasPlan(false);
					setIsPublishedPlan(false);
					return;
				}

				setOverview(data.overview || []);
				setRouteDetails(data.route_details || []);
				setMapUrl(
					data.map_path ? `http://localhost:8000/${data.map_path}` : null,
				);
				setPlanName(data.name || `Run ${runId}`);
				setSavedPlan(data.run_id);
				setHasPlan(true);
				setIsPublishedPlan(true);
			} catch (error) {
				console.error("Error loading published plan:", error);
				setHasPlan(false);
				setIsPublishedPlan(false);
			}
		};

		fetchPublishedPlan();
	}, []);

	useEffect(() => {
		async function fetchFeedback() {
			try {
				const res = await fetch("http://localhost:8000/feedback/all");
				const data = await res.json();
				const published = Array.isArray(data)
					? data.filter((f) => f.is_published_feedback)
					: [];
				setFeedbackData(published);
			} catch (err) {
				console.error("Error loading feedback:", err);
				setFeedbackData([]);
			}
		}
		fetchFeedback();
	}, []);

	return (
		<div className="page">
			<div>
				<h1>Mission Control</h1>
				<p>Welcome back! Here's your route optimization overview.</p>
			</div>

			<section className="card plan-card">
				<h3>Current Plan: {planName ? planName : "no plan"} </h3>
			</section>

			{overview.length > 0 && (
				<section>
					<h3>Overview Statistics</h3>
					<div className="stats-grid">
						<StatCard
							title="Total Bus Riders"
							value={
								overview.find((o) => o.Metric === "Total Students")?.Value || 0
							}
							icon={<Users />}
							gradient="linear-gradient(135deg, #49CE7A, #39B360)"
						/>
						<StatCard
							title="Total Buses"
							value={
								overview.find((o) => o.Metric === "Total Buses")?.Value || 0
							}
							icon={<Bus />}
							gradient="linear-gradient(135deg, #1F5EFF, #464DAB)"
						/>
						<StatCard
							title="Total Stops"
							value={
								overview.find((o) => o.Metric === "Total Stops")?.Value || 0
							}
							icon={<MapPin />}
							gradient="linear-gradient(135deg, #9514FF, #8061D6)"
						/>
						<StatCard
							title="Average Students per Stop"
							value={
								overview.find((o) => o.Metric === "Average Students per Stop")
									?.Value || 0
							}
							icon={<User />}
							gradient="linear-gradient(135deg, #E51029, #AB4650)"
						/>
						<StatCard
							title="Total Route Distance (km)"
							value={
								overview.find((o) => o.Metric === "Total Route Distance (km)")
									?.Value || 0
							}
							icon={<Ruler />}
							gradient="linear-gradient(135deg, #49CE7A, #39B360)"
						/>
						<StatCard
							title="Average Route Distance (km)"
							value={
								overview.find((o) => o.Metric === "Average Route Distance (km)")
									?.Value || 0
							}
							icon={<Route />}
							gradient="linear-gradient(135deg, #1F5EFF, #464DAB)"
						/>
						<StatCard
							title="Overloaded Buses"
							value={overloaded?.count ?? overloaded ?? 0}
							icon={<ArrowBigUp />}
							gradient="linear-gradient(135deg, #9514FF, #8061D6)"
						/>
						<StatCard
							title="Underutilized Buses"
							value={underutilized?.count ?? underutilized ?? 0}
							icon={<ArrowBigDown />}
							gradient="linear-gradient(135deg, #E51029, #AB4650)"
						/>
					</div>
				</section>
			)}

			<div className="dashboard-grid">
				<section className="card">
					<h3>Performance Graph</h3>
					<div>
						<RatingDistributionChart feedback={feedbackData} />
					</div>
				</section>

				<section className="card small-card">
					<h3>Created Routes</h3>
					{mapUrl ? (
						<iframe
							src={mapUrl}
							title="Published Plan Map"
							style={{
								width: "100%",
								height: "200px",
								border: "none",
								borderRadius: "10px",
								marginTop: "10px",
							}}
						/>
					) : (
						<div className="small-chart-placeholder">No map available</div>
					)}

					<button
						className="primary-button"
						onClick={() => {
							onNavigate("optimization", savedPlan);
						}}
					>
						View All Routes
					</button>
				</section>
			</div>

			<section className="cta-card">
				<div className="cta-text">
					<h3>Ready to optimize?</h3>
					<p>
						Upload new student data and generate optimized routes in minutes.
					</p>
				</div>
				<button className="cta-button" onClick={() => onNavigate("upload")}>
					Generate New Optimization
				</button>
			</section>
		</div>
	);
}

const StatCard = ({ title, value, icon, gradient }) => (
	<div className="stat-card">
		<div className="stat-icon-rect" style={{ backgroundImage: gradient }}>
			{icon && React.cloneElement(icon, { className: "stat-icon-inner" })}
		</div>
		<div>
			<p className="stat-value">{value}</p>
			<p className="stat-label">{title}</p>
		</div>
	</div>
);

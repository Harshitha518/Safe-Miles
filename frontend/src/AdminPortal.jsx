/*
  - Main admin portal component
  - Manages navigation between different admin sections
  - Handles admin logout and passes necessary props to child components
*/

import { useState } from "react";
import AdminDashboard from "./AdminDashboard";
import DataUpload from "./DataUpload";
import OptimizationRuns from "./OptimizationRuns";
import RealtimeFeedback from "./RealTimeFeedback";
import logo from "./assets/logo.png";
import "./index.css";

export default function AdminPortal({ onAuthChange }) {
	const [activeTab, setActiveTab] = useState("dashboard");
	const [autoOpenRunId, setAutoOpenRunId] = useState(null);

	const handleLogout = () => {
		onAuthChange({ role: null, student: null });
		localStorage.removeItem("auth");
	};

	const handleNavigate = (tab, runId = null) => {
		setActiveTab(tab);
		setAutoOpenRunId(runId);
	};

	return (
		<div className="admin-layout">
			<header className="dashboard-header">
				<div className="header-logo-container">
					<img
						src={logo}
						alt="Safe Miles Logo"
						className="header-logo"
					/>
					<h1>Safe Miles</h1>
				</div>
				<button className="primary-button" onClick={handleLogout}>
					Logout
				</button>
			</header>

			<div className="admin-body">
				<aside className="sidebar sidebar-nav">
					<button
						className={`sidebar-btn ${activeTab === "dashboard" ? "active" : ""}`}
						onClick={() => setActiveTab("dashboard")}
					>
						Dashboard
					</button>

					<button
						className={`sidebar-btn ${activeTab === "upload" ? "active" : ""}`}
						onClick={() => setActiveTab("upload")}
					>
						Create Plan
					</button>

					<button
						className={`sidebar-btn ${activeTab === "optimization" ? "active" : ""}`}
						onClick={() => setActiveTab("optimization")}
					>
						Optimized Plans
					</button>

					<button
						className={`sidebar-btn ${activeTab === "realtime" ? "active" : ""}`}
						onClick={() => setActiveTab("realtime")}
					>
						Feedback Analysis
					</button>
				</aside>

				<main className="main-content">
					{activeTab === "dashboard" && (
						<AdminDashboard onNavigate={handleNavigate} />
					)}
					{activeTab === "upload" && (
						<DataUpload
							onPublish={(runId) => {
								setActiveTab("optimization");
								setAutoOpenRunId(runId);
							}}
						/>
					)}

					{activeTab === "optimization" && (
						<OptimizationRuns autoOpenRunId={autoOpenRunId} />
					)}
					{activeTab === "realtime" && <RealtimeFeedback />}
				</main>
			</div>
		</div>
	);
}

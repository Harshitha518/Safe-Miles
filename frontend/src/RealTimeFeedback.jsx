/* 
    - Displays real time student feedback and satisfaction metrics
    - Shows summary metriccs for quick overview
    - Visualizes rating distributions, bus crowdedness, & top positive/negative factors
    - Allows viewing of individual feedback enteries & bus summaries
    - Supports actionable insights for improving student experience and safety
*/

import React, { useEffect, useState } from "react";
import {
	ChevronDown,
	ChevronRight,
	TrendingUp,
	AlertCircle,
	ThumbsUp,
	Clock,
	MessageSquare,
} from "lucide-react";
import {
	Tooltip,
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
} from "recharts";
import RatingDistributionChart from "./RatingDistributionChart";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
const RATING_COLORS = {
	Excellent: "#10b981",
	Great: "#3b82f6",
	Good: "#f59e0b",
	Fair: "#ef4444",
	Poor: "#7f1d1d",
};

export default function RealTimeFeedback() {
	const [allFeedback, setAllFeedback] = useState([]);
	const [graphData, setGraphData] = useState([]);

	const [loading, setLoading] = useState(true);
	const [expandedBuses, setExpandedBuses] = useState([]);

	useEffect(() => {
		async function fetchFeedback() {
			try {
				const res = await fetch("http://localhost:8000/feedback/all");
				const data = await res.json();
				const allData = Array.isArray(data) ? data : [];

				setAllFeedback(allData);

				const publishedFeedback = allData.filter(
					(fb) => fb.is_published_feedback === true,
				);

				setGraphData(publishedFeedback);
			} catch (err) {
				console.error(err);
				setAllFeedback([]);
				setGraphData([]);
			} finally {
				setLoading(false);
			}
		}
		fetchFeedback();
	}, []);

	const toggleBus = (bus) => {
		setExpandedBuses((prev) =>
			prev.includes(bus) ? prev.filter((b) => b !== bus) : [...prev, bus],
		);
	};

	if (loading) {
		return (
			<div className="feedback-loading">
				<div className="feedback-loading-text">Loading feedback data...</div>
			</div>
		);
	}

	if (!allFeedback.length) {
		return (
			<div className="feedback-empty">
				<AlertCircle size={48} className="feedback-empty-icon" />
				<div className="feedback-empty-text">No feedback submitted yet</div>
			</div>
		);
	}

	const totalFeedback = graphData.length;
	const avgRating =
		graphData.reduce((acc, f) => {
			const ratings = { Excellent: 5, Great: 4, Good: 3, Fair: 2, Poor: 1 };
			return acc + (ratings[f.rating] || 0);
		}, 0) / (totalFeedback || 1);

	const positiveCount = graphData.filter((f) =>
		["Excellent", "Great", "Good"].includes(f.rating),
	).length;

	const negativeCount = graphData.filter((f) =>
		["Fair", "Poor"].includes(f.rating),
	).length;

	const ratingCounts = graphData.reduce((acc, f) => {
		acc[f.rating] = (acc[f.rating] || 0) + 1;
		return acc;
	}, {});
	const ratingData = Object.entries(ratingCounts).map(([rating, count]) => ({
		rating,
		count,
	}));

	const crowdednessCounts = graphData.reduce((acc, f) => {
		const level = f.crowdedness || "Unknown";
		acc[level] = (acc[level] || 0) + 1;
		return acc;
	}, {});
	const crowdednessData = Object.entries(crowdednessCounts).map(
		([level, count]) => ({ level, count }),
	);

	const allOptions = graphData.flatMap((f) => f.options || []);
	const optionCounts = allOptions.reduce((acc, opt) => {
		acc[opt] = (acc[opt] || 0) + 1;
		return acc;
	}, {});

	const positiveOptions = [
		"Bus arrived on time",
		"Safe and smooth driving",
		"Clean and comfortable",
		"Friendly driver",
	];
	const issueOptions = [
		"Bus was late",
		"Overcrowded",
		"Safety concern",
		"Route issue",
		"Uncomfortable ride",
	];

	const topPositives = Object.entries(optionCounts)
		.filter(([opt]) => positiveOptions.includes(opt))
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);

	const topIssues = Object.entries(optionCounts)
		.filter(([opt]) => issueOptions.includes(opt))
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);

	const feedbackByBus = graphData.reduce((acc, f) => {
		const bus = f.bus_number ? `Bus ${f.bus_number}` : "Other (Walkers)";
		if (!acc[bus]) acc[bus] = [];
		acc[bus].push(f);
		return acc;
	}, {});

	const sortedBuses = Object.entries(feedbackByBus).sort(
		(a, b) => b[1].length - a[1].length,
	);

	const walkerFeedback = graphData.filter((f) => {
		const metadata = f.extra_metadata || {};
		return metadata.is_walker === true;
	});

	const busRiderFeedback = graphData.filter((f) => {
		const metadata = f.extra_metadata || {};
		return !metadata.is_walker;
	});

	const walkerAvgRating =
		walkerFeedback.length > 0
			? walkerFeedback.reduce((acc, f) => {
					const ratings = { Excellent: 5, Great: 4, Good: 3, Fair: 2, Poor: 1 };
					return acc + (ratings[f.rating] || 0);
				}, 0) / walkerFeedback.length
			: 0;

	return (
		<div className="page">
			<div>
				<div>
					<h1>Feedback Dashboard</h1>
					<p>Real-time student feedback and satisfaction metrics</p>
				</div>

				<div className="feedback-summary-grid">
					<div className="feedback-stat-card">
						<div className="feedback-stat-content">
							<div className="feedback-stat-icon blue">
								<MessageSquare size={24} />
							</div>
							<div className="feedback-stat-text">
								<div className="feedback-stat-label">Total Feedback</div>
								<div className="feedback-stat-value">{totalFeedback}</div>
							</div>
						</div>
					</div>

					<div className="feedback-stat-card">
						<div className="feedback-stat-content">
							<div className="feedback-stat-icon purple">
								<TrendingUp size={24} />
							</div>
							<div className="feedback-stat-text">
								<div className="feedback-stat-label">Avg Rating</div>
								<div className="feedback-stat-value">
									{totalFeedback > 0 ? `${avgRating.toFixed(1)}/5` : "N/A"}
								</div>
							</div>
						</div>
					</div>

					<div className="feedback-stat-card">
						<div className="feedback-stat-content">
							<div className="feedback-stat-icon green">
								<ThumbsUp size={24} />
							</div>
							<div className="feedback-stat-text">
								<div className="feedback-stat-label">Positive</div>
								<div className="feedback-stat-value green">{positiveCount}</div>
							</div>
						</div>
					</div>

					<div className="feedback-stat-card">
						<div className="feedback-stat-content">
							<div className="feedback-stat-icon red">
								<AlertCircle size={24} />
							</div>
							<div className="feedback-stat-text">
								<div className="feedback-stat-label">Issues</div>
								<div className="feedback-stat-value red">{negativeCount}</div>
							</div>
						</div>
					</div>
				</div>

				<div className="feedback-charts-grid">
					<div className="feedback-chart-card">
						<h3>Rating Distribution</h3>
						<RatingDistributionChart feedback={graphData} />
					</div>

					<div className="feedback-chart-card">
						<h3>Bus Crowdedness</h3>
						{graphData.length === 0 ? (
							<div className="feedback-chart-empty">
								No published feedback data
							</div>
						) : (
							<ResponsiveContainer width="100%" height={250}>
								<PieChart>
									<Pie
										data={crowdednessData}
										dataKey="count"
										nameKey="level"
										cx="50%"
										cy="50%"
										outerRadius={80}
										label={(entry) => `${entry.level}: ${entry.count}`}
									>
										{crowdednessData.map((entry, index) => (
											<Cell
												key={entry.level}
												fill={COLORS[index % COLORS.length]}
											/>
										))}
									</Pie>
									<Tooltip />
								</PieChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>

				<div className="feedback-top-items-grid">
					<div className="feedback-top-card">
						<h3 className="feedback-top-header">
							<ThumbsUp size={20} style={{ color: "#10b981" }} />
							Top Positives
						</h3>
						<div className="feedback-top-list">
							{topPositives.length === 0 && (
								<div className="feedback-no-data">
									No positive options selected
								</div>
							)}
							{topPositives.map(([option, count]) => (
								<div key={option} className="feedback-top-item positive">
									<span className="feedback-top-item-label">{option}</span>
									<span className="feedback-top-item-count">{count}</span>
								</div>
							))}
						</div>
					</div>

					<div className="feedback-top-card">
						<h3 className="feedback-top-header">
							<AlertCircle size={20} style={{ color: "#ef4444" }} />
							Top Issues
						</h3>
						<div className="feedback-top-list">
							{topIssues.length === 0 && (
								<div className="feedback-no-data">No issues selected</div>
							)}
							{topIssues.map(([option, count]) => (
								<div key={option} className="feedback-top-item negative">
									<span className="feedback-top-item-label">{option}</span>
									<span className="feedback-top-item-count">{count}</span>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="feedback-bus-section">
					<h2>Feedback by Bus</h2>

					{sortedBuses.length === 0 && (
						<div className="feedback-no-data">
							No published feedback has been submitted for any bus.
						</div>
					)}

					{sortedBuses.map(([busName, busFeedback]) => {
						const isExpanded = expandedBuses.includes(busName);
						const busAvgRating =
							busFeedback.reduce((acc, f) => {
								const ratings = {
									Excellent: 5,
									Great: 4,
									Good: 3,
									Fair: 2,
									Poor: 1,
								};
								return acc + (ratings[f.rating] || 0);
							}, 0) / (busFeedback.length || 1);

						return (
							<div key={busName} className="feedback-bus-item">
								<div
									className="feedback-bus-header"
									onClick={() => toggleBus(busName)}
								>
									<div className="feedback-bus-title">
										<div className="feedback-bus-name">{busName}</div>
										<div className="feedback-bus-meta">
											<span>{busFeedback.length} responses</span>
											<span>•</span>
											<span>Avg: {busAvgRating.toFixed(1)}/5</span>
										</div>
									</div>
									{isExpanded ? (
										<ChevronDown size={20} />
									) : (
										<ChevronRight size={20} />
									)}
								</div>

								{isExpanded && (
									<div className="feedback-bus-content">
										<div className="feedback-entries">
											{busFeedback.map((f, idx) => (
												<div
													key={idx}
													className={`feedback-entry rating-${f.rating?.toLowerCase() || "unknown"}`}
												>
													<div className="feedback-entry-header">
														<div className="feedback-entry-left">
															<span
																className={`feedback-rating-badge ${f.rating?.toLowerCase() || "unknown"}`}
															>
																{f.rating}
															</span>
															{f.student_id && (
																<span className="feedback-student-id">
																	Student: {f.student_id}
																</span>
															)}
														</div>
														{f.boarding_time && (
															<span className="feedback-time">
																<Clock size={14} /> {f.boarding_time}
															</span>
														)}
													</div>

													{f.stop && (
														<div className="feedback-stop">{f.stop}</div>
													)}

													{f.options && f.options.length > 0 && (
														<div className="feedback-options">
															{f.options.map((opt, i) => {
																const isPositive =
																	positiveOptions.includes(opt);
																return (
																	<span
																		key={i}
																		className={`feedback-option-tag ${isPositive ? "positive" : "negative"}`}
																	>
																		{opt}
																	</span>
																);
															})}
														</div>
													)}

													<div className="feedback-details">
														{f.wait_time && (
															<span> Wait: {f.wait_time} min</span>
														)}
														{f.crowdedness && (
															<span>{f.crowdedness} crowdedness</span>
														)}
													</div>

													{f.comment && (
														<div
															className={`feedback-comment ${f.comment.length < 10 ? "short" : ""}`}
														>
															"{f.comment}"
														</div>
													)}
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

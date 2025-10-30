/* 
    - Collects feedback from students on their daily commute (bus & walk)
    - Optional comments field for specifc details, complains, or suggestions
    - Empowers students to share their experience and improve service quality
*/

import React, { useState, useEffect } from "react";
import {
	Frown,
	Meh,
	Smile,
	SmilePlus,
	PartyPopper,
	Clock,
	Shield,
	Sparkles,
	HandHeart,
	AlertCircle,
	Users,
	AlertTriangle,
	MapPin,
	ThumbsDown,
	Footprints,
	Sun,
	TreePine,
} from "lucide-react";

import "./index.css";

export default function Feedback({ onBack, userId }) {
	const [rating, setRating] = useState(null);
	const [route, setRoute] = useState("");
	const [routeId, setRouteId] = useState(null);
	const [runId, setRunId] = useState(null);
	const [busNumber, setBusNumber] = useState(null);
	const [stop, setStop] = useState("");
	const [boardingTime, setBoardingTime] = useState("");
	const [waitTime, setWaitTime] = useState("");
	const [crowdedness, setCrowdedness] = useState("");
	const [positives, setPositives] = useState([]);
	const [issues, setIssues] = useState([]);
	const [comments, setComments] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [loadingTrip, setLoadingTrip] = useState(true);
	const [isWalker, setIsWalker] = useState(false);

	const emojis = [
		{ label: "Poor", icon: Frown, colorClass: "poor" },
		{ label: "Fair", icon: Meh, colorClass: "fair" },
		{ label: "Good", icon: Smile, colorClass: "good" },
		{ label: "Great", icon: SmilePlus, colorClass: "great" },
		{ label: "Excellent", icon: PartyPopper, colorClass: "excellent" },
	];

	const positiveOptions = [
		{ label: "Bus arrived on time", icon: Clock, busOnly: true },
		{ label: "Safe and smooth driving", icon: Shield, busOnly: true },
		{ label: "Clean and comfortable", icon: Sparkles, busOnly: true },
		{ label: "Friendly driver", icon: HandHeart, busOnly: true },
		{ label: "Safe walking route", icon: Shield, walkerOnly: true },
		{ label: "Good sidewalks", icon: Footprints, walkerOnly: true },
		{ label: "Well-lit path", icon: Sun, walkerOnly: true },
		{ label: "Pleasant environment", icon: TreePine, walkerOnly: true },
	];

	const issueOptions = [
		{ label: "Bus was late", icon: AlertCircle, busOnly: true },
		{ label: "Overcrowded", icon: Users, busOnly: true },
		{ label: "Safety concern", icon: AlertTriangle, busOnly: false },
		{ label: "Route issue", icon: MapPin, busOnly: false },
		{ label: "Uncomfortable ride", icon: ThumbsDown, busOnly: true },
		{ label: "No sidewalk available", icon: AlertTriangle, walkerOnly: true },
		{ label: "Heavy traffic areas", icon: AlertCircle, walkerOnly: true },
		{ label: "Poor lighting", icon: AlertTriangle, walkerOnly: true },
	];

	useEffect(() => {
		async function fetchTrip() {
			try {
				const res = await fetch(`http://localhost:8000/current_trip/${userId}`);
				if (!res.ok) throw new Error("Failed to fetch trip info");
				const data = await res.json();

				const walker = !data.bus_number || data.message?.includes("walker");
				setIsWalker(walker);

				if (walker) {
					setRoute("Walker");
					setStop("Walking to school");
				} else {
					setRoute(
						data.bus_number ? `Bus ${data.bus_number}` : "Unknown Route",
					);
					setStop(data.stop?.address || "Unknown Stop");
					setRouteId(data.route_id || null);
					setBusNumber(data.bus_number || null);
				}
				setRunId(data.run_id || null);
			} catch (err) {
				console.error(err);
				setRoute("");
				setRouteId(null);
				setStop("");
				setBusNumber(null);
				setRunId(null);
				setIsWalker(false);
			} finally {
				setLoadingTrip(false);
			}
		}
		fetchTrip();
	}, [userId]);

	const handlePositiveToggle = (label) => {
		setPositives((prev) =>
			prev.includes(label) ? prev.filter((o) => o !== label) : [...prev, label],
		);
	};

	const handleIssueToggle = (label) => {
		setIssues((prev) =>
			prev.includes(label) ? prev.filter((o) => o !== label) : [...prev, label],
		);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!rating) {
			alert("Please provide a rating.");
			return;
		}

		if (!isWalker && !boardingTime) {
			alert("Please provide your pickup time.");
			return;
		}

		const payload = {
			user_id: userId,
			route_id: routeId,
			run_id: runId,
			bus_number: busNumber,
			rating,
			options: [...positives, ...issues],
			comment: comments,
			stop: isWalker ? "Walker - N/A" : stop,
			boarding_time: boardingTime || null,
			wait_time: waitTime || null,
			crowdedness: crowdedness || null,
			metadata: {
				timestamp: new Date().toISOString(),
				is_walker: isWalker,
			},
		};

		setSubmitting(true);

		try {
			const res = await fetch("http://localhost:8000/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(`Failed to submit feedback: ${res.status} ${text}`);
			}

			alert(
				`Thank you for your feedback${isWalker ? " on your walking experience" : ""}!`,
			);
			setRating(null);
			setBoardingTime("");
			setWaitTime("");
			setCrowdedness("");
			setPositives([]);
			setIssues([]);
			setComments("");
			onBack();
		} catch (err) {
			console.error(err);
			alert("Could not submit feedback. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	if (loadingTrip) {
		return (
			<div className="stu-feedback-loading-container">
				<div className="stu-feedback-loading-text">Loading your info...</div>
			</div>
		);
	}

	const filteredPositives = positiveOptions.filter((opt) =>
		isWalker ? !opt.busOnly : !opt.walkerOnly,
	);

	const filteredIssues = issueOptions.filter((opt) =>
		isWalker ? !opt.busOnly : !opt.walkerOnly,
	);

	return (
		<div className="stu-feedback-form-page">
			<div className="stu-feedback-form-container">
				<button onClick={onBack} className="stu-feedback-back-button">
					← Back
				</button>

				<div>
					<h1>
						{isWalker ? "How was your walk today?" : "How was your ride today?"}
					</h1>
					<p>
						{isWalker
							? "Your feedback helps us understand walking conditions and safety!"
							: "Your feedback helps us optimize routes and improve service!"}
					</p>
				</div>

				<form onSubmit={handleSubmit}>
					{!isWalker && (
						<div className="stu-feedback-section">
							<h3 className="stu-feedback-section-title">Trip Information</h3>
							<div className="stu-feedback-trip-grid">
								<div className="stu-feedback-field">
									<label className="stu-feedback-label">Pickup Time *</label>
									<input
										type="time"
										value={boardingTime}
										onChange={(e) => setBoardingTime(e.target.value)}
										className="stu-feedback-input"
										required
									/>
								</div>
								<div className="stu-feedback-field">
									<label className="stu-feedback-label">Wait Time (mins)</label>
									<input
										type="number"
										value={waitTime}
										onChange={(e) => setWaitTime(e.target.value)}
										placeholder="ex. 5"
										min="0"
										className="stu-feedback-input"
									/>
								</div>
							</div>
						</div>
					)}

					<div className="stu-feedback-section">
						<h3 className="stu-feedback-section-title">Overall Experience *</h3>
						<div className="stu-feedback-rating-grid">
							{emojis.map((item) => {
								const IconComponent = item.icon;
								return (
									<button
										key={item.label}
										type="button"
										onClick={() => setRating(item.label)}
										className={`stu-feedback-rating-button ${rating === item.label ? "active" : ""}`}
									>
										<IconComponent
											className={`stu-feedback-rating-icon ${item.colorClass}`}
										/>
										<span className="stu-feedback-rating-label">
											{item.label}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{!isWalker && (
						<div className="stu-feedback-section">
							<h3 className="stu-feedback-section-title">
								How crowded was the bus?
							</h3>
							<div className="stu-feedback-crowdedness-grid">
								{["Low", "Moderate", "High"].map((level) => (
									<button
										key={level}
										type="button"
										onClick={() => setCrowdedness(level)}
										className={`stu-feedback-crowdedness-button ${crowdedness === level ? "active" : ""}`}
									>
										{level}
									</button>
								))}
							</div>
						</div>
					)}

					<div className="stu-feedback-section">
						<h3 className="stu-feedback-section-title">What went well?</h3>
						<div className="stu-feedback-options-list">
							{filteredPositives.map((item) => {
								const IconComponent = item.icon;
								return (
									<label
										key={item.label}
										className={`stu-feedback-option-item ${positives.includes(item.label) ? "positive-checked" : ""}`}
									>
										<input
											type="checkbox"
											checked={positives.includes(item.label)}
											onChange={() => handlePositiveToggle(item.label)}
											className="stu-feedback-checkbox"
										/>
										<IconComponent
											className="stu-feedback-option-icon-svg"
											size={20}
										/>
										<span className="stu-feedback-option-label">
											{item.label}
										</span>
									</label>
								);
							})}
						</div>
					</div>

					<div className="stu-feedback-section">
						<h3 className="stu-feedback-section-title">
							Any issues to report?
						</h3>
						<div className="stu-feedback-options-list">
							{filteredIssues.map((item) => {
								const IconComponent = item.icon;
								return (
									<label
										key={item.label}
										className={`stu-feedback-option-item ${issues.includes(item.label) ? "issue-checked" : ""}`}
									>
										<input
											type="checkbox"
											checked={issues.includes(item.label)}
											onChange={() => handleIssueToggle(item.label)}
											className="stu-feedback-checkbox"
										/>
										<IconComponent
											className="stu-feedback-option-icon-svg"
											size={20}
										/>
										<span className="stu-feedback-option-label">
											{item.label}
										</span>
									</label>
								);
							})}
						</div>
					</div>

					<div className="stu-feedback-section">
						<h3 className="stu-feedback-section-title">
							Additional comments (optional)
						</h3>
						<textarea
							value={comments}
							onChange={(e) => setComments(e.target.value)}
							placeholder={
								isWalker
									? "Share any details about your walking experience, safety concerns, or suggestions..."
									: "Share any other details about your experience..."
							}
							className="stu-feedback-textarea"
						/>
					</div>

					<button
						type="submit"
						disabled={!rating || (!isWalker && !boardingTime) || submitting}
						className="stu-feedback-submit-button"
					>
						{submitting ? "Submitting..." : "Submit Feedback"}
					</button>
				</form>
			</div>
		</div>
	);
}

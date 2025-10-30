/*
    - Displays student information including name, bus number, & stop location
    - Accomodates for both transportation statuses: bus rider and walker
    - Provides daily safety tips tailored to bus riders & walkers to promote safety & awareness
    - Provides quick access to bus tracking & feedback features
*/

import { useEffect } from "react";
import {
	MapPin,
	Bus,
	Navigation,
	MessageCircle,
	AlertCircle,
	Footprints,
} from "lucide-react";

function StudentPortal({ onAuthChange, student, busStatus, onNavigate }) {
	const safetyTips = [
		"Walk on the side walk, or as close as the curb as possible.",
		"Walk on the left side of the road, facing traffic.",
		"Keep your eyes open for moving vehichles on driveways or side streets.",
		"While waiting for your bus to arrive, stay out of the street and watch for traffic.",
		"Wait for the bus to make a complete stop before getting on.",
		"When you get on the bus, go directly to your seat, remain seated during the entire ride, and keep all body parts and property inside the bus.",
		"Listen to your bus driver's instructions so that they can drive the bus safely.",
		"Make sure backpacks, sports equipment, instruments, and other items don't block the aisle or emergency exists",
		"If you have to cross the street, make sure to cross in front of the bus, where the driver can see you.",
	];

	const walkerTips = [
		"Always use sidewalks when available. If there's no sidewalk, walk facing traffic.",
		"Cross streets at crosswalks or intersections when possible.",
		"Look left, right, and left again before crossing any street.",
		"Make eye contact with drivers before crossing in front of vehicles.",
		"Never assume a driver sees you - always be cautious.",
		"Wear bright or reflective clothing, especially in early morning or evening.",
		"Put away your phone and remove headphones when walking near traffic.",
		"Follow all traffic signals and signs - they apply to pedestrians too!",
		"Walk in groups when possible and stay alert to your surroundings.",
	];

	const isWalker = !student?.bus_number || student?.message?.includes("walker");
	const tips = isWalker ? walkerTips : safetyTips;
	const dailyTip = tips[new Date().getDate() % tips.length];

	const gradients = [
		["#38bdf8", "#3b82f6"],
		["#f472b6", "#c084fc"],
		["#34d399", "#10b981"],
		["#facc15", "#f97316"],
		["#60a5fa", "#6366f1"],
	];

	const [from, to] = gradients[Math.floor(Math.random() * gradients.length)];

	useEffect(() => {
		document.documentElement.style.setProperty(
			"--avatar-gradient",
			`linear-gradient(to bottom right, ${from}, ${to})`,
		);
	}, [from, to]);

	const firstName = student?.name?.split(" ")[0] || "Student!";
	const initials = student?.name
		? student.name.split(" ")[0][0] + (student.name.split(" ")[1]?.[0] || "")
		: "";

	const handleLogout = () => {
		onAuthChange({ role: null, student: null });
		localStorage.removeItem("auth");
	};

	return (
		<div>
			<header className="dashboard-header">
				<div className="student-header-inner">
					<div className="student-info">
						<div className="student-avatar">{initials}</div>
						<div>
							<h2 className="student-greeting">Hi, {firstName}!</h2>
							<p className="student-grade">{student.name}</p>
						</div>
					</div>
					<button className="primary-button" onClick={handleLogout}>
						Logout
					</button>
				</div>
			</header>

			<div className="page">
				{isWalker ? (
					<section className="card">
						<div className="bus-card-content">
							<div className="bus-card-header">
								<div
									className="stat-icon-rect"
									style={{ backgroundColor: "#10b981" }}
								>
									<Footprints
										className="stat-icon-inner"
										style={{ color: "white" }}
									/>
								</div>
								<div>
									<p className="bus-label">Transportation Status</p>
									<p className="bus-number">Walker</p>
								</div>
							</div>

							<hr />

							<div className="bus-card-grid">
								<div className="bus-detail">
									<MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
									<div>
										<p className="bus-detail-label">Walking Distance</p>
										<p className="bus-detail-value">
											You live close enough to walk to school safely!
										</p>
									</div>
								</div>
							</div>

							<div
								style={{
									marginTop: "16px",
									padding: "12px",
									backgroundColor: "#d1fae5",
									borderRadius: "8px",
									border: "1px solid #10b981",
								}}
							>
								<p style={{ fontSize: "14px", color: "#047857", margin: 0 }}>
									✓ You do not need to take the bus. Please walk or arrange your
									own transportation to school.
								</p>
							</div>
						</div>
					</section>
				) : (
					<section className="card">
						<div className="bus-card-content">
							<div className="bus-card-header">
								<div
									className="stat-icon-rect"
									style={{ backgroundColor: "rgb(254, 183, 9)" }}
								>
									<Bus className="stat-icon-inner" />
								</div>
								<div>
									<p className="bus-label">Your Bus</p>
									<p className="bus-number">#{student.bus_number || "?"}</p>
								</div>
							</div>

							<hr />

							<div className="bus-card-grid">
								<div className="bus-detail">
									<MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
									<div>
										<p className="bus-detail-label">Your Stop</p>
										<p className="bus-detail-value">
											{student?.stop_location?.address
												? student.stop_location?.address
												: student?.stop_location?.latitude
													? `(${student.stop_location.latitude}, ${student.stop_location.longitude})`
													: "Not available"}
										</p>
									</div>
								</div>
							</div>
						</div>
					</section>
				)}

				{!isWalker && student?.route_map_path && (
					<section className="card">
						<h3>Your Route</h3>
						<iframe
							src={`http://localhost:8000/${student.route_map_path}`}
							title="Bus Route Map"
							className="w-full rounded-xl"
							style={{ height: "400px", border: "none" }}
						/>
					</section>
				)}

				<section className="card-grid">
					{!isWalker && (
						<section className="card" onClick={() => onNavigate("tracking")}>
							<div className="card-content">
								<div className="card-icon bg-blue">
									<Navigation className="card-icon-inner text-white" />
								</div>
								<p className="card-title">Bus Status</p>
								<p className="card-subtext">See where your bus is</p>
							</div>
						</section>
					)}

					<section className="card" onClick={() => onNavigate("feedback")}>
						<div className="card-content">
							<div className="card-icon bg-purple">
								<MessageCircle className="card-icon-inner text-white" />
							</div>
							<p className="card-title">Feedback</p>
							<p className="card-subtext">
								{isWalker
									? "Share your walking experience"
									: "Help us improve safety and comfort"}
							</p>
						</div>
					</section>
				</section>

				<section className="cta-card">
					<div className="cta-text">
						<h3>{isWalker ? "Walking Safety Tip" : "Bus Safety Tip"}</h3>
						<p>{dailyTip}</p>
					</div>
					<div className="cta-icon">
						{isWalker ? (
							<Footprints size={32} style={{ color: "#10b981" }} />
						) : (
							<AlertCircle size={32} style={{ color: "#feb709" }} />
						)}
					</div>
				</section>
			</div>
		</div>
	);
}

export default StudentPortal;

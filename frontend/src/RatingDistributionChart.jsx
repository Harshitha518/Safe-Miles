import React from "react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
	ResponsiveContainer,
	Cell,
} from "recharts";

export default function RatingDistributionChart({ feedback }) {
	if (!feedback || feedback.length === 0) {
		return (
			<div
				style={{
					height: 250,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#94a3b8",
				}}
			>
				No published feedback data
			</div>
		);
	}

	const ratingCounts = feedback.reduce((acc, f) => {
		acc[f.rating] = (acc[f.rating] || 0) + 1;
		return acc;
	}, {});

	const ratingData = Object.entries(ratingCounts).map(([rating, count]) => ({
		rating,
		count,
	}));

	const ratingOrder = ["Poor", "Fair", "Good", "Great", "Excellent"];
	ratingData.sort(
		(a, b) => ratingOrder.indexOf(a.rating) - ratingOrder.indexOf(b.rating),
	);

	const ratingColors = {
		Excellent: "#10b981",
		Great: "#22c55e",
		Good: "#84cc16",
		Fair: "#f97316",
		Poor: "#ef4444",
	};

	return (
		<ResponsiveContainer width="100%" height={250}>
			<BarChart data={ratingData}>
				<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
				<XAxis dataKey="rating" style={{ fontSize: "0.875rem" }} />
				<YAxis style={{ fontSize: "0.875rem" }} />
				<Tooltip />
				<Bar dataKey="count" radius={[8, 8, 0, 0]}>
					{ratingData.map((entry, index) => (
						<Cell
							key={`cell-${index}`}
							fill={ratingColors[entry.rating] || "#94a3b8"}
						/>
					))}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
}

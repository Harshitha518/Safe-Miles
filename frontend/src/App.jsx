/*
  - Root component of app
  - Handles authentication state (admin/student/not logged in)
  - Renders appropriate portal based on user role
*/

import { useState, useEffect } from "react";
import "./App.css";
import LoginPage from "./LoginPage";
import StudentPortal from "./StudentPortal";
import AdminPortal from "./AdminPortal";
import StudentFeedback from "./StudentFeedback";
import BusTracker from "./BusTracker";

function App() {
	const [auth, setAuth] = useState(() => {
		const storedAuth = localStorage.getItem("auth");
		return storedAuth
			? JSON.parse(storedAuth)
			: { role: null, student: null, publishedRun: null, busNum: null };
	});

	const [studentView, setStudentView] = useState("dashboard");
	const [adminView, setAdminView] = useState("dashboard");
	const [publishedRun, setPublishedRun] = useState(null);

	useEffect(() => {
		localStorage.setItem("auth", JSON.stringify(auth));
	}, [auth]);

	const handleLogin = (authData) => {
		setAuth(authData);
	};

	if (auth.role === null) return <LoginPage onAuthChange={handleLogin} />;
	else if (auth.role === "admin")
		return (
			<AdminPortal
				onAuthChange={handleLogin}
				setAdminView={setAdminView}
				setPublishedRun={setPublishedRun}
			/>
		);
	else if (auth.role === "student") {
		if (studentView === "feedback") {
			return (
				<StudentFeedback
					userId={auth.student?.student_id}
					onBack={() => setStudentView("dashboard")}
				/>
			);
		} else if (studentView === "tracking") {
			return (
				<BusTracker
					student={auth.student}
					onBack={() => setStudentView("dashboard")}
				/>
			);
		} else {
			return (
				<StudentPortal
					onAuthChange={handleLogin}
					student={auth.student}
					busStatus={{ status: "on-time", eta: 5 }}
					onNavigate={setStudentView}
				/>
			);
		}
	}
}

export default App;

/*
  - Handles login & signup for students and admins
  - Authenticates students and admins via backend API
  - Distinct flows for student login and admin login/signup
  - Provides landing page for portal selection & switched views accordingly 
*/

import { useState } from "react";
import "./index.css";
import logo from "./assets/logo.png";

export default function LoginPage({ onAuthChange }) {
	const [loginType, setLoginType] = useState(null);
	const [isSignup, setIsSignup] = useState(false);
	const [adminEmail, setAdminEmail] = useState("");
	const [studentId, setStudentId] = useState("");
	const [password, setPassword] = useState("");

	const handleStudentLogin = async () => {
		if (!studentId) {
			alert("Please enter your Student ID");
			return;
		}

		try {
			const response = await fetch(
				`http://localhost:8000/student/${studentId}`,
			);
			if (response.ok) {
				const studentData = await response.json();
				onAuthChange({ role: "student", student: studentData });
			} else {
				alert("Student not found");
			}
		} catch {
			alert("Connection error");
		}
	};

	const handleAdminAuth = async () => {
		if (!adminEmail || !password) {
			alert("Please enter both email and password");
			return;
		}

		const endpoint = isSignup
			? "http://localhost:8000/admin/signup"
			: "http://localhost:8000/admin/login";

		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: adminEmail, password }),
			});

			if (response.ok) {
				const data = await response.json();
				if (isSignup) {
					alert("Admin account created successfully!");
					setIsSignup(false);
				} else {
					const runResponse = await fetch(
						"http://localhost:8000/get_published_run",
					);
					const publishedRun = runResponse.ok ? await runResponse.json() : null;
					onAuthChange({ role: "admin", student: null, publishedRun });
				}
			} else {
				const error = await response.json();
				alert(error.detail || "Authentication failed");
			}
		} catch {
			alert("Connection error");
		}
	};

	if (!loginType) {
		return (
			<div className="landing-page">
				<div className="landing-content">
					<img src={logo} alt="Safe Miles Logo" className="landing-logo" />
					<h1 className="landing-title">Safe Miles</h1>
					<p className="landing-slogan">
						Protecting every student, one route at a time
					</p>

					<div className="landing-buttons">
						<button onClick={() => setLoginType("student")}>
							Student Portal
						</button>
						<button onClick={() => setLoginType("admin")}>Admin Portal</button>
					</div>
				</div>
			</div>
		);
	}

	if (loginType === "student")
		return (
			<div className="login-page">
				<div className="login-card">
					<img src={logo} alt="Safe Miles Logo" className="login-logo" />
					<h2 className="login-title">Student Login</h2>
					<p className="landing-slogan">Smart travel made simple and safe</p>

					<label>Student ID</label>
					<input
						value={studentId}
						onChange={(e) => setStudentId(e.target.value)}
						placeholder="Enter your Student ID"
					/>

					<button onClick={handleStudentLogin} className="login-button">
						Login
					</button>
					<button
						onClick={() => setLoginType(null)}
						className="secondary-button"
					>
						Back
					</button>
				</div>
			</div>
		);

	if (loginType === "admin")
		return (
			<div className="login-page">
				<div className="login-card">
					<img src={logo} alt="Safe Miles Logo" className="login-logo" />
					<h2 className="login-title">
						{isSignup ? "Admin Sign Up" : "Admin Login"}
					</h2>
					<p className="landing-slogan">
						AI powered route optimization and management
					</p>

					<label>Admin Email</label>
					<input
						type="email"
						value={adminEmail}
						onChange={(e) => setAdminEmail(e.target.value)}
						placeholder="Enter your email"
					/>

					<label>Password</label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Enter your password"
					/>

					<button onClick={handleAdminAuth} className="login-button">
						{isSignup ? "Sign Up" : "Login"}
					</button>

					<button
						onClick={() => setIsSignup(!isSignup)}
						className="secondary-button"
					>
						{isSignup ? "Switch to Login" : "Switch to Sign Up"}
					</button>

					<button
						onClick={() => setLoginType(null)}
						className="secondary-button"
					>
						Back
					</button>
				</div>
			</div>
		);
}

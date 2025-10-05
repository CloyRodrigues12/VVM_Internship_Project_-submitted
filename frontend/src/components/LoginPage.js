import React, { useState, useEffect } from "react";
import "./LoginPage.css";

const LoginPage = ({ onLoginSuccess }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [institutes, setInstitutes] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Fetch institutions for the registration form dropdown
  useEffect(() => {
    const fetchInstitutes = async () => {
      try {
        const response = await fetch("http://localhost:5000/institutes");
        if (response.ok) {
          const data = await response.json();
          setInstitutes(data);
        } else {
          // Non-critical error, the form can still be used
          console.error("Could not fetch the list of institutes.");
        }
      } catch (error) {
        console.error(
          `Network error while fetching institutes: ${error.message}`
        );
      }
    };
    fetchInstitutes();
  }, []);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok) {
        onLoginSuccess(data.token);
      } else {
        setError(data.error || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    const fullName = e.target.fullName.value;
    const username = e.target.username.value;
    const regEmail = e.target.email.value;
    const institution_code = e.target.institution.value;
    const regPassword = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (!validateEmail(regEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (regPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!institution_code) {
      setError("Please select your institution.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          username,
          email: regEmail,
          password: regPassword,
          institution_code,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        alert("Registration successful! Please proceed to log in.");
        setIsLoginView(true);
        setError("");
      } else {
        setError(data.error || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <div className="login-visual-panel">
        <div className="visual-content">
          <div className="logo-container">
            <img
              src="/logo_vvm2.png"
              alt="Vidya Vikas Mandal Logo"
              className="logo"
            />
          </div>
          <h1>VVM Analytics Suite</h1>
          <p>Empowering Academic Excellence Through Data.</p>
        </div>
      </div>
      <div className="login-form-panel">
        <div className="form-container">
          <h2>{isLoginView ? "Welcome Back" : "Create an Account"}</h2>
          <p className="form-subtitle">
            {isLoginView
              ? "Please sign in to continue"
              : "Get started by creating your account"}
          </p>

          {error && <div className="error-message">{error}</div>}

          {isLoginView ? (
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="form-button" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="input-group">
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  required
                  placeholder="e.g., John Doe"
                />
              </div>
              <div className="input-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  required
                  placeholder="e.g., johndoe"
                />
              </div>
              <div className="input-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div className="input-group">
                <label htmlFor="institution">Institution</label>
                <select id="institution" name="institution" required>
                  <option value="">Select your Institution</option>
                  {institutes.map((inst) => (
                    <option
                      key={inst.institution_code}
                      value={inst.institution_code}
                    >
                      {inst.institute_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  required
                  placeholder="Create a strong password"
                />
              </div>
              <div className="input-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  placeholder="Re-enter your password"
                />
              </div>
              <button type="submit" className="form-button" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}

          <div className="toggle-form">
            {isLoginView ? (
              <p>
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setIsLoginView(false);
                    setError("");
                  }}
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setIsLoginView(true);
                    setError("");
                  }}
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

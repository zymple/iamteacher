import React, { useState } from "react";
import '../App.css';
import '../Login.css';

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const msg = await res.text();
        setError(msg || "Login failed");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError("Something went wrong");
    }
  };

  return (
    <div className="app-container">
      <div className="page-title">
        <strong>Authentication</strong>
      </div>

      <form className="login-form" onSubmit={handleLogin}>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          placeholder="Enter your username"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="button-container">
          <button className="control-button idle" type="submit">
            Login
          </button>
        </div>
      </form>
    </div>
  );
}

export default Login;

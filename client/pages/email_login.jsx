import React, { useState } from "react";
import '../App.css';
import '../Login.css';

function EmailLogin() {
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
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
      <img src="/assets/iamteacher.svg" alt="Tutor Avatar" className="avatar" />
      <div className="text-container">
        <p className="tutor-name">AI English Tutor</p>
        <p className="tutor-description">Improve your English while still having fun!</p>
      </div>

      <form className="login-form" onSubmit={handleLogin}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="text"
          placeholder="Enter your email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        {error && 
        <p style={{ color: "red", fontSize: "12pt" }}>{error}</p>
        }
        <div className="button-container">
          <button className="control-button idle" type="submit">
            Login
          </button>
        </div>
      </form>
    </div>
  );
}

export default EmailLogin;

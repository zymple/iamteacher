import React, { useState, useEffect } from "react";
import '../css/App.css';
import '../css/Login.css';
import { Translate } from "../languages/TranslationsManager.jsx";

function EmailLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // why the hell can't i use react component with placeholder
  const [placeholders, setPlaceholders] = useState({
    email: "",
    password: ""
  });

  useEffect(() => { 
    const renderAndCapture = (key, callback) => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      import("react-dom").then(ReactDOM => {
        ReactDOM.render(<Translate>{key}</Translate>, container, () => {
          setTimeout(() => {
            callback(container.textContent);
            document.body.removeChild(container); // clean up
          }, 50); // tiny delay to ensure render
        });
      });
    };

    renderAndCapture("login.input_email", (text) =>
      setPlaceholders(prev => ({ ...prev, email: text }))
    );
    renderAndCapture("login.input_password", (text) =>
      setPlaceholders(prev => ({ ...prev, password: text }))
    );
  }, []);
  
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
        <p className="tutor-name">iAmTeacher</p>
        <p className="tutor-description"><Translate>app.tutor-description</Translate></p>
      </div>

      <form className="login-form" onSubmit={handleLogin}>
        <label htmlFor="email"><Translate>login.email</Translate></label>
        <input
          id="email"
          type="text"
          placeholder={placeholders.email}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password"><Translate>login.password</Translate></label>
        <input
          id="password"
          type="password"
          placeholder={placeholders.password}
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
            <Translate>login.login</Translate>
          </button>
        </div>
      </form>
    </div>
  );
}

export default EmailLogin;

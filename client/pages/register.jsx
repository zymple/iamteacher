import React, { useState } from "react";
import '../css/App.css';
import '../css/Login.css';

function Login() {

  return (
    <div className="app-container">
        <div className="page-title">
            <strong>Authentication</strong>
        </div>

        <form className="login-form">
          <label htmlFor="email">email</label>
          <input
            id="email"
            type="text"
            placeholder="Enter your email"
            autoComplete="email"
            required="true"
          />
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="text"
            placeholder="Enter your email"
            autoComplete="email"
            required="true"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required="true"
          />
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            placeholder="Confirm your password"
            autoComplete="current-password"
            required="true"
          />
          <label htmlFor="invite-code">Invite Code</label>
          <input
            id="invite-code"
            type="text"
            placeholder="Enter your invite code"
            required="true"
          />
          <div className="button-container">
              <button className="control-button idle" type="submit">
                  Register
              </button>
          </div>
        </form>
    </div>
  );
}

export default Login;
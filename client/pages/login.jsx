import React, { useState } from "react";
import '../App.css';
import '../Login.css';

function Login() {

  return (
    <div className="app-container">
        <div className="page-title">
            <strong>Authentication</strong>
        </div>

        <form className="login-form">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Enter your username"
            autoComplete="username"
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
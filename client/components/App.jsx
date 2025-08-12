import { useEffect, useRef, useState } from "react";
import "../App.css";
import "../Home.css";

export default function Conversation() {
  const [email, setemail] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
        } else {
          return res.json();
        }
      })
      .then((data) => {
        setemail(data?.email);
      })
      .catch((err) => {
        console.error("Failed to load user info", err);
      });
  }, []);
  return (
    <div className="app-container">
      <div className="home-information-box">
        <div className="text-container home">
          <p className="main">Hi, demo!</p>
          <p className="alt">Ready to learn today?</p>
        </div>
        <img width="114" height="114" src="https://gravatar.com/avatar/demo" alt="User's Avatar" className="user-avatar" />
      </div>

      <div className="status-box">
        <div className="status-title">
          <p className="status-title-text">Status</p>
        </div>
        <div className="status-group">
          <div className="status-item">
            <svg className="svg status" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M528 320C528 434.9 434.9 528 320 528C205.1 528 112 434.9 112 320C112 205.1 205.1 112 320 112C434.9 112 528 205.1 528 320zM64 320C64 461.4 178.6 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"/></svg>
            <div className="status-text">
              <span className="status-span">Total time</span>
              <span className="status-value">3h 40m</span>
            </div>
          </div>
          <div className="status-item">
            <svg xmlns="http://www.w3.org/2000/svg" className="svg status" width="1.2em" height="1.2em" viewBox="0 0 512 512">
              <path d="M431 320.6c-1-3.6 1.2-8.6 3.3-12.2a33.68 33.68 0 012.1-3.1A162 162 0 00464 215c.3-92.2-77.5-167-173.7-167-83.9 0-153.9 57.1-170.3 132.9a160.7 160.7 0 00-3.7 34.2c0 92.3 74.8 169.1 171 169.1 15.3 0 35.9-4.6 47.2-7.7s22.5-7.2 25.4-8.3a26.44 26.44 0 019.3-1.7 26 26 0 0110.1 2l56.7 20.1a13.52 13.52 0 003.9 1 8 8 0 008-8 12.85 12.85 0 00-.5-2.7z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"/><path d="M66.46 232a146.23 146.23 0 006.39 152.67c2.31 3.49 3.61 6.19 3.21 8s-11.93 61.87-11.93 61.87a8 8 0 002.71 7.68A8.17 8.17 0 0072 464a7.26 7.26 0 002.91-.6l56.21-22a15.7 15.7 0 0112 .2c18.94 7.38 39.88 12 60.83 12A159.21 159.21 0 00284 432.11" fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32"/>
            </svg>
            <div className="status-text">
              <span className="status-span">New words</span>
              <span className="status-value">3,780</span>
            </div>
          </div>
        </div>
        <div className="lesson-container">
          <button className="control-button small">Start Lesson</button>
        </div>
      </div>

      <div className="button-container">
        <div className="control-button idle" onClick={() => (location.href = "/conversation")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="1.2em"
            height="1.2em"
            className="svg"
          >
            <path
              fill="currentColor"
              d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2"
            ></path>
          </svg>
          <a>Conversation</a>
        </div>
        <div className="control-button disabled">
          <svg xmlns="http://www.w3.org/2000/svg" className="svg" width="1.2em" height="1.2em" viewBox="0 0 512 512">
            <path d="M256 160c16-63.16 76.43-95.41 208-96a15.94 15.94 0 0116 16v288a16 16 0 01-16 16c-128 0-177.45 25.81-208 64-30.37-38-80-64-208-64-9.88 0-16-8.05-16-17.93V80a15.94 15.94 0 0116-16c131.57.59 192 32.84 208 96zM256 160v288" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>
          </svg>
          <a>Vocabulary</a>
        </div>
        <div className="control-button disabled">
          <svg xmlns="http://www.w3.org/2000/svg" className="svg" width="1.2em" height="1.2em" viewBox="0 0 512 512">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M364.13 125.25L87 403l-23 45 44.99-23 277.76-277.13-22.62-22.62zM420.69 68.69l-22.62 22.62 22.62 22.63 22.62-22.63a16 16 0 000-22.62h0a16 16 0 00-22.62 0z"/>
          </svg>
          <a>Writing</a>
        </div>
      </div>
    </div>
  );
}
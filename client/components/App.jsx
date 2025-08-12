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
          <p className="main">Hi, demo</p>
          <p className="alt">Ready to learn today?</p>
        </div>
        <img width="114" height="114" src="https://avatar.iran.liara.run/public/80" alt="User's Avatar" className="user-avatar" />
      </div>

      <div className="status-box">
        <div className="status-title">
          <p className="status-title-text">Status</p>
        </div>
        <div className="status-group">
          <div className="status-item">
            <div className="status-item">
              <svg className="svg status" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M528 320C528 434.9 434.9 528 320 528C205.1 528 112 434.9 112 320C112 205.1 205.1 112 320 112C434.9 112 528 205.1 528 320zM64 320C64 461.4 178.6 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"/></svg>
              <span className="status-span">Total time</span>
              <span className="status-value">3h 40m</span>
            </div>
            <div className="status-item">
              <svg className="svg status" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M528 320C528 434.9 434.9 528 320 528C205.1 528 112 434.9 112 320C112 205.1 205.1 112 320 112C434.9 112 528 205.1 528 320zM64 320C64 461.4 178.6 576 320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z"/></svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" className="svg" width="1.2em" height="1.2em" viewBox="0 0 512 512"><path fill="currentColor" d="M473.16 221.48l-2.26-9.59H262.46v88.22H387c-12.93 61.4-72.93 93.72-121.94 93.72-35.66 0-73.25-15-98.13-39.11a140.08 140.08 0 01-41.8-98.88c0-37.16 16.7-74.33 41-98.78s61-38.13 97.49-38.13c41.79 0 71.74 22.19 82.94 32.31l62.69-62.36C390.86 72.72 340.34 32 261.6 32c-60.75 0-119 23.27-161.58 65.71C58 139.5 36.25 199.93 36.25 256s20.58 113.48 61.3 155.6c43.51 44.92 105.13 68.4 168.58 68.4 57.73 0 112.45-22.62 151.45-63.66 38.34-40.4 58.17-96.3 58.17-154.9 0-24.67-2.48-39.32-2.59-39.96z" /></svg>
          <a>Vocabulary</a>
        </div>
        <div className="control-button disabled">
          <svg xmlns="http://www.w3.org/2000/svg" className="svg" width="1.2em" height="1.2em" viewBox="0 0 512 512"><path fill="currentColor" d="M473.16 221.48l-2.26-9.59H262.46v88.22H387c-12.93 61.4-72.93 93.72-121.94 93.72-35.66 0-73.25-15-98.13-39.11a140.08 140.08 0 01-41.8-98.88c0-37.16 16.7-74.33 41-98.78s61-38.13 97.49-38.13c41.79 0 71.74 22.19 82.94 32.31l62.69-62.36C390.86 72.72 340.34 32 261.6 32c-60.75 0-119 23.27-161.58 65.71C58 139.5 36.25 199.93 36.25 256s20.58 113.48 61.3 155.6c43.51 44.92 105.13 68.4 168.58 68.4 57.73 0 112.45-22.62 151.45-63.66 38.34-40.4 58.17-96.3 58.17-154.9 0-24.67-2.48-39.32-2.59-39.96z" /></svg>
          <a>Writing</a>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import "../css/App.css";
import "../css/Home.css";
import "../css/Me.css";
import Navigation from '../components/Navigation.jsx'
import { Translate } from "../languages/TranslationsManager.jsx";
import { Filter } from "react-feather";

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

    async function logout() {
        await fetch("/logout", { method: "POST" });
        window.location.href = "/login";
    }

    return (
        <div className="app-container">
            <div className="me-box">
                <img width="114" height="114" src="https://gravatar.com/avatar/demo" alt="User's Avatar" className="user-avatar-me" />
                <p className="main" style={{ color: "#000000" }}>demo</p>
                <span className="pill">CEFR Equivalent: A2</span>
                <div className="skill-item">
                    <p className="skill-text">Reading</p>
                    <div className="pill-progress">
                        <div className="pill-fill" style={{ width: "20%" }}></div>
                    </div>
                </div>

                <div className="skill-item">
                    <p className="skill-text">Writing</p>
                    <div className="pill-progress">
                        <div className="pill-fill" style={{ width: "20%" }}></div>
                    </div>
                </div>

                <div className="skill-item">
                    <p className="skill-text">Listening</p>
                    <div className="pill-progress">
                        <div className="pill-fill" style={{ width: "20%" }}></div>
                    </div>
                </div>

                <div className="skill-item">
                    <p className="skill-text">Speaking</p>
                    <div className="pill-progress">
                        <div className="pill-fill" style={{ width: "20%" }}></div>
                    </div>
                </div>

                <div className="gnome-looking-option-selector">
                    <p style={{ fontSize: "20px" }}>Teacher gender</p>
                    <p className="option-right" style={{ fontSize: "18px" }}>Woman</p>
                    <img width="20" height="20" src="/assets/svgs/pan.svg" alt="Pan down icon" style={{ filter: "brightness(0) invert(1)" }}></img>
                </div>

                <div className="gtk-logout" onClick={logout}>
                    <p style={{ fontSize: "20px" }}><Translate>app.logout</Translate></p>
                </div>

            </div>

            <Navigation />
        </div>
    );
}
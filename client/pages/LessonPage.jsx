import { useEffect, useRef, useState } from "react";
import "../css/App.css";
import "../css/Home.css";
import "../css/LessonPage.css";
import { Contents } from "../contents/ContentsManager";
import BackButton from "../components/conversation/BackButton";

export default function Conversation() {

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
            <div className="page-header">
                <BackButton />
            </div>
            <div className="level-header">
                <p className="level-text">Lv.1</p>

                <div className="exp-box">
                    <img src="/assets/svgs/star.svg" alt="EXP" />
                    <p>200/1000</p>
                </div>
            </div>

            <div className="lesson-level-pill">
                <div className="lesson-level-pill-fill" style={{ width: "15%" }} />
            </div>

            <div className="lesson-cards-container">
                <p className="lesson-category">Beginner</p>
                <div className="control-button disabled">
                    <p className="lesson-title">
                        <Contents>beginner.1.title</Contents>
                    </p>
                    <img src="/assets/svgs/checkmark.svg" alt="Successfully completed"/>
                </div>

                <div className="control-button disabled">
                    <p className="lesson-title">
                        <Contents>beginner.2.title</Contents>
                    </p>

                    <div className="lesson-info">
                        <div className="info-row">
                            <img src="/assets/svgs/star.svg" alt="EXP" />
                            <p>+<Contents>beginner.2.score</Contents></p>
                        </div>

                        <div className="info-row">
                            <img src="/assets/svgs/clock.svg" alt="Length" />
                            <p><Contents>beginner.2.length</Contents></p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lesson-cards-container">
                <p className="lesson-category">Intermediate</p>

                <div className="control-button disabled">
                    <p className="lesson-title">
                        <Contents>intermediate.1.title</Contents>
                    </p>

                    <div className="lesson-info">
                        <div className="info-row">
                            <img src="/assets/svgs/star.svg" alt="EXP" />
                            <p>+<Contents>intermediate.1.score</Contents></p>
                        </div>

                        <div className="info-row">
                            <img src="/assets/svgs/clock.svg" alt="Length" />
                            <p>+<Contents>intermediate.1.length</Contents></p>
                        </div>
                    </div>
                </div>

                <div className="control-button disabled">
                    <p className="lesson-title">
                        <Contents>intermediate.2.title</Contents>
                    </p>

                    <div className="lesson-info">
                        <div className="info-row">
                            <img src="/assets/svgs/star.svg" alt="EXP" />
                            <p>+<Contents>intermediate.2.score</Contents></p>
                        </div>

                        <div className="info-row">
                            <img src="/assets/svgs/clock.svg" alt="Length" />
                            <p><Contents>intermediate.2.length</Contents></p>
                        </div>
                    </div>
                </div>

                <div className="control-button disabled">
                    <p className="lesson-title">
                        <Contents>intermediate.3.title</Contents>
                    </p>

                    <div className="lesson-info">
                        <div className="info-row">
                            <img src="/assets/svgs/star.svg" alt="EXP" />
                            <p>+<Contents>intermediate.3.score</Contents></p>
                        </div>

                        <div className="info-row">
                            <img src="/assets/svgs/clock.svg" alt="Length" />
                            <p><Contents>intermediate.3.length</Contents></p>
                        </div>
                    </div>
                </div>

                <div className="control-button idle" onClick={() => (location.href = "/conversation")}>
                    <p className="lesson-title">
                        <Contents>intermediate.4.title</Contents>
                    </p>

                    <div className="lesson-info">
                        <div className="info-row">
                            <img src="/assets/svgs/star.svg" alt="EXP" />
                            <p>+<Contents>intermediate.4.score</Contents></p>
                        </div>

                        <div className="info-row">
                            <img src="/assets/svgs/clock.svg" alt="Length" />
                            <p><Contents>intermediate.4.length</Contents></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
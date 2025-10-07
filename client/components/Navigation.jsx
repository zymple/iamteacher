import { useState, useEffect } from "react";
import '../css/Navigation.css'
import { Translate } from "../languages/TranslationsManager.jsx";

function Navigation() {
    // uhh thing
    const [currentPath, setCurrentPath] = useState('');

    useEffect(() => {
        // only runs on the client
        setCurrentPath(window.location.pathname);
    }, []);

    const handleNavigation = (path) => {
        if (typeof window !== 'undefined') {
            window.location.href = path;
        }
    };

    const isActive = (path) => currentPath === path;

    return (
        <div className="navigation-bottom">
            <div className={`navigation-button ${isActive('/') ? 'active' : ''}`} onClick={() => handleNavigation('/')}>
                <img src="/assets/svgs/books.svg" alt="Learn" />
                <a><Translate>app.navigation.learn</Translate></a>
            </div>
            <div className={`navigation-button ${isActive('/conversation') ? 'active' : ''}`} onClick={() => handleNavigation('/conversation')}>
                <img src="/assets/svgs/chat-bubbles.svg" alt="Chat with AI Bot" />
                <a><Translate>app.navigation.chat</Translate></a>
            </div>
            <div className={`navigation-button ${isActive('/me') ? 'active' : ''}`} onClick={() => handleNavigation('/me')}>
                <img src="/assets/svgs/person.svg" alt="Your Profile" />
                <a><Translate>app.navigation.me</Translate></a>
            </div>
        </div>
    );
}

export default Navigation; 
import React, { useEffect, useState } from "react";

export const Translate = ({ children }) => {
    const [translations, setTranslations] = useState({});
    const [enTranslations, setEnTranslations] = useState({});

    useEffect(() => {
        const userLocale = navigator.language || "en";
        const locale = userLocale.split("-")[0]; // e.g. "en", "th"

        // load english first
        import("../languages/en.json")
        .then((module) => {
            setEnTranslations(module.default);

            // users
            if (locale !== "en") {
            import(`../languages/${locale}.json`)
                .then((m) => setTranslations(m.default))
                .catch(() => setTranslations({})); // fallback to empty
            }
        })
        .catch(() => setEnTranslations({})); // fallback if english missing
    }, []);

    if (!enTranslations || Object.keys(enTranslations).length === 0) return children;

    const keys = children.split(".");
    
    const getText = (obj) => {
        let text = obj;
        for (const key of keys) {
        if (text[key] !== undefined) text = text[key];
        else return undefined;
        }
        return text;
    };

    // Try user locale first, then fallback to English
    let text = getText(translations);
    if (text === undefined) text = getText(enTranslations);
    if (text === undefined) text = children; // fallback if missing in both

    return text;
};

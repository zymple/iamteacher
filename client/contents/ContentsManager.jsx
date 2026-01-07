import React, { useEffect, useState } from "react";

export const Contents = ({ children }) => {
    const [contents, setContents] = useState({});
    const [enContents, setEnContents] = useState({});

    useEffect(() => {
        const userLocale = navigator.language || "en";
        const locale = userLocale.split("-")[0]; // e.g. "en", "th"

        // load english first
        import("../languages/en.json")
        .then((module) => {
            setEnContents(module.default);

            // users
            if (locale !== "en") {
            import(`../contents/${locale}.json`)
                .then((m) => setContents(m.default))
                .catch(() => setContents({})); // fallback to empty
            }
        })
        .catch(() => setEnContents({})); // fallback if english missing
    }, []);

    if (!enContents || Object.keys(enContents).length === 0) return children;

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

import { Router } from "express";
import fs from "fs";
import { logAccess, logConversation } from "../utils/logger.js";
import { getClientIP } from "../utils/ip.js";
import { stmts } from "../db/statements.js";

const router = Router();

// Read project info once
const {
  name: PROJECT_NAME = "iAmTeacher",
  version: PROJECT_VERSION = "0.0.0",
} = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

// ---- Voice session start / end ----
router.post("/log-voice-session", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { action, duration = 0 } = req.body;
  const { user: email, sessionId } = req;
  const ip = getClientIP(req);
  const ua = req.headers["user-agent"] || "?";

  if (action === "start") {
    logAccess(email, `started voice session (${sessionId})`, ip, ua);
    logConversation(
      email,
      sessionId,
      "INFO",
      `${PROJECT_NAME} ${PROJECT_VERSION} | Client: ${ua} | User: ${email}`
    );
    logConversation(email, sessionId, "INFO", "Conversation started");
  } else {
    logAccess(email, `ended voice session (${sessionId}) after ${duration}s`, ip, ua);
    logConversation(email, sessionId, "INFO", `Conversation finished after ${duration}s`);
  }

  res.json({ success: true });
});

// ---- Log token usage from a response.done event ----
router.post("/conversation/tokens", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { input_tokens = 0, output_tokens = 0 } = req.body;
  if (!input_tokens && !output_tokens) {
    return res.status(400).json({ error: "No token data" });
  }

  try {
    stmts().insertTokenUsage.run(
      req.user,
      req.sessionId,
      Number(input_tokens),
      Number(output_tokens)
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Token log error:", err);
    res.status(500).json({ error: "Failed to log tokens" });
  }
});

// ---- Log arbitrary utterance (SYSTEM / USER / INFO) ----
router.post("/conversation/log", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const { role = "SYSTEM", text = "" } = req.body;
  if (!text || !String(text).trim())
    return res.status(400).json({ error: "Empty text" });

  const safeRole = String(role).toUpperCase();
  const prefix =
    safeRole === "SYSTEM" ? "SYSTEM" : safeRole === "USER" ? "USER" : "INFO";

  logConversation(
    req.user,
    req.sessionId,
    prefix,
    String(text).replace(/\r?\n/g, " ").trim()
  );

  res.json({ success: true });
});

export default router;

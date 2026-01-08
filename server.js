import express from "express";
import fs from "fs";
import fsPromises from "fs/promises";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import fetch from "node-fetch"; // remove if Node >= 18
import OpenAI from "openai";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer"; // (not used here, but kept if you need later)

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const DEBUG = process.env.DEBUG?.toLowerCase() === "true";
const LOGGING = process.env.LOGGING?.toLowerCase() === "true";
const BASE_URL = process.env.BASE_URL;

const openai = new OpenAI({ apiKey });

// ==== Project name & version (for conversation headers) ====
const {
  name: PROJECT_NAME = "iAmTeacher",
  version: PROJECT_VERSION = "0.0.0",
} = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

// ==== App basics ====
app.get("/config", (req, res) => {
  res.json({ baseUrl: BASE_URL });
});

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("trust proxy", true); // respect X-Forwarded-For

// ==== Directories ====
const configFolder = "./config";
const userDataFolder = "./userdata";
const logsFolder = "./logs";

if (!fs.existsSync(userDataFolder)) {
  if (DEBUG) console.log("Making a folder for userdata!");
  fs.mkdirSync(userDataFolder);
}
if (!fs.existsSync(configFolder)) {
  if (DEBUG) console.log("Making a folder for configs!");
  fs.mkdirSync(configFolder);
}
if (!fs.existsSync(logsFolder)) {
  if (DEBUG) console.log("Making a folder for logging!");
  fs.mkdirSync(logsFolder);
}

// ==== Files ====
const sessionFile = "./userdata/session-token.txt";
const logsFile = "./logs/access.log";

if (!fs.existsSync(sessionFile)) {
  fs.writeFileSync(sessionFile, "");
  if (DEBUG) console.log(`📄 Created ${sessionFile}`);
}
if (!fs.existsSync(logsFile)) {
  fs.writeFileSync(logsFile, "");
  if (DEBUG) console.log(`📄 Created ${logsFile}`);
}

// ==== System prompt (Thai English teacher role) ====
const systemPrompt = `
สวัสดีครับ วันนี้คุณคือครูสอนภาษาอังกฤษที่มีประสบการณ์สอนเด็ก ๆ มามากกว่า 40 ปี คุณจะเชี่ยวชาญด้านการสอนเด็กอายุ 9-11 ขวบ วันนี้คุณจะสอนเรื่องบทสนทนาเกี่ยวกับการคุยเรื่องหนัง คุณจะเริ่มด้วยประโยคในลักษณะที่ว่าคุณจะถามเด็กว่า เขาดูหนังอะไรบ้าง และใช้ตรงนี้เป็นจุดเริ่มในการสอนภาษาอังกฤษ เริ่มเลยครับ
คุณควรเริ่มพูดก่อนโดยไม่รอเสียงจากผู้ใช้
`;

// ==== Helpers ====
function getClientIP(req) {
  return (
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}
function ts() {
  const d = new Date();
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function convDir(email, sessionId) {
  return `${userDataFolder}/${email}/${sessionId}`;
}
function convFile(email, sessionId) {
  return `${convDir(email, sessionId)}/conversation.txt`;
}
async function ensureConvDir(email, sessionId) {
  const dir = convDir(email, sessionId);
  await fsPromises.mkdir(dir, { recursive: true });
  return dir;
}
async function appendConv(email, sessionId, line) {
  const file = convFile(email, sessionId);
  await fsPromises.appendFile(file, line + "\n");
}

// ==== Global access logger (optional) ====
const logBuffer = [];
let flushing = false;

async function logUserActivity({ email = "Unknown", action = "", ip = "?", ua = "?" }) {
  if (!LOGGING) return;
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] 📘 ${email} ${action} from ${ip} UA="${ua}"\n`;
  try {
    await fsPromises.appendFile(logsFile, logEntry);
    if (DEBUG) console.log(logEntry.trim());
  } catch (err) {
    console.error("❗ Failed to write log. Buffering in memory:", err.message);
    logBuffer.push(logEntry);
  }
}

setInterval(async () => {
  if (!LOGGING || logBuffer.length === 0 || flushing) return;
  flushing = true;
  const entries = logBuffer.splice(0);
  const content = entries.join("");
  try {
    await fsPromises.appendFile(logsFile, content);
    if (DEBUG) console.log(`📝 Flushed ${entries.length} buffered log(s).`);
  } catch (err) {
    console.error("❗ Failed to flush log buffer:", err.message);
    logBuffer.unshift(...entries);
  }
  flushing = false;
}, 5000);

// ==== Vite SSR (middleware mode) ====
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// ==== Session restore (MUST come before protection) ====
app.use(async (req, res, next) => {
  const token = req.cookies["auth-token"];
  if (!token) return next();
  try {
    const sessions = await fsPromises.readFile(sessionFile, "utf-8");
    const line = sessions.split("\n").find((l) => l.startsWith(token + ":"));
    if (line) {
      const [storedToken, email, sessionId] = line.trim().split(":", 3);
      req.user = email;
      req.sessionId = sessionId;
      req.sessionToken = storedToken;
    }
  } catch (err) {
    console.error("Session read error:", err);
  }
  next();
});

// ==== Route protection (public allow-list) ====
app.use((req, res, next) => {
  const publicPaths = ["/login", "/register", "/email", "/config", "/me", "/lesson"];
  const isPublic =
    publicPaths.some((path) => req.path.startsWith(path)) ||
    req.method === "OPTIONS" ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".map") ||
    req.path.startsWith("/assets/");
  if (isPublic) return next();
  if (!req.user) return res.status(403).redirect("/login");
  next();
});

// ==== Auth: login ====
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userData = await fsPromises.readFile("./config/user.txt", "utf-8");
    const users = userData
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [u, hash] = line.trim().split(":");
        return { email: u, hash };
      });

    if (DEBUG) {
      console.log("=== STORED USERS ===");
      users.forEach((u, idx) => console.log(`[${idx}] email: "${u.email}", hash: "${u.hash}"`));
      console.log("====================");
      console.log("Login attempt:", { email, password });
    }

    const user = users.find((u) => u.email === email);
    if (!user) return res.status(401).send("Invalid email or password");

    const match = await bcrypt.compare(password, user.hash.replace("$2y$", "$2b$"));
    if (!match) return res.status(401).send("Invalid email or password");

    const token = crypto.randomBytes(32).toString("hex");
    const sessionId = crypto.randomUUID().toString();
    if (DEBUG)
      console.log(`✅ Login ok for "${email}". token=${token} sessionId=${sessionId}`);

    await fsPromises.appendFile(sessionFile, `${token}:${email}:${sessionId}\n`);

    // Ensure user/session directories exist
    if (!fs.existsSync(`${userDataFolder}/${email}`)) {
      if (DEBUG) console.log(`Making a logging folder for ${email}!`);
      fs.mkdirSync(`${userDataFolder}/${email}`);
    }
    if (!fs.existsSync(`${userDataFolder}/${email}/${sessionId}`)) {
      if (DEBUG) console.log(`Making a logging folder for ${sessionId}!`);
      fs.mkdirSync(`${userDataFolder}/${email}/${sessionId}`);
    }

    res.cookie("auth-token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logUserActivity({
      email,
      action: "logged in",
      ip: getClientIP(req),
      ua: req.headers["user-agent"],
    });

    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Internal server error");
  }
});

// ==== Me ====
app.get("/api/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ email: req.user, sessionId: req.sessionId });
});

// ==== Per-session conversation logging ====
app.post("/log-voice-session", express.json(), async (req, res) => {
  const token = req.cookies["auth-token"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const { action, duration = 0 } = req.body;

  try {
    const sessions = await fsPromises.readFile(sessionFile, "utf-8");
    const line = sessions.split("\n").find((l) => l.startsWith(token + ":"));
    if (!line) return res.status(403).json({ error: "Invalid session" });

    const [storedToken, email, sessionId] = line.trim().split(":", 3);
    const ip = getClientIP(req);
    const ua = req.headers["user-agent"] || "?";
    const timestampISO = new Date().toISOString();

    // Global access log
    const accessLogEntry =
      action === "start"
        ? `[${timestampISO}] 🟢 ${email} (${sessionId}) started a voice session from ${ip}`
        : `[${timestampISO}] 🔴 ${email} (${sessionId}) ended voice session after ${duration}s from ${ip}`;
    await fsPromises.appendFile(logsFile, accessLogEntry + "\n");
    if (DEBUG) console.log(accessLogEntry);

    // Per-session conversation log
    await ensureConvDir(email, sessionId);

    if (action === "start") {
      const header = [
        `${PROJECT_NAME} ${PROJECT_VERSION}`,
        `Client: ${ua}`,
        `User: ${email}`,
        `----`,
        `${ts()} INFO: Conversation started`,
      ].join("\n");
      await appendConv(email, sessionId, header);
    } else {
      await appendConv(
        email,
        sessionId,
        `${ts()} INFO: Conversation finished with ${duration}s\n`
      );
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Voice session log error:", err);
    res.status(500).json({ error: "Failed to log session" });
  }
});

// Log arbitrary utterances (SYSTEM / USER / INFO)
app.post("/conversation/log", express.json(), async (req, res) => {
  const token = req.cookies["auth-token"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const { role = "SYSTEM", text = "" } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: "Empty text" });

  try {
    const sessions = await fsPromises.readFile(sessionFile, "utf-8");
    const line = sessions.split("\n").find((l) => l.startsWith(token + ":"));
    if (!line) return res.status(403).json({ error: "Invalid session" });

    const [, email, sessionId] = line.trim().split(":", 3);
    const safeRole = String(role).toUpperCase();
    const prefix =
      safeRole === "SYSTEM" ? "SYSTEM" : safeRole === "USER" ? "USER" : "INFO";

    await ensureConvDir(email, sessionId);
    await appendConv(
      email,
      sessionId,
      `${ts()} ${prefix}: ${String(text).replace(/\r?\n/g, " ").trim()}`
    );

    res.json({ success: true });
  } catch (e) {
    console.error("conversation/log error:", e);
    res.status(500).json({ error: "Failed to write conversation log" });
  }
});

// ==== Logout ====
app.post("/logout", async (req, res) => {
  const token = req.cookies["auth-token"];
  if (token) {
    try {
      const data = await fsPromises.readFile(sessionFile, "utf-8");
      const filtered = data
        .split("\n")
        .filter((line) => !line.startsWith(token + ":"))
        .join("\n");
      await fsPromises.writeFile(sessionFile, filtered);
    } catch (e) {
      console.error("Logout error:", e);
    }
  }

  res.clearCookie("auth-token");
  await logUserActivity({
    email: req.user || "Unknown",
    action: "logged out",
    ip: getClientIP(req),
    ua: req.headers["user-agent"],
  });

  res.redirect("/login");
});

// ==== OpenAI Realtime token passthrough ====
app.get("/token", async (req, res) => {
  try {
    await logUserActivity({
      email: req.user || "Unknown",
      action: "requested OpenAI token (voice session start)",
      ip: getClientIP(req),
      ua: req.headers["user-agent"],
    });

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2025-06-03",
        voice: "sage",
        instructions: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Error: ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token", details: error.message });
  }
});

// ==== SSR catch-all ====
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;
  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8")
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace("<!--ssr-outlet-->", appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

// ==== Start server ====
app.listen(port, () => {
  console.log(`✅ Express server running on http://localhost:${port}`);
});

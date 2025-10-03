import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import fetch from "node-fetch"; // Add if Node <18
import OpenAI from "openai";
import fsPromises from "fs/promises";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import crypto from "crypto";
import multer from "multer";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const DEBUG = process.env.DEBUG?.toLowerCase() === "true";
const LOGGING = process.env.LOGGING?.toLowerCase() === "true";
const BASE_URL = process.env.BASE_URL;

const openai = new OpenAI({ apiKey });

app.get("/config", (req, res) => {
  res.json({ baseUrl: BASE_URL });
});

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("trust proxy", true); // allows req.ip to respect X-Forwarded-For headers

// make folder for iAT stuff
const configFolder = "./config"
const userDataFolder = "./userdata"
const logsFolder = "./logs"
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

// Create session-token.txt and user-activity.log if it doesn't exist
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
// System prompt (Thai English teacher role)
const systemPrompt = `
สวัสดีครับ วันนี้คุณคือครูสอนภาษาอังกฤษที่มีประสบการณ์สอนเด็ก ๆ มามากกว่า 40 ปี คุณจะเชี่ยวชาญด้านการสอนเด็กอายุ 9-11 ขวบ วันนี้คุณจะสอนเรื่องบทสนทนาเกี่ยวกับการคุยเรื่องหนัง คุณจะเริ่มด้วยประโยคในลักษณะที่ว่าคุณจะถามเด็กว่า เขาดูหนังอะไรบ้าง และใช้ตรงนี้เป็นจุดเริ่มในการสอนภาษาอังกฤษ เริ่มเลยครับ
คุณควรเริ่มพูดก่อนโดยไม่รอเสียงจากผู้ใช้
`;

// Addon stuff
function getClientIP(req) {
  return (
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim()) ||
    req.socket?.remoteAddress ||
    req.ip
  );
}

const logBuffer = [];
let flushing = false;

async function logUserActivity({ email = "Unknown", action = "", ip = "?", ua = "?" }) {
  if (!LOGGING) return;

  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] 📘 ${email} ${action} from ${ip} UA="${ua}"\n`;

  // Try immediate write
  try {
    await fsPromises.appendFile(logsFile, logEntry);
    if (DEBUG) console.log(logEntry.trim());
  } catch (err) {
    console.error("❗ Failed to write log. Buffering in memory:", err.message);
    logBuffer.push(logEntry);
  }
}


// Repeat
setInterval(async () => {
  if (!LOGGING || logBuffer.length === 0 || flushing) return;

  flushing = true;

  const entries = logBuffer.splice(0); // copy & empty buffer
  const content = entries.join("");

  try {
    await fsPromises.appendFile(logsFile, content);
    if (DEBUG) console.log(`📝 Flushed ${entries.length} buffered log(s).`);
  } catch (err) {
    console.error("❗ Failed to flush log buffer:", err.message);
    logBuffer.unshift(...entries); // put back
  }

  flushing = false;
}, 5000); // Retry every 5 sec


// Create Vite server for SSR
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// Middleware: protect all routes (except public)
app.use((req, res, next) => {
  const token = req.cookies["auth-token"];
  const publicPaths = ["/login", "/register", "/email"];
  const isPublic =
    publicPaths.some((path) => req.path.startsWith(path)) ||
    req.method === "OPTIONS" ||
    req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.endsWith(".map");

  if (isPublic) return next();
  if (!token) return res.status(403).redirect("/login");
  next();
});

// POST /login: handle login + set cookie
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userData = await fsPromises.readFile("./config/user.txt", "utf-8");
    const users = userData
      .split("\n")
      .filter(Boolean)
      .map(line => {
        const [u, hash] = line.trim().split(":");
        return { email: u, hash };
      });

    if (DEBUG) {
      console.log("=== STORED USERS ===");
      users.forEach((u, idx) => {
        console.log(`[${idx}] email: "${u.email}", hash: "${u.hash}"`);
      });

      if (DEBUG) {
      console.log("====================");

      console.log("Login attempt:");
      console.log("  Received email:", email);
      console.log("  Received password (raw):", password);
    }
  }

    const user = users.find(u => u.email === email);
    if (!user) {
      if (DEBUG) console.log("❌ No matching email found.");
      return res.status(401).send("Invalid email or password");
    }

    if (DEBUG) console.log(`  Stored hash for "${email}": ${user.hash}`);

    const match = await bcrypt.compare(
      password,
      user.hash.replace('$2y$', '$2b$')
    );

    if (DEBUG) console.log(`Password match result: ${match}`);

    if (!match) {
      if (DEBUG) console.log("❌ Password incorrect.");
      return res.status(401).send("Invalid email or password");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const sessionid = crypto.randomUUID().toString();
    if (DEBUG) console.log(`✅ Login successful for "${email}". Generated token: ${token} and SessionID: ${sessionid}`);

    await fsPromises.appendFile(sessionFile, `${token}:${email}:${sessionid}\n`);

    // Check if this email exists in the userdata folder or not
    if (!fs.existsSync(userDataFolder + "/" + email)) {
      if (DEBUG) console.log(`Making a logging folder for ${email}!`);
      fs.mkdirSync(userDataFolder + "/" + email);
    }

    // Create the session-id folder
    if (!fs.existsSync(userDataFolder + "/" + email + "/" + sessionid)) {
      if (DEBUG) console.log(`Making a logging folder for ${sessionid}!`);
      fs.mkdirSync(userDataFolder + "/" + email + "/" + sessionid);
    }

    res.cookie("auth-token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logUserActivity({
      email,
      action: "logged in",
      ip: getClientIP(req),
      ua: req.headers["user-agent"]
  });

    res.redirect("/");

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Internal server error");
  }
});

// Session restore middleware
app.use(async (req, res, next) => {
  const token = req.cookies["auth-token"];
  if (!token) return next();

  try {
    const sessions = await fsPromises.readFile(sessionFile, "utf-8");
    const line = sessions.split("\n").find(l => l.startsWith(token + ":"));
    if (line) {
      const [, email] = line.trim().split(":");
      req.user = email;
    }
  } catch (err) {
    console.error("Session read error:", err);
  }

  next();
});

app.get("/api/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ email: req.user });
});

app.post("/log-voice-session", express.json(), async (req, res) => {
  const token = req.cookies["auth-token"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const { action, duration = 0 } = req.body;

  try {
    const sessions = await fsPromises.readFile(sessionFile, "utf-8");
    const line = sessions.split("\n").find((l) => l.startsWith(token + ":"));
    if (!line) return res.status(403).json({ error: "Invalid session" });

    const [, email] = line.trim().split(":");
    const timestamp = new Date().toISOString();
    const ip = getClientIP(req);

    const logEntry =
      action === "start"
        ? `[${timestamp}] 🟢 ${email} started a voice session from ${ip}`
        : `[${timestamp}] 🔴 ${email} ended voice session after ${duration}s from ${ip}`;

    await fsPromises.appendFile(logsFile, logEntry + "\n");

    if (DEBUG) console.log(logEntry);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Voice session log error:", err);
    res.status(500).json({ error: "Failed to log session" });
  }
});


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
      ua: req.headers["user-agent"]
  });
  res.redirect("/login");
});

// GET /token: create OpenAI Realtime session
app.get("/token", async (req, res) => {
  try {
    await logUserActivity({
      email: req.user || "Unknown",
      action: "requested OpenAI token (voice session start)",
      ip: getClientIP(req),
      ua: req.headers["user-agent"]
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

// SSR route handling
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

// Start server
app.listen(port, () => {
  console.log(`✅ Express server running on http://localhost:${port}`);
});

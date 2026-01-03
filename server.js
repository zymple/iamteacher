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
import { initDB, logAccessDB, pool } from "./helpers/database.js";
import { addUser, deleteUser, resetPassword } from "./helpers/admincommands.js";

await initDB();

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

// ==== System prompt (Thai English teacher role) ====
const systemPrompt = `
สวัสดีครับ วันนี้คุณคือครูสอนภาษาอังกฤษที่มีประสบการณ์สอนเด็ก ๆ มามากกว่า 40 ปี คุณจะเชี่ยวชาญด้านการสอนเด็กอายุ 9-11 ขวบ วันนี้คุณจะสอนเรื่องบทสนทนาเกี่ยวกับการคุยเรื่องหนัง คุณจะเริ่มด้วยประโยคในลักษณะที่ว่าคุณจะถามเด็กว่า เขาดูหนังอะไรบ้าง และใช้ตรงนี้เป็นจุดเริ่มในการสอนภาษาอังกฤษ เริ่มเลยครับ
คุณควรเริ่มพูดก่อนโดยไม่รอเสียงจากผู้ใช้
`;

// ==== Helpers ====
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getClientIP(req) {
  return (
    req.headers["x-real-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip
  );
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

  const tokenHash = hashToken(token);

  try {
    const { rows } = await pool.query(
      `
      SELECT
        s.id AS session_id,
        u.id AS user_id,
        u.email
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
      `,
      [tokenHash]
    );

    if (rows.length > 0) {
      req.user = rows[0].email;
      req.userId = rows[0].user_id;
      req.sessionId = rows[0].session_id;
    }
  } catch (err) {
    console.error("Session restore error:", err);
  }

  next();
});

// ==== Route protection (public allow-list) ====
app.use((req, res, next) => {
  const publicPaths = ["/login", "/register", "/email", "/config"];
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
  const ip = getClientIP(req);
  const ua = req.headers["user-agent"] || "?";

  if (!email || !password) {
    return res.status(400).send("Missing email or password");
  }

  const client = await pool.connect();

  try {
    const userRes = await client.query(
      `SELECT id, email, password_hash FROM users WHERE email = $1`,
      [email]
    );
    
    if (userRes.rowCount === 0) {
      return res.status(401).send("Invalid email or password");
    }

    const user = userRes.rows[0];

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).send("Invalid email or password");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const sessionId = crypto.randomUUID();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `
      INSERT INTO sessions
        (id, user_id, token_hash, ip_address, user_agent, expires_at)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      `,
      [
        sessionId,
        user.id,
        tokenHash,
        ip,
        ua,
        expiresAt,
      ]
    );

    if (DEBUG)
      console.log(`✅ Login ok for "${email}". token=${token} sessionId=${sessionId}`);

    res.cookie("auth-token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    await logUserActivity({
      email,
      action: "logged in",
      ip,
      ua,
    });

    const userId = user.id;

    await logAccessDB({
      userId,
      action: "login",
      ip,
      ua,
    });


    if (DEBUG) {
      console.log("Login success:", {
        userId: user.id,
        email,
        sessionId,
      });
    }

    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Internal server error");
  } finally {
    client.release();
  }
});

// ==== Me ====
app.get("/api/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ email: req.user, sessionId: req.sessionId });
});

// ==== Per-session conversation logging ====
app.post("/log-voice-session", express.json(), async (req, res) => {
  if (!req.userId || !req.sessionId)
    return res.status(401).json({ error: "Not authenticated" });

  const { action, duration = 0 } = req.body;
  const ip = getClientIP(req);
  const ua = req.headers["user-agent"] || "?";

  try {
    if (action === "start") {
      await pool.query(
        `
        INSERT INTO voice_sessions
          (id, session_id, user_id, started_at, ip_address, user_agent)
        VALUES
          ($1, $2, $3, now(), $4, $5)
        `,
        [
          crypto.randomUUID(),
          req.sessionId,
          req.userId,
          ip,
          ua,
        ]
      );
    }

    if (action === "end") {
      await pool.query(
        `
        UPDATE voice_sessions
        SET
          ended_at = now(),
          duration_sec = $1
        WHERE session_id = $2
          AND ended_at IS NULL
        `,
        [duration, req.sessionId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Voice session DB log error:", err);
    res.status(500).json({ error: "Failed to log voice session" });
  }
});

// Log arbitrary utterances (SYSTEM / USER / INFO)
app.post("/conversation/log", express.json(), async (req, res) => {
  if (!req.userId || !req.sessionId)
    return res.status(401).json({ error: "Not authenticated" });

  const { role = "SYSTEM", text = "" } = req.body;
  if (!text.trim())
    return res.status(400).json({ error: "Empty text" });

  try {
    const { rows } = await pool.query(
      `
      SELECT id
      FROM voice_sessions
      WHERE session_id = $1
      ORDER BY started_at DESC
      LIMIT 1
      `,
      [req.sessionId]
    );

    if (rows.length === 0)
      return res.status(400).json({ error: "No active voice session" });

    const voiceSessionId = rows[0].id;

    await pool.query(
      `
      INSERT INTO conversation_messages
        (voice_session_id, user_id, role, message)
      VALUES
        ($1, $2, $3, $4)
      `,
      [
        voiceSessionId,
        req.userId,
        role.toUpperCase(),
        text.trim(),
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Conversation DB log error:", err);
    res.status(500).json({ error: "Failed to log conversation" });
  }
});

// ==== Logout ====
app.post("/logout", async (req, res) => {
  const token = req.cookies["auth-token"];

  if (token) {
    const tokenHash = hashToken(token);
    await pool.query(
      `DELETE FROM sessions WHERE token_hash = $1`,
      [tokenHash]
    );
  }

  res.clearCookie("auth-token");


  if (req.userId) {
    await logAccessDB({
      userId: req.userId,
      action: "logout",
      ip: getClientIP(req),
      ua: req.headers["user-agent"],
    });
  }

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
  process.stdin.setEncoding("utf8");
  console.log(`:evelyn01: ${PROJECT_NAME} v${PROJECT_VERSION} is starting...`);
  console.log(`✅ Express server running on http://localhost:${port}`);
  console.log('Type "help" to see all availables commands!');

  process.stdin.on("data", async (input) => {
    const line = input.trim();
    if (!line) return;

    const [command, ...args] = line.split(/\s+/);

    try {
      switch (command.toLowerCase()) {
        case "help":
          console.log("Available commands:");
          console.log(" - adduser <email> <password>");
          console.log(" - deleteuser <email>");
          console.log(" - resetpassword <email> <newpassword>");
          break;
        case "adduser":
          if (args.length !== 2) {
            console.log("Usage: adduser <email> <password>");
            break;
          }
          const addMsg = await addUser(args[0], args[1]);
          console.log(addMsg);
          break;
        case "deleteuser":
          if (args.length !== 1) {
            console.log("Usage: deleteuser <email>");
            break;
          }
          const delMsg = await deleteUser(args[0]);
          console.log(delMsg);
          break;
        case "resetpassword":
          if (args.length !== 2) {
            console.log("Usage: resetpassword <email> <newpassword>");
            break;
          }
          const resetMsg = await resetPassword(args[0], args[1]);
          console.log(resetMsg);
          break;
        default:
          console.log(`Unknown command: ${command}`);
      }
    } catch (err) {
      console.error(`Error executing command "${command}":`, err.message);
    }
  });
});

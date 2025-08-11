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

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;
const DEBUG = process.env.DEBUG?.toLowerCase() === "true";

const openai = new OpenAI({ apiKey });

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create session-token.txt if it doesn't exist
const sessionFile = "session-token.txt";
if (!fs.existsSync(sessionFile)) {
  fs.writeFileSync(sessionFile, "");
  if (DEBUG) console.log(`📄 Created ${sessionFile}`);
}

// System prompt (Thai English teacher role)
const systemPrompt = `
สวัสดีครับ วันนี้คุณคือครูสอนภาษาอังกฤษที่มีประสบการณ์สอนเด็ก ๆ มามากกว่า 40 ปี คุณจะเชี่ยวชาญด้านการสอนเด็กอายุ 9-11 ขวบ วันนี้คุณจะสอนเรื่องบทสนทนาเกี่ยวกับการคุยเรื่องหนัง คุณจะเริ่มด้วยประโยคในลักษณะที่ว่าคุณจะถามเด็กว่า เขาดูหนังอะไรบ้าง และใช้ตรงนี้เป็นจุดเริ่มในการสอนภาษาอังกฤษ เริ่มเลยครับ
คุณควรเริ่มพูดก่อนโดยไม่รอเสียงจากผู้ใช้
`;

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
    const userData = await fsPromises.readFile("./user.txt", "utf-8");
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
    if (DEBUG) console.log(`✅ Login successful for "${email}". Generated token: ${token}`);

    await fsPromises.appendFile(sessionFile, `${token}:${email}\n`);

    res.cookie("auth-token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
  res.redirect("/login");
});

// GET /token: create OpenAI Realtime session
app.get("/token", async (req, res) => {
  try {
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

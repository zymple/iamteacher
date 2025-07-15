// server.js

import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import fetch from "node-fetch"; // Add if Node <18

import OpenAI from "openai";
import path from "path";
import multer from "multer";
import fsPromises from "fs/promises";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import crypto from "crypto";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey });

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create folders
const uploadsDir = path.join(process.cwd(), "uploads");
const ttsDir = path.join(process.cwd(), "tts");
[uploadsDir, ttsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, file.fieldname + "-" + Date.now() + ".wav"),
});
const upload = multer({ storage });

app.use("/tts", express.static("tts"));

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
  const publicPaths = ["/login", "/register"];
  const isPublic =
    publicPaths.some((path) => req.path.startsWith(path)) ||
    req.path.startsWith("/uploads") ||
    req.method === "OPTIONS" ||
    req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.endsWith(".map");

  if (isPublic) return next();
  if (!token) return res.status(403).redirect("/login");
  next();
});

// POST /login: handle login + set cookie
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const userData = await fsPromises.readFile("./user.txt", "utf-8");
    const users = userData
      .split("\n")
      .filter(Boolean)
      .map(line => {
        const [u, hash] = line.trim().split(":");
        return { username: u, hash };
      });

    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).send("Invalid username or password");

    const match = await bcrypt.compare(password, user.hash.replace('$2y$', '$2b$'));
    console.log(match); // should be true
    if (!match) return res.status(401).send("Invalid username or password");

    // Token generation
    const token = crypto.randomBytes(32).toString("hex");

    // Store session
    await fsPromises.appendFile("session-token.txt", `${token}:${username}\n`);

    // Set cookie
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
// Place this middleware before any routes that use `req.user`
app.use(async (req, res, next) => {
  const token = req.cookies["auth-token"];
  if (!token) return next();

  try {
    const sessions = await fsPromises.readFile("session-token.txt", "utf-8");
    const line = sessions.split("\n").find(l => l.startsWith(token + ":"));
    if (line) {
      const [, username] = line.trim().split(":");
      req.user = username;
    }
  } catch (err) {
    console.error("Session read error:", err);
  }

  next();
});
app.get("/api/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ username: req.user });
});

app.post("/logout", async (req, res) => {
  const token = req.cookies["auth-token"];
  if (token) {
    try {
      const data = await fsPromises.readFile("session-token.txt", "utf-8");
      const filtered = data
        .split("\n")
        .filter((line) => !line.startsWith(token + ":"))
        .join("\n");
      await fsPromises.writeFile("session-token.txt", filtered);
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

// POST /ai-tutor: process uploaded audio and respond
app.post("/ai-tutor", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

  const filePath = req.file.path;
  const mimetype = "audio/wav";
  let transcript = "";
  let reply = "";
  let ttsUrl = "";

  console.log("Received file:", {
    originalname: req.file.originalname,
    mimetype,
    path: filePath,
    size: req.file.size,
  });

  try {
    // 1. Transcribe audio
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "en",
      response_format: "text",
    });
    transcript = transcription.text || "(no speech detected)";

    // 2. Chat completion
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });
    reply = chatCompletion.choices[0]?.message?.content || "(no response)";

    // 3. Generate TTS
    if (reply && reply !== "(no response)") {
      const ttsFilename = `tts-${Date.now()}.wav`;
      const ttsPath = path.join(ttsDir, ttsFilename);

      const ttsResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",
        input: reply,
        response_format: "wav",
        speed: 0.9,
      });

      const buffer = Buffer.from(await ttsResponse.arrayBuffer());
      await fsPromises.writeFile(ttsPath, buffer);
      ttsUrl = `/tts/${ttsFilename}`;
    }

    res.json({ success: true, transcript, reply, ttsUrl });
  } catch (error) {
    console.error("AI Tutor Error:", error);
    res.status(500).json({
      success: false,
      error: "AI processing failed",
      details: error.message,
    });
  } finally {
    // Clean uploaded file
    try {
      await fsPromises.unlink(filePath);
    } catch (e) {
      console.error("File cleanup error:", e);
    }
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

import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import fetch from "node-fetch"; // Add if Node <18

import OpenAI from "openai";
import path from "path";
import multer from "multer";
import fsPromises from "fs/promises";

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey });

// File thingy
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // force .wav
    const ext = ".wav";
    cb(null, file.fieldname + "-" + Date.now() + ext);
  },
});
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ storage });

const ttsDir = path.join(process.cwd(), 'tts');
if (!fs.existsSync(ttsDir)) {
  fs.mkdirSync(ttsDir, { recursive: true });
}
// served tts
app.use('/tts', express.static('tts'))

// Thai system prompt: English teacher for kids
const systemPrompt = `
สวัสดีครับ วันนี้คุณคือครูสอนภาษาอังกฤษที่มีประสบการณ์สอนเด็ก ๆ มามากกว่า 40 ปี คุณจะเชี่ยวชาญด้านการสอนเด็กอายุ 9-11 ขวบ วันนี้คุณจะสอนเรื่องบทสนทนาเกี่ยวกับการคุยเรื่องหนัง คุณจะเริ่มด้วยประโยคในลักษณะที่ว่าคุณจะถามเด็กว่า เขาดูหนังอะไรบ้าง และใช้ตรงนี้เป็นจุดเริ่มในการสอนภาษาอังกฤษ เริ่มเลยครับ
คุณควรเริ่มพูดก่อนโดยไม่รอเสียงจากผู้ใช้
`;

// Vite middleware for SSR
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// Token generation for OpenAI Realtime
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
        voice: "sage", // Optional: shimmer, echo, sage
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

// mobile api
app.post("/ai-tutor", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

  const filePath = req.file.path;
  const mimetype = "audio/wav";
  let transcript = '';
  let reply = '';
  let ttsUrl = '';

  console.log("Received file:", {
    originalname: req.file.originalname,
    mimetype: mimetype,
    path: filePath,
    size: req.file.size,
  });

  try {
    // 1. Transcribe user audio
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
                                                                   model: "whisper-1",
                                                                   language: "en",
                                                                   response_format: "text"
    });
    transcript = transcription.text || '(no speech detected)';

    // 2. Get AI response
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript }
      ],
      max_tokens: 150,
      temperature: 0.7
    });
    reply = chatCompletion.choices[0]?.message?.content || '(no response)';

    // 3. Generate TTS audio
    if (reply && reply !== '(no response)') {
      const ttsFilename = `tts-${Date.now()}.wav`;
      const ttsPath = path.join(ttsDir, ttsFilename);

      const ttsResponse = await openai.audio.speech.create({
        model: "tts-1",
        voice: "nova",  // Can change to 'nova' for female voice
        input: reply,
        response_format: "wav",
        speed: 0.9  // Slightly slower for clarity
      });

      const buffer = Buffer.from(await ttsResponse.arrayBuffer());
      await fsPromises.writeFile(ttsPath, buffer);
      ttsUrl = `/tts/${ttsFilename}`;
    }

    res.json({
      success: true,
      transcript,
      reply,
      ttsUrl: ttsUrl || null
    });
    console.log(res.json)

  } catch (error) {
    console.error('AI Tutor Error:', error);
    res.status(500).json({
      success: false,
      error: 'AI processing failed',
      details: error.message
    });
  } finally {
    // Clean up uploaded file
    try {
      await fsPromises.unlink(filePath);
    } catch (e) {
      console.error('File cleanup error:', e);
    }
  }
});

// SSR with Vite
app.use("*", async (req, res, next) => {
  const url = req.originalUrl;

  try {
    const template = await vite.transformIndexHtml(
      url,
      fs.readFileSync("./client/index.html", "utf-8")
    );
    const { render } = await vite.ssrLoadModule("./client/entry-server.jsx");
    const appHtml = await render(url);
    const html = template.replace(`<!--ssr-outlet-->`, appHtml?.html);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  } catch (e) {
    vite.ssrFixStacktrace(e);
    next(e);
  }
});

app.listen(port, () => {
  console.log(`Express server running on *:${port}`);
});

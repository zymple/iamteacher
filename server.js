import express from "express";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import fetch from "node-fetch"; // Add if Node <18

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

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

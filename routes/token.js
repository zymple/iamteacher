import { Router } from "express";
import fetch from "node-fetch"; // remove if Node >= 18
import { systemPrompt } from "../utils/prompts.js";
import { getClientIP } from "../utils/ip.js";
import { logAccess } from "../utils/logger.js";

const router = Router();
const apiKey = process.env.OPENAI_API_KEY;

router.get("/token", async (req, res) => {
  try {
    logAccess(
      req.user || "Unknown",
      "requested OpenAI token",
      getClientIP(req),
      req.headers["user-agent"]
    );

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
        instructions: systemPrompt,
        input_audio_transcription: {
          model: "whisper-1",
        },
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
    res
      .status(500)
      .json({ error: "Failed to generate token", details: error.message });
  }
});

export default router;

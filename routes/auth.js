import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { stmts } from "../db/statements.js";
import { getClientIP } from "../utils/ip.js";
import { logAccess } from "../utils/logger.js";

const DEBUG = process.env.DEBUG?.toLowerCase() === "true";
const router = Router();

// ---- Login ----
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = stmts().getUser.get(email);
    if (!user) return res.status(401).send("Invalid email or password");

    const hash = user.password_hash.replace("$2y$", "$2b$");
    const match = await bcrypt.compare(password, hash);
    if (!match) return res.status(401).send("Invalid email or password");

    const token = crypto.randomBytes(32).toString("hex");
    const sessionId = crypto.randomUUID();

    stmts().insertSession.run(token, email, sessionId);

    if (DEBUG)
      console.log(`✅ Login ok for "${email}" (${user.role}). sessionId=${sessionId}`);

    res.cookie("auth-token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    logAccess(email, "logged in", getClientIP(req), req.headers["user-agent"]);
    res.redirect("/");
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Internal server error");
  }
});

// ---- Me ----
router.get("/api/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  res.json({ email: req.user, sessionId: req.sessionId, role: req.userRole });
});

// ---- Logout ----
router.post("/logout", (req, res) => {
  const token = req.cookies["auth-token"];
  if (token) {
    try {
      stmts().deleteSession.run(token);
    } catch (e) {
      console.error("Logout error:", e);
    }
  }
  res.clearCookie("auth-token");
  logAccess(
    req.user || "Unknown",
    "logged out",
    getClientIP(req),
    req.headers["user-agent"]
  );
  res.redirect("/login");
});

export default router;

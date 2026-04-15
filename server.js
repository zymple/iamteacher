import express from "express";
import fs from "fs";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import "dotenv/config";

// ---- Database ----
import { initDb, closeDb } from "./db/index.js";

// ---- Middleware ----
import { sessionRestore } from "./middleware/auth.js";
import { routeGuard } from "./middleware/guard.js";

// ---- Routes ----
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import teacherRoutes from "./routes/teacher.js";
import conversationRoutes from "./routes/conversation.js";
import tokenRoutes from "./routes/token.js";

// ============================================================
const app = express();
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL;

// ---- Init database (schema + migration) ----
initDb();

// ---- Core middleware ----
app.get("/config", (req, res) => res.json({ baseUrl: BASE_URL }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("trust proxy", true);

// ---- Vite SSR (middleware mode) ----
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "custom",
});
app.use(vite.middlewares);

// ---- Auth middleware (order matters) ----
app.use(sessionRestore);
app.use(routeGuard);

// ---- Mount routes ----
app.use(authRoutes);
app.use(adminRoutes);
app.use(teacherRoutes);
app.use(conversationRoutes);
app.use(tokenRoutes);

// ---- SSR catch-all ----
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

// ---- Graceful shutdown ----
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down…");
  closeDb();
  process.exit(0);
});
process.on("SIGTERM", () => {
  closeDb();
  process.exit(0);
});

// ---- Start ----
app.listen(port, () => {
  console.log(`✅ Express server running on http://localhost:${port}`);
});

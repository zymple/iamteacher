import { Router } from "express";
import { getDb } from "../db/index.js";
import { stmts } from "../db/statements.js";
import { requireRole } from "../middleware/guard.js";

const router = Router();

// ============================================================
//  ALL STUDENTS OVERVIEW (dashboard)
//  GET /api/teacher/students?limit=50&offset=0
//
//  Returns every student with: total sessions, messages sent,
//  and last activity timestamp.
// ============================================================
router.get(
  "/api/teacher/students",
  requireRole("teacher", "admin"),
  (req, res) => {
    try {
      const rows = stmts().getAllStudentStats.all();
      res.json({ rows });
    } catch (err) {
      console.error("Teacher students overview error:", err);
      res.status(500).json({ error: "Query failed" });
    }
  }
);

// ============================================================
//  SINGLE STUDENT STATS
//  GET /api/teacher/students/:email
//
//  Returns aggregate stats for one student.
// ============================================================
router.get(
  "/api/teacher/students/:email",
  requireRole("teacher", "admin"),
  (req, res) => {
    try {
      const user = stmts().getUser.get(req.params.email);
      if (!user || user.role !== "student") {
        return res.status(404).json({ error: "Student not found" });
      }

      const stats = stmts().getStudentStats.get(req.params.email);

      res.json({
        email: user.email,
        registered_at: user.created_at,
        total_sessions: stats?.total_sessions || 0,
        total_messages: stats?.total_messages || 0,
        user_messages: stats?.user_messages || 0,
        system_messages: stats?.system_messages || 0,
        first_activity: stats?.first_activity || null,
        last_activity: stats?.last_activity || null,
      });
    } catch (err) {
      console.error("Teacher student stats error:", err);
      res.status(500).json({ error: "Query failed" });
    }
  }
);

// ============================================================
//  STUDENT SESSION LIST
//  GET /api/teacher/students/:email/sessions
//
//  Returns all sessions for a student with per-session breakdown.
// ============================================================
router.get(
  "/api/teacher/students/:email/sessions",
  requireRole("teacher", "admin"),
  (req, res) => {
    try {
      const user = stmts().getUser.get(req.params.email);
      if (!user || user.role !== "student") {
        return res.status(404).json({ error: "Student not found" });
      }

      const sessions = stmts().getStudentSessions.all(req.params.email);
      res.json({ email: req.params.email, sessions });
    } catch (err) {
      console.error("Teacher student sessions error:", err);
      res.status(500).json({ error: "Query failed" });
    }
  }
);

// ============================================================
//  VIEW FULL CONVERSATION OF A SESSION
//  GET /api/teacher/sessions/:sessionId
//
//  Returns every message in a session, in order.
// ============================================================
router.get(
  "/api/teacher/sessions/:sessionId",
  requireRole("teacher", "admin"),
  (req, res) => {
    try {
      const rows = stmts().getConvBySession.all(req.params.sessionId);
      if (rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json({ session_id: req.params.sessionId, messages: rows });
    } catch (err) {
      console.error("Teacher session view error:", err);
      res.status(500).json({ error: "Query failed" });
    }
  }
);

// ============================================================
//  EXPORT SESSION AS PLAIN TEXT
//  GET /api/teacher/sessions/:sessionId/export
// ============================================================
router.get(
  "/api/teacher/sessions/:sessionId/export",
  requireRole("teacher", "admin"),
  (req, res) => {
    const rows = stmts().getConvBySession.all(req.params.sessionId);
    if (rows.length === 0) return res.status(404).send("Session not found");

    const text = rows
      .map((r) => `${r.created_at} ${r.role}: ${r.message}`)
      .join("\n");
    res.type("text/plain").send(text);
  }
);

// ============================================================
//  SEARCH STUDENT CONVERSATIONS
//  GET /api/teacher/students/:email/search?q=hello&limit=50
//
//  Full-text search within a student's messages.
// ============================================================
router.get(
  "/api/teacher/students/:email/search",
  requireRole("teacher", "admin"),
  (req, res) => {
    const { q, limit = 50 } = req.query;
    if (!q || !q.trim()) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
      const rows = stmts().searchConversations.all(
        req.params.email,
        `%${q}%`,
        Number(limit)
      );
      res.json({ email: req.params.email, query: q, rows });
    } catch (err) {
      console.error("Teacher search error:", err);
      res.status(500).json({ error: "Query failed" });
    }
  }
);

// ============================================================
//  RECENT ACTIVITY ACROSS ALL STUDENTS
//  GET /api/teacher/activity?from=&to=&limit=100
//
//  Shows recent conversation entries from all students.
// ============================================================
router.get(
  "/api/teacher/activity",
  requireRole("teacher", "admin"),
  (req, res) => {
    const { from, to, limit = 100 } = req.query;

    let sql = `
      SELECT c.id, c.email, c.session_id, c.role, c.message, c.created_at
      FROM conversation_logs c
      JOIN users u ON u.email = c.email
      WHERE u.role = 'student'
    `;
    const params = [];

    if (from) {
      sql += " AND c.created_at >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND c.created_at <= ?";
      params.push(to);
    }

    sql += " ORDER BY c.id DESC LIMIT ?";
    params.push(Number(limit));

    try {
      const rows = getDb().prepare(sql).all(...params);
      res.json({ rows });
    } catch (err) {
      console.error("Teacher activity error:", err);
      res.status(500).json({ error: "Query failed" });
    }
  }
);

export default router;

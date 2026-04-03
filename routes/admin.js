import { Router } from "express";
import bcrypt from "bcrypt";
import { getDb } from "../db/index.js";
import { stmts } from "../db/statements.js";
import { requireRole } from "../middleware/guard.js";
import { getClientIP } from "../utils/ip.js";
import { logAccess } from "../utils/logger.js";

const router = Router();

// ============================================================
//  Helper: build a filtered query with pagination
// ============================================================
function paginatedQuery(baseTable, req, allowedFilters) {
  const { limit = 50, offset = 0, from, to } = req.query;

  let sql = `SELECT * FROM ${baseTable} WHERE 1=1`;
  const params = [];

  for (const { queryKey, column, operator } of allowedFilters) {
    const val = req.query[queryKey];
    if (val === undefined || val === "") continue;
    sql += ` AND ${column} ${operator} ?`;
    params.push(operator === "LIKE" ? `%${val}%` : val);
  }

  if (from) {
    sql += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND created_at <= ?";
    params.push(to);
  }

  const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
  const countParams = [...params];

  sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  const db = getDb();
  const rows = db.prepare(sql).all(...params);
  const { total } = db.prepare(countSql).get(...countParams);

  return { total, limit: Number(limit), offset: Number(offset), rows };
}

// ============================================================
//  ACCESS LOGS
//  GET /api/admin/logs/access?email=&action=&from=&to=&limit=&offset=
// ============================================================
router.get("/api/admin/logs/access", requireRole("admin"), (req, res) => {
  try {
    const result = paginatedQuery("access_logs", req, [
      { queryKey: "email", column: "email", operator: "=" },
      { queryKey: "action", column: "action", operator: "LIKE" },
    ]);
    res.json(result);
  } catch (err) {
    console.error("Admin access log error:", err);
    res.status(500).json({ error: "Query failed" });
  }
});

// ============================================================
//  CONVERSATION LOGS
//  GET /api/admin/logs/conversations?email=&session_id=&role=&from=&to=&limit=&offset=
// ============================================================
router.get(
  "/api/admin/logs/conversations",
  requireRole("admin"),
  (req, res) => {
    try {
      const result = paginatedQuery("conversation_logs", req, [
        { queryKey: "email", column: "email", operator: "=" },
        { queryKey: "session_id", column: "session_id", operator: "=" },
        { queryKey: "role", column: "role", operator: "=" },
      ]);
      res.json(result);
    } catch (err) {
      console.error("Admin conversation log error:", err);
      res.status(500).json({ error: "Query failed" });
    }
  }
);

// ============================================================
//  EXPORT A SESSION AS PLAIN TEXT
//  GET /api/admin/logs/conversations/:sessionId/export
//  Accessible by admin + teacher
// ============================================================
router.get(
  "/api/admin/logs/conversations/:sessionId/export",
  requireRole("admin", "teacher"),
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
//  LIST USERS
//  GET /api/admin/users?role=&limit=&offset=
// ============================================================
router.get("/api/admin/users", requireRole("admin"), (req, res) => {
  try {
    const { role, limit = 50, offset = 0 } = req.query;

    let sql = "SELECT id, email, role, created_at FROM users WHERE 1=1";
    const params = [];

    if (role) {
      sql += " AND role = ?";
      params.push(role);
    }

    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const rows = getDb().prepare(sql).all(...params);
    res.json({ rows });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Query failed" });
  }
});

// ============================================================
//  CREATE USER (admin only)
//  POST /api/admin/users
//  body: { email, password, role? }
// ============================================================
router.post("/api/admin/users", requireRole("admin"), async (req, res) => {
  const { email, password, role = "student" } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const validRoles = ["student", "teacher", "admin"];
  if (!validRoles.includes(role)) {
    return res
      .status(400)
      .json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
  }

  try {
    const existing = stmts().getUser.get(email);
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    stmts().insertUser.run(email, hash, role);

    logAccess(
      req.user,
      `created user ${email} with role ${role}`,
      getClientIP(req),
      req.headers["user-agent"]
    );

    res.status(201).json({ success: true, email, role });
  } catch (err) {
    console.error("Admin create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ============================================================
//  DELETE USER (admin only)
//  DELETE /api/admin/users/:email
// ============================================================
router.delete("/api/admin/users/:email", requireRole("admin"), (req, res) => {
  const targetEmail = req.params.email;

  // Prevent self-deletion
  if (targetEmail === req.user) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  try {
    const user = stmts().getUser.get(targetEmail);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete sessions → user (logs kept for audit trail)
    stmts().deleteSessionsByEmail.run(targetEmail);
    stmts().deleteUser.run(targetEmail);

    logAccess(
      req.user,
      `deleted user ${targetEmail} (was ${user.role})`,
      getClientIP(req),
      req.headers["user-agent"]
    );

    res.json({ success: true, deleted: targetEmail });
  } catch (err) {
    console.error("Admin delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ============================================================
//  RESET USER PASSWORD (admin only)
//  PATCH /api/admin/users/:email/password
//  body: { password }
// ============================================================
router.patch(
  "/api/admin/users/:email/password",
  requireRole("admin"),
  async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res
        .status(400)
        .json({ error: "Password is required (min 4 characters)" });
    }

    try {
      const user = stmts().getUser.get(req.params.email);
      if (!user) return res.status(404).json({ error: "User not found" });

      const hash = await bcrypt.hash(password, 10);
      getDb()
        .prepare("UPDATE users SET password_hash = ? WHERE email = ?")
        .run(hash, req.params.email);

      // Invalidate all sessions so they must re-login
      stmts().deleteSessionsByEmail.run(req.params.email);

      logAccess(
        req.user,
        `reset password for ${req.params.email}`,
        getClientIP(req),
        req.headers["user-agent"]
      );

      res.json({ success: true, email: req.params.email });
    } catch (err) {
      console.error("Admin reset password error:", err);
      res.status(500).json({ error: "Failed to reset password" });
    }
  }
);

// ============================================================
//  UPDATE USER ROLE (admin only)
//  PATCH /api/admin/users/:email/role
//  body: { role: "teacher" }
// ============================================================
router.patch("/api/admin/users/:email/role", requireRole("admin"), (req, res) => {
  const { role } = req.body;
  const validRoles = ["student", "teacher", "admin"];
  if (!validRoles.includes(role)) {
    return res
      .status(400)
      .json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
  }

  const result = stmts().updateUserRole.run(role, req.params.email);
  if (result.changes === 0)
    return res.status(404).json({ error: "User not found" });

  logAccess(
    req.user,
    `changed role of ${req.params.email} to ${role}`,
    getClientIP(req),
    req.headers["user-agent"]
  );
  res.json({ success: true, email: req.params.email, role });
});

export default router;

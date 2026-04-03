import { getDb } from "./index.js";

let _stmts = null;

/**
 * Lazily prepare all statements on first call.
 * Call only AFTER initDb().
 */
export function stmts() {
  if (_stmts) return _stmts;

  const db = getDb();

  _stmts = {
    // ---- users ----
    getUser: db.prepare("SELECT * FROM users WHERE email = ?"),
    insertUser: db.prepare(
      "INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)"
    ),
    updateUserRole: db.prepare("UPDATE users SET role = ? WHERE email = ?"),
    listUsers: db.prepare(
      "SELECT id, email, role, created_at FROM users ORDER BY id DESC"
    ),

    // ---- sessions ----
    getSession: db.prepare(
      "SELECT email, session_id FROM sessions WHERE token = ?"
    ),
    insertSession: db.prepare(
      "INSERT INTO sessions (token, email, session_id) VALUES (?, ?, ?)"
    ),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),

    // ---- conversation logs ----
    insertConv: db.prepare(
      "INSERT INTO conversation_logs (email, session_id, role, message) VALUES (?, ?, ?, ?)"
    ),
    getConvBySession: db.prepare(
      "SELECT role, message, created_at FROM conversation_logs WHERE session_id = ? ORDER BY id"
    ),

    // ---- user management ----
    deleteUser: db.prepare("DELETE FROM users WHERE email = ?"),
    deleteSessionsByEmail: db.prepare("DELETE FROM sessions WHERE email = ?"),

    // ---- teacher: student progress ----
    getStudentSessions: db.prepare(`
      SELECT
        session_id,
        MIN(created_at) AS started_at,
        MAX(created_at) AS last_activity,
        COUNT(*)        AS message_count,
        SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) AS user_messages,
        SUM(CASE WHEN role = 'SYSTEM' THEN 1 ELSE 0 END) AS system_messages
      FROM conversation_logs
      WHERE email = ?
      GROUP BY session_id
      ORDER BY started_at DESC
    `),

    getStudentStats: db.prepare(`
      SELECT
        email,
        COUNT(DISTINCT session_id) AS total_sessions,
        COUNT(*)                   AS total_messages,
        SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END)   AS user_messages,
        SUM(CASE WHEN role = 'SYSTEM' THEN 1 ELSE 0 END) AS system_messages,
        MIN(created_at) AS first_activity,
        MAX(created_at) AS last_activity
      FROM conversation_logs
      WHERE email = ?
    `),

    getAllStudentStats: db.prepare(`
      SELECT
        u.email,
        u.created_at AS registered_at,
        COUNT(DISTINCT c.session_id) AS total_sessions,
        COALESCE(SUM(CASE WHEN c.role = 'USER' THEN 1 ELSE 0 END), 0) AS user_messages,
        MAX(c.created_at) AS last_activity
      FROM users u
      LEFT JOIN conversation_logs c ON c.email = u.email
      WHERE u.role = 'student'
      GROUP BY u.email
      ORDER BY last_activity DESC NULLS LAST
    `),

    searchConversations: db.prepare(`
      SELECT id, email, session_id, role, message, created_at
      FROM conversation_logs
      WHERE email = ? AND message LIKE ?
      ORDER BY id DESC
      LIMIT ?
    `),

    // ---- token usage ----
    insertTokenUsage: db.prepare(
      "INSERT INTO token_usage (email, session_id, input_tokens, output_tokens) VALUES (?, ?, ?, ?)"
    ),
    getSessionTokens: db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0)  AS total_input,
        COALESCE(SUM(output_tokens), 0) AS total_output
      FROM token_usage WHERE session_id = ?
    `),
    getUserTokens: db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0)  AS total_input,
        COALESCE(SUM(output_tokens), 0) AS total_output
      FROM token_usage WHERE email = ?
    `),
    getAllUserTokens: db.prepare(`
      SELECT
        email,
        COUNT(DISTINCT session_id) AS sessions,
        COALESCE(SUM(input_tokens), 0)  AS total_input,
        COALESCE(SUM(output_tokens), 0) AS total_output
      FROM token_usage
      GROUP BY email
      ORDER BY total_input + total_output DESC
    `),
    getGlobalTokens: db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0)  AS total_input,
        COALESCE(SUM(output_tokens), 0) AS total_output
      FROM token_usage
    `),

    // ---- access logs ----
    insertAccess: db.prepare(
      "INSERT INTO access_logs (email, action, ip, user_agent) VALUES (?, ?, ?, ?)"
    ),
  };

  return _stmts;
}

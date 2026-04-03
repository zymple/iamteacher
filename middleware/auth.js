import { stmts } from "../db/statements.js";

/**
 * Reads auth-token cookie → populates req.user, req.sessionId, req.userRole
 */
export function sessionRestore(req, res, next) {
  const token = req.cookies["auth-token"];
  if (!token) return next();

  try {
    const session = stmts().getSession.get(token);
    if (session) {
      req.user = session.email;
      req.sessionId = session.session_id;
      req.sessionToken = token;

      const user = stmts().getUser.get(session.email);
      req.userRole = user?.role || "student";
    }
  } catch (err) {
    console.error("Session lookup error:", err);
  }

  next();
}

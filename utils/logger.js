import { stmts } from "../db/statements.js";

const DEBUG = process.env.DEBUG?.toLowerCase() === "true";

export function logAccess(email, action, ip, ua) {
  try {
    stmts().insertAccess.run(
      email || "Unknown",
      action || "",
      ip || "?",
      ua || "?"
    );
    if (DEBUG) console.log(`📘 ${email} ${action} from ${ip}`);
  } catch (err) {
    console.error("❗ Failed to write access log:", err.message);
  }
}

export function logConversation(email, sessionId, role, message) {
  try {
    stmts().insertConv.run(email, sessionId, role, message);
  } catch (err) {
    console.error("❗ Failed to write conversation log:", err.message);
  }
}

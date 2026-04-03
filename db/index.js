import fs from "fs";
import Database from "better-sqlite3";

const DB_PATH = "./app.db";
let db;

export function getDb() {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function initDb() {
  const isNewDb = !fs.existsSync(DB_PATH);

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // ---- Schema ----
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'student'
                            CHECK(role IN ('student', 'teacher', 'admin')),
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      session_id  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversation_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL,
      session_id  TEXT    NOT NULL,
      role        TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_conv_email_session
      ON conversation_logs(email, session_id);

    CREATE TABLE IF NOT EXISTS access_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT,
      action      TEXT,
      ip          TEXT,
      user_agent  TEXT,
      created_at  TEXT    DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_access_created
      ON access_logs(created_at);
  `);

  // ---- Migrate config/user.txt if DB is brand new ----
  if (isNewDb) {
    migrateUserTxt();
  }

  console.log("✅ Database ready.");
  return db;
}

function migrateUserTxt() {
  const userTxtPath = "./config/user.txt";
  if (!fs.existsSync(userTxtPath)) {
    console.log("ℹ️  New database. No config/user.txt found — starting fresh.");
    return;
  }

  console.log("📦 Migrating config/user.txt → SQLite …");
  const lines = fs.readFileSync(userTxtPath, "utf-8").split("\n").filter(Boolean);

  const insert = db.prepare(
    "INSERT OR IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)"
  );

  const migrate = db.transaction((rows) => {
    for (const line of rows) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const email = line.slice(0, idx).trim();
      const hash = line.slice(idx + 1).trim();
      insert.run(email, hash, "student");
    }
  });

  migrate(lines);
  console.log(`📦 Migrated ${lines.length} user(s).`);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

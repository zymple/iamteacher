#!/usr/bin/env node
/**
 * ============================================================
 *  iAmTeacher — Admin TUI Panel
 * ============================================================
 *
 *  Interactive terminal UI for managing users, viewing logs,
 *  and checking student progress.
 *
 *  Usage:
 *    node admin-tui.js
 *
 *  Requires:
 *    npm install inquirer@latest chalk@latest cli-table3 better-sqlite3 bcrypt
 *
 * ============================================================
 */

import inquirer from "inquirer";
import chalk from "chalk";
import Table from "cli-table3";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import fs from "fs";

// ============================================================
//  DB CONNECTION
// ============================================================
const DB_PATH = "./app.db";

if (!fs.existsSync(DB_PATH)) {
  console.error(chalk.red(`\n  ❌ Database not found at ${DB_PATH}`));
  console.error(chalk.yellow(`     Start the server first to initialize the database.\n`));
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: false });
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
//  HELPERS
// ============================================================
const ROLES = ["student", "teacher", "admin"];

function clear() {
  console.clear();
}

function header(title) {
  const line = "─".repeat(50);
  console.log(chalk.cyan(`\n  ${line}`));
  console.log(chalk.cyan.bold(`  ${title}`));
  console.log(chalk.cyan(`  ${line}\n`));
}

function success(msg) {
  console.log(chalk.green(`  ✅ ${msg}\n`));
}

function error(msg) {
  console.log(chalk.red(`  ❌ ${msg}\n`));
}

function info(msg) {
  console.log(chalk.gray(`  ℹ️  ${msg}`));
}

function printTable(headers, rows) {
  const table = new Table({
    head: headers.map((h) => chalk.cyan.bold(h)),
    style: { head: [], border: [] },
    chars: {
      top: "─", "top-mid": "┬", "top-left": "┌", "top-right": "┐",
      bottom: "─", "bottom-mid": "┴", "bottom-left": "└", "bottom-right": "┘",
      left: "│", "left-mid": "├", mid: "─", "mid-mid": "┼",
      right: "│", "right-mid": "┤", middle: "│",
    },
  });
  rows.forEach((r) => table.push(r));
  console.log(table.toString());
  console.log();
}

function roleBadge(role) {
  if (role === "admin") return chalk.red.bold(role);
  if (role === "teacher") return chalk.yellow.bold(role);
  return chalk.green(role);
}

async function pause() {
  await inquirer.prompt([
    { type: "input", name: "_", message: chalk.gray("Press Enter to continue...") },
  ]);
}

// ============================================================
//  MAIN MENU
// ============================================================
async function mainMenu() {
  clear();
  header("iAmTeacher — Admin Panel");

  console.log(chalk.gray("  Type the number of your choice and press Enter.\n"));
  console.log(chalk.white("  [1-5]  User Management"));
  console.log(chalk.white("  [6-9]  Student Progress"));
  console.log(chalk.white("  [10-12] Logs"));
  console.log(chalk.white("  [13]   Exit\n"));

  const { choice } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "choice",
      message: "What would you like to do?",
      choices: [
        { name: "List all users", value: "list_users" },
        { name: "Create new user", value: "create_user" },
        { name: "Delete user", value: "delete_user" },
        { name: "Reset user password", value: "reset_password" },
        { name: "Change user role", value: "change_role" },
        { name: "Student overview (all)", value: "student_overview" },
        { name: "Student detail", value: "student_detail" },
        { name: "View session conversation", value: "view_session" },
        { name: "Search conversations", value: "search_conversations" },
        { name: "Access logs", value: "access_logs" },
        { name: "Conversation logs", value: "conversation_logs" },
        { name: "Recent activity", value: "recent_activity" },
        { name: chalk.red("Exit"), value: "exit" },
      ],
    },
  ]);

  return choice;
}

// ============================================================
//  USER MANAGEMENT
// ============================================================
async function listUsers() {
  clear();
  header("All Users");

  const rows = db
    .prepare("SELECT id, email, role, created_at FROM users ORDER BY id")
    .all();

  if (rows.length === 0) {
    info("No users found.");
  } else {
    printTable(
      ["#", "Email", "Role", "Created"],
      rows.map((r) => [r.id, r.email, roleBadge(r.role), r.created_at || "—"])
    );
    info(`Total: ${rows.length} user(s)`);
  }
  await pause();
}

async function createUser() {
  clear();
  header("Create New User");

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "email",
      message: "Email:",
      validate: (v) => (v.includes("@") ? true : "Enter a valid email"),
    },
    {
      type: "password",
      name: "password",
      message: "Password:",
      mask: "*",
      validate: (v) => (v.length >= 4 ? true : "Min 4 characters"),
    },
    {
      type: "rawlist",
      name: "role",
      message: "Role:",
      choices: ROLES,
      default: "student",
    },
  ]);

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(answers.email);
  if (existing) {
    error(`User "${answers.email}" already exists.`);
    await pause();
    return;
  }

  const hash = await bcrypt.hash(answers.password, 10);
  db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)").run(
    answers.email,
    hash,
    answers.role
  );

  success(`Created ${answers.role} "${answers.email}"`);
  await pause();
}

async function deleteUser() {
  clear();
  header("Delete User");

  const users = db.prepare("SELECT email, role FROM users ORDER BY email").all();
  if (users.length === 0) {
    info("No users to delete.");
    await pause();
    return;
  }

  const { email } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "email",
      message: "Select user to delete:",
      choices: users.map((u) => ({
        name: `${u.email} (${u.role})`,
        value: u.email,
      })),
    },
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.red(`Are you sure you want to delete "${email}"? This cannot be undone.`),
      default: false,
    },
  ]);

  if (!confirm) {
    info("Cancelled.");
    await pause();
    return;
  }

  db.prepare("DELETE FROM sessions WHERE email = ?").run(email);
  db.prepare("DELETE FROM users WHERE email = ?").run(email);
  success(`Deleted user "${email}" (logs preserved for audit)`);
  await pause();
}

async function resetPassword() {
  clear();
  header("Reset User Password");

  const users = db.prepare("SELECT email, role FROM users ORDER BY email").all();
  if (users.length === 0) {
    info("No users found.");
    await pause();
    return;
  }

  const { email } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "email",
      message: "Select user:",
      choices: users.map((u) => ({
        name: `${u.email} (${u.role})`,
        value: u.email,
      })),
    },
  ]);

  const { password } = await inquirer.prompt([
    {
      type: "password",
      name: "password",
      message: "New password:",
      mask: "*",
      validate: (v) => (v.length >= 4 ? true : "Min 4 characters"),
    },
  ]);

  const hash = await bcrypt.hash(password, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(hash, email);
  db.prepare("DELETE FROM sessions WHERE email = ?").run(email);
  success(`Password reset for "${email}" (all sessions invalidated)`);
  await pause();
}

async function changeRole() {
  clear();
  header("Change User Role");

  const users = db.prepare("SELECT email, role FROM users ORDER BY email").all();
  if (users.length === 0) {
    info("No users found.");
    await pause();
    return;
  }

  const { email } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "email",
      message: "Select user:",
      choices: users.map((u) => ({
        name: `${u.email} (${roleBadge(u.role)})`,
        value: u.email,
      })),
    },
  ]);

  const current = db.prepare("SELECT role FROM users WHERE email = ?").get(email);

  const { role } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "role",
      message: `Current role: ${roleBadge(current.role)}. New role:`,
      choices: ROLES,
    },
  ]);

  db.prepare("UPDATE users SET role = ? WHERE email = ?").run(role, email);
  success(`Changed "${email}" from ${current.role} → ${role}`);
  await pause();
}

// ============================================================
//  STUDENT PROGRESS
// ============================================================
async function studentOverview() {
  clear();
  header("Student Overview");

  const rows = db
    .prepare(
      `
      SELECT
        u.email,
        COUNT(DISTINCT c.session_id) AS sessions,
        COUNT(c.id) AS total_msgs,
        COALESCE(SUM(CASE WHEN c.role = 'USER' THEN 1 ELSE 0 END), 0) AS student_msgs,
        COALESCE(SUM(CASE WHEN c.role = 'SYSTEM' THEN 1 ELSE 0 END), 0) AS ai_msgs,
        MAX(c.created_at) AS last_active
      FROM users u
      LEFT JOIN conversation_logs c ON c.email = u.email
      WHERE u.role = 'student'
      GROUP BY u.email
      ORDER BY last_active DESC NULLS LAST
    `
    )
    .all();

  if (rows.length === 0) {
    info("No students found.");
  } else {
    printTable(
      ["Email", "Sessions", "Total Msgs", "Student / AI", "Last Active"],
      rows.map((r) => [
        r.email,
        String(r.sessions),
        String(r.total_msgs),
        `${r.student_msgs} / ${r.ai_msgs}`,
        r.last_active || chalk.gray("never"),
      ])
    );
    info(`Total: ${rows.length} student(s)`);
    info(
      `"Student / AI" counts messages with role=USER vs role=SYSTEM.`
    );
    info(
      `If both are 0 but Total Msgs > 0, check your frontend sends the correct role field.`
    );
  }
  await pause();
}

async function studentDetail() {
  clear();
  header("Student Detail");

  const students = db
    .prepare("SELECT email FROM users WHERE role = 'student' ORDER BY email")
    .all();

  if (students.length === 0) {
    info("No students found.");
    await pause();
    return;
  }

  const { email } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "email",
      message: "Select student:",
      choices: students.map((s) => s.email),
    },
  ]);

  // Stats
  const stats = db
    .prepare(
      `
      SELECT
        COUNT(DISTINCT session_id) AS total_sessions,
        COUNT(*) AS total_messages,
        SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) AS user_msgs,
        SUM(CASE WHEN role = 'SYSTEM' THEN 1 ELSE 0 END) AS system_msgs,
        MIN(created_at) AS first_activity,
        MAX(created_at) AS last_activity
      FROM conversation_logs
      WHERE email = ?
    `
    )
    .get(email);

  console.log(chalk.bold(`\n  Student: ${email}\n`));
  console.log(`  Total sessions:    ${chalk.cyan(stats.total_sessions || 0)}`);
  console.log(`  Total messages:    ${chalk.cyan(stats.total_messages || 0)}`);
  console.log(`  Student messages:  ${chalk.green(stats.user_msgs || 0)}`);
  console.log(`  System messages:   ${chalk.yellow(stats.system_msgs || 0)}`);
  console.log(`  First activity:    ${stats.first_activity || chalk.gray("—")}`);
  console.log(`  Last activity:     ${stats.last_activity || chalk.gray("—")}`);
  console.log();

  // Sessions
  const sessions = db
    .prepare(
      `
      SELECT
        session_id,
        MIN(created_at) AS started,
        MAX(created_at) AS ended,
        COUNT(*) AS msgs,
        SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) AS user_msgs
      FROM conversation_logs
      WHERE email = ?
      GROUP BY session_id
      ORDER BY started DESC
      LIMIT 20
    `
    )
    .all(email);

  if (sessions.length > 0) {
    printTable(
      ["Session ID", "Started", "Last Msg", "Total", "Student Msgs"],
      sessions.map((s) => [
        s.session_id.slice(0, 12) + "…",
        s.started || "—",
        s.ended || "—",
        String(s.msgs),
        String(s.user_msgs),
      ])
    );
  }

  // Option to view a session
  if (sessions.length > 0) {
    const { viewSession } = await inquirer.prompt([
      {
        type: "confirm",
        name: "viewSession",
        message: "View a session conversation?",
        default: false,
      },
    ]);

    if (viewSession) {
      const { sessionId } = await inquirer.prompt([
        {
          type: "rawlist",
          name: "sessionId",
          message: "Select session:",
          choices: sessions.map((s) => ({
            name: `${s.started} (${s.msgs} msgs) — ${s.session_id.slice(0, 12)}…`,
            value: s.session_id,
          })),
        },
      ]);
      await displaySession(sessionId);
      return;
    }
  }

  await pause();
}

async function viewSessionMenu() {
  clear();
  header("View Session Conversation");

  // Load recent sessions grouped by student
  const sessions = db
    .prepare(
      `
      SELECT
        c.session_id,
        c.email,
        MIN(c.created_at) AS started,
        MAX(c.created_at) AS ended,
        COUNT(*) AS total_msgs,
        SUM(CASE WHEN c.role = 'USER' THEN 1 ELSE 0 END) AS user_msgs,
        SUM(CASE WHEN c.role = 'SYSTEM' THEN 1 ELSE 0 END) AS system_msgs
      FROM conversation_logs c
      GROUP BY c.session_id
      ORDER BY started DESC
      LIMIT 30
    `
    )
    .all();

  if (sessions.length === 0) {
    info("No sessions found.");
    await pause();
    return;
  }

  console.log(chalk.gray("  Showing the 30 most recent sessions:\n"));

  // Display a numbered table so users can see what they're picking
  printTable(
    ["#", "Student", "Started", "Total Msgs", "Student / AI", "Session ID"],
    sessions.map((s, i) => [
      String(i + 1),
      s.email,
      s.started || "—",
      String(s.total_msgs),
      `${s.user_msgs} / ${s.system_msgs}`,
      s.session_id.slice(0, 12) + "…",
    ])
  );

  const { selected } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "selected",
      message: "Select a session to view:",
      choices: [
        ...sessions.map((s, i) => ({
          name: `${s.email}  ${s.started}  (${s.total_msgs} msgs)`,
          value: s.session_id,
        })),
        { name: chalk.gray("Cancel — back to menu"), value: "__cancel__" },
      ],
    },
  ]);

  if (selected === "__cancel__") return;
  await displaySession(selected);
}

async function displaySession(sessionId) {
  clear();
  header(`Session: ${sessionId.slice(0, 20)}…`);

  const rows = db
    .prepare(
      "SELECT role, message, created_at FROM conversation_logs WHERE session_id = ? ORDER BY id"
    )
    .all(sessionId);

  if (rows.length === 0) {
    error("No messages found.");
    await pause();
    return;
  }

  // Find who this session belongs to
  const firstRow = rows[0];
  const owner = db
    .prepare("SELECT email FROM conversation_logs WHERE session_id = ? LIMIT 1")
    .get(sessionId);

  info(`Student: ${owner?.email || "Unknown"}`);
  info(`Messages: ${rows.length}\n`);

  for (const row of rows) {
    const time = chalk.gray(row.created_at);
    let prefix;
    let msg;

    switch (row.role) {
      case "USER":
        prefix = chalk.green.bold("  STUDENT ");
        msg = chalk.green(row.message);
        break;
      case "SYSTEM":
        prefix = chalk.yellow.bold("  TEACHER ");
        msg = chalk.yellow(row.message);
        break;
      case "INFO":
        prefix = chalk.blue.bold("  INFO    ");
        msg = chalk.blue(row.message);
        break;
      default:
        prefix = chalk.gray.bold(`  ${row.role.padEnd(8)}`);
        msg = row.message;
    }

    console.log(`${time} ${prefix} ${msg}`);
  }
  console.log();

  await pause();
}

async function searchConversations() {
  clear();
  header("Search Conversations");

  // Optionally filter by student
  const students = db
    .prepare("SELECT email FROM users WHERE role = 'student' ORDER BY email")
    .all();

  const studentChoices = [
    { name: "All students", value: "__all__" },
    ...students.map((s) => ({ name: s.email, value: s.email })),
  ];

  const { email, query, limit } = await inquirer.prompt([
    {
      type: "rawlist",
      name: "email",
      message: "Filter by student:",
      choices: studentChoices,
    },
    {
      type: "input",
      name: "query",
      message: "Search term:",
      validate: (v) => (v.trim() ? true : "Enter a search term"),
    },
    {
      type: "number",
      name: "limit",
      message: "Max results:",
      default: 30,
    },
  ]);

  let sql = `
    SELECT email, session_id, role, message, created_at
    FROM conversation_logs
    WHERE message LIKE ?
  `;
  const params = [`%${query}%`];

  if (email !== "__all__") {
    sql += " AND email = ?";
    params.push(email);
  }

  sql += " ORDER BY id DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  clear();
  header(`Search Results: "${query}"`);

  if (rows.length === 0) {
    info("No results found.");
  } else {
    info(`Found ${rows.length} result(s):\n`);
    for (const row of rows) {
      const time = chalk.gray(row.created_at);
      const who = chalk.cyan(row.email);
      const role =
        row.role === "USER"
          ? chalk.green("STUDENT")
          : row.role === "SYSTEM"
          ? chalk.yellow("SYSTEM ")
          : chalk.blue("INFO   ");

      // Highlight the search term
      const highlighted = row.message.replace(
        new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"),
        chalk.bgYellow.black("$1")
      );

      console.log(`  ${time}  ${who}  ${role}  ${highlighted}`);
    }
    console.log();
  }

  await pause();
}

// ============================================================
//  LOGS
// ============================================================
async function accessLogs() {
  clear();
  header("Access Logs");

  const { email, limit } = await inquirer.prompt([
    {
      type: "input",
      name: "email",
      message: "Filter by email (leave blank for all):",
    },
    {
      type: "number",
      name: "limit",
      message: "How many entries?",
      default: 30,
    },
  ]);

  let sql = "SELECT * FROM access_logs WHERE 1=1";
  const params = [];

  if (email.trim()) {
    sql += " AND email = ?";
    params.push(email.trim());
  }

  sql += " ORDER BY id DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  clear();
  header("Access Logs");

  if (rows.length === 0) {
    info("No logs found.");
  } else {
    printTable(
      ["Time", "Email", "Action", "IP"],
      rows.map((r) => [
        r.created_at || "—",
        r.email || "—",
        r.action || "—",
        r.ip || "—",
      ])
    );
  }

  await pause();
}

async function conversationLogs() {
  clear();
  header("Conversation Logs");

  const { email, role, limit } = await inquirer.prompt([
    {
      type: "input",
      name: "email",
      message: "Filter by email (leave blank for all):",
    },
    {
      type: "rawlist",
      name: "role",
      message: "Filter by role:",
      choices: ["ALL", "USER", "SYSTEM", "INFO"],
      default: "ALL",
    },
    {
      type: "number",
      name: "limit",
      message: "How many entries?",
      default: 50,
    },
  ]);

  let sql = "SELECT * FROM conversation_logs WHERE 1=1";
  const params = [];

  if (email.trim()) {
    sql += " AND email = ?";
    params.push(email.trim());
  }
  if (role !== "ALL") {
    sql += " AND role = ?";
    params.push(role);
  }

  sql += " ORDER BY id DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  clear();
  header("Conversation Logs");

  if (rows.length === 0) {
    info("No logs found.");
  } else {
    for (const row of rows) {
      const time = chalk.gray(row.created_at);
      const who = chalk.cyan(row.email);
      const roleLabel =
        row.role === "USER"
          ? chalk.green("STUDENT")
          : row.role === "SYSTEM"
          ? chalk.yellow("SYSTEM ")
          : chalk.blue("INFO   ");
      const sid = chalk.gray(row.session_id?.slice(0, 8) + "…");

      console.log(`  ${time}  ${who}  ${sid}  ${roleLabel}  ${row.message}`);
    }
    console.log();
    info(`Showing ${rows.length} entries (newest first)`);
  }

  await pause();
}

async function recentActivity() {
  clear();
  header("Recent Student Activity");

  const { hours, limit } = await inquirer.prompt([
    {
      type: "number",
      name: "hours",
      message: "Show activity from the last N hours:",
      default: 24,
    },
    {
      type: "number",
      name: "limit",
      message: "Max entries:",
      default: 100,
    },
  ]);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const rows = db
    .prepare(
      `
      SELECT c.email, c.session_id, c.role, c.message, c.created_at
      FROM conversation_logs c
      JOIN users u ON u.email = c.email
      WHERE u.role = 'student' AND c.created_at >= ?
      ORDER BY c.id DESC
      LIMIT ?
    `
    )
    .all(since, limit);

  clear();
  header(`Activity — Last ${hours} Hour(s)`);

  if (rows.length === 0) {
    info("No activity in this period.");
  } else {
    for (const row of rows) {
      const time = chalk.gray(row.created_at);
      const who = chalk.cyan(row.email);
      const roleLabel =
        row.role === "USER"
          ? chalk.green("STUDENT")
          : row.role === "SYSTEM"
          ? chalk.yellow("SYSTEM ")
          : chalk.blue("INFO   ");

      console.log(`  ${time}  ${who}  ${roleLabel}  ${row.message}`);
    }
    console.log();
    info(`${rows.length} entries`);
  }

  await pause();
}

// ============================================================
//  APP LOOP
// ============================================================
async function run() {
  while (true) {
    const choice = await mainMenu();

    switch (choice) {
      case "list_users":
        await listUsers();
        break;
      case "create_user":
        await createUser();
        break;
      case "delete_user":
        await deleteUser();
        break;
      case "reset_password":
        await resetPassword();
        break;
      case "change_role":
        await changeRole();
        break;
      case "student_overview":
        await studentOverview();
        break;
      case "student_detail":
        await studentDetail();
        break;
      case "view_session":
        await viewSessionMenu();
        break;
      case "search_conversations":
        await searchConversations();
        break;
      case "access_logs":
        await accessLogs();
        break;
      case "conversation_logs":
        await conversationLogs();
        break;
      case "recent_activity":
        await recentActivity();
        break;
      case "exit":
        db.close();
        console.log(chalk.gray("\n  Goodbye! 👋\n"));
        process.exit(0);
    }
  }
}

run().catch((err) => {
  console.error(chalk.red("\n  Fatal error:"), err);
  db.close();
  process.exit(1);
});
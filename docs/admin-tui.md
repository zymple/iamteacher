# iAmTeacher — Admin TUI Guide

> A terminal-based admin panel for managing users, monitoring student progress, viewing logs, and tracking token usage — all without a web browser.

---

## Setup

### Prerequisites

Make sure you have these npm packages installed in your project:

```bash
npm install inquirer chalk cli-table3 better-sqlite3 bcrypt
```

### First Run

The TUI reads directly from `app.db`. The server must have been started at least once to create the database.

```bash
node admin-tui.js
```

If the database doesn't exist yet, you'll see:

```
❌ Database not found at ./app.db
   Start the server first to initialize the database.
```

### Important Notes

- The TUI can run **while the server is running** — SQLite WAL mode handles concurrent access safely.
- Run it from your **project root** (same directory as `app.db`).
- All menus use **numbered choices** — type the number and press Enter. This works reliably over SSH, tmux, and all terminal types.

---

## Main Menu

```
  [1-5]  User Management
  [6-9]  Student Progress
  [10-13] Logs & Usage
  [14]   Exit

? What would you like to do?
  1) List all users
  2) Create new user
  3) Delete user
  4) Reset user password
  5) Change user role
  6) Student overview (all)
  7) Student detail
  8) View session conversation
  9) Search conversations
  10) Access logs
  11) Conversation logs
  12) Recent activity
  13) Token usage
  14) Exit
  Answer:
```

---

## 1. List All Users

Shows a table of every user in the system.

```
┌───┬─────────────────────┬─────────┬─────────────────────┐
│ # │ Email               │ Role    │ Created             │
├───┼─────────────────────┼─────────┼─────────────────────┤
│ 1 │ admin@school.com    │ admin   │ 2026-04-01 08:00:00 │
│ 2 │ demo@demo.com       │ student │ 2026-04-01 10:00:00 │
│ 3 │ test@meow.com       │ student │ 2026-04-02 12:00:00 │
└───┴─────────────────────┴─────────┴─────────────────────┘
  Total: 3 user(s)
```

Roles are color-coded: admin (red), teacher (yellow), student (green).

---

## 2. Create New User

Interactive prompts to create a user with any role.

```
? Email: newstudent@school.com
? Password: ****
? Role:
  1) student
  2) teacher
  3) admin
  Answer: 1

  ✅ Created student "newstudent@school.com"
```

- Email must contain `@`
- Password minimum 4 characters (input is masked)
- Checks for duplicates before creating

---

## 3. Delete User

Select a user from the list, then confirm deletion.

```
? Select user to delete:
  1) admin@school.com (admin)
  2) demo@demo.com (student)
  3) test@meow.com (student)
  Answer: 3

? Are you sure you want to delete "test@meow.com"? This cannot be undone. (y/N) y

  ✅ Deleted user "test@meow.com" (logs preserved for audit)
```

- The user's sessions are deleted (they're logged out immediately)
- Conversation logs and access logs are **kept** for audit trail
- Confirmation required — defaults to No

---

## 4. Reset User Password

Pick a user, enter their new password.

```
? Select user:
  1) demo@demo.com (student)
  2) teacher@school.com (teacher)
  Answer: 1

? New password: ********

  ✅ Password reset for "demo@demo.com" (all sessions invalidated)
```

- All active sessions for that user are invalidated — they must log in again
- Password input is masked

---

## 5. Change User Role

Pick a user, then pick their new role.

```
? Select user:
  1) demo@demo.com (student)
  2) teacher@school.com (teacher)
  Answer: 1

? Current role: student. New role:
  1) student
  2) teacher
  3) admin
  Answer: 2

  ✅ Changed "demo@demo.com" from student → teacher
```

---

## 6. Student Overview

Dashboard showing all students with their activity summary.

```
┌──────────────────┬──────────┬────────────┬──────────────┬─────────────────────┐
│ Email            │ Sessions │ Total Msgs │ Student / AI │ Last Active         │
├──────────────────┼──────────┼────────────┼──────────────┼─────────────────────┤
│ demo@demo.com    │ 3        │ 18         │ 6 / 6        │ 2026-04-03 09:23:24 │
│ test@meow.com    │ 0        │ 0          │ 0 / 0        │ never               │
└──────────────────┴──────────┴────────────┴──────────────┴─────────────────────┘
  Total: 2 student(s)
  "Student / AI" counts messages with role=USER vs role=SYSTEM.
```

**Columns explained:**

- **Sessions** — number of distinct voice sessions
- **Total Msgs** — all logged messages (USER + SYSTEM + INFO)
- **Student / AI** — messages where `role=USER` vs `role=SYSTEM`
- **Last Active** — timestamp of the most recent message

If Student is 0 but AI > 0, it means the frontend isn't sending `role: "USER"` for student speech (see the `input_audio_transcription` setup in the API docs).

---

## 7. Student Detail

Pick a student to see full stats and their session history.

```
  Student: demo@demo.com

  Total sessions:    3
  Total messages:    18
  Student messages:  6
  System messages:   6
  First activity:    2026-04-01 10:05:00
  Last activity:     2026-04-03 09:23:24

┌──────────────┬─────────────────────┬─────────────────────┬───────┬──────────────┐
│ Session ID   │ Started             │ Last Msg            │ Total │ Student Msgs │
├──────────────┼─────────────────────┼─────────────────────┼───────┼──────────────┤
│ a14451b2a6…  │ 2026-04-03 09:20:00 │ 2026-04-03 09:23:24 │ 8     │ 3            │
│ b25562c3b7…  │ 2026-04-02 14:10:00 │ 2026-04-02 14:18:30 │ 6     │ 2            │
│ c36673d4c8…  │ 2026-04-01 10:05:00 │ 2026-04-01 10:12:00 │ 4     │ 1            │
└──────────────┴─────────────────────┴─────────────────────┴───────┴──────────────┘

? View a session conversation? (y/N)
```

If you say yes, you can pick a session to view the full conversation (same as option 8).

---

## 8. View Session Conversation

Shows the 30 most recent sessions across all users, then lets you pick one to read.

```
┌───┬──────────────────┬─────────────────────┬────────────┬──────────────┬───────────────┐
│ # │ Student          │ Started             │ Total Msgs │ Student / AI │ Session ID    │
├───┼──────────────────┼─────────────────────┼────────────┼──────────────┼───────────────┤
│ 1 │ demo@demo.com    │ 2026-04-03 09:20:00 │ 8          │ 3 / 3        │ a14451b2a6…   │
│ 2 │ demo@demo.com    │ 2026-04-02 14:10:00 │ 6          │ 2 / 2        │ b25562c3b7…   │
└───┴──────────────────┴─────────────────────┴────────────┴──────────────┴───────────────┘

? Select a session to view:
  1) demo@demo.com  2026-04-03 09:20:00  (8 msgs)
  2) demo@demo.com  2026-04-02 14:10:00  (6 msgs)
  3) Cancel — back to menu
  Answer: 1
```

The conversation is displayed color-coded:

```
  Student: demo@demo.com
  Messages: 8

  2026-04-03 09:20:00  INFO      Conversation started
  2026-04-03 09:20:05  TEACHER   Hello! What movie did you watch yesterday?
  2026-04-03 09:20:15  STUDENT   I watched Spider-Man!
  2026-04-03 09:20:22  TEACHER   Oh, Spider-Man! Did you like it?
  2026-04-03 09:20:30  STUDENT   Yes, I liked it very much!
  ...
```

- **STUDENT** (green) = `role: USER`
- **TEACHER** (yellow) = `role: SYSTEM`
- **INFO** (blue) = system events (session start/end, errors)

---

## 9. Search Conversations

Full-text search across student messages.

```
? Filter by student:
  1) All students
  2) demo@demo.com
  3) test@meow.com
  Answer: 1

? Search term: spider
? Max results: 30
```

Results show each matching message with the search term highlighted:

```
  2026-04-03 09:20:15  demo@demo.com  STUDENT  I watched [Spider]-Man!
  2026-04-03 09:20:22  demo@demo.com  SYSTEM   Oh, [Spider]-Man! Did you like it?
```

---

## 10. Access Logs

View login/logout events, token requests, and admin actions.

```
? Filter by email (leave blank for all):
? How many entries? 30

┌─────────────────────┬──────────────────┬──────────────────────────────────┬─────────────────┐
│ Time                │ Email            │ Action                           │ IP              │
├─────────────────────┼──────────────────┼──────────────────────────────────┼─────────────────┤
│ 2026-04-03 09:23:30 │ demo@demo.com    │ ended voice session after 125s   │ 203.0.113.42    │
│ 2026-04-03 09:19:50 │ demo@demo.com    │ logged in                        │ 203.0.113.42    │
│ 2026-04-03 09:00:00 │ admin@school.com │ changed role of test to teacher   │ 10.0.0.1        │
└─────────────────────┴──────────────────┴──────────────────────────────────┴─────────────────┘
```

---

## 11. Conversation Logs

Browse raw conversation log entries with filters.

```
? Filter by email (leave blank for all): demo@demo.com
? Filter by role:
  1) ALL
  2) USER
  3) SYSTEM
  4) INFO
  Answer: 2
? How many entries? 20
```

Shows each entry as a single line:

```
  2026-04-03 09:20:30  demo@demo.com  a14451b2…  STUDENT  Yes, I liked it very much!
  2026-04-03 09:20:15  demo@demo.com  a14451b2…  STUDENT  I watched Spider-Man!
```

---

## 12. Recent Activity

Shows all student conversation activity within a time window.

```
? Show activity from the last N hours: 24
? Max entries: 100
```

Displays a chronological feed of all student messages from the last N hours across every student.

---

## 13. Token Usage

View OpenAI API token consumption globally and per user.

```
  Global Total
  Input tokens:   15,230
  Output tokens:  8,412
  Combined:       23,642

┌──────────────────┬──────────┬────────┬────────┬────────┐
│ Email            │ Sessions │ Input  │ Output │ Total  │
├──────────────────┼──────────┼────────┼────────┼────────┤
│ demo@demo.com    │ 3        │ 12,000 │ 6,500  │ 18,500 │
│ test@meow.com    │ 1        │ 3,230  │ 1,912  │ 5,142  │
└──────────────────┴──────────┴────────┴────────┴────────┘

? View per-session breakdown for a user? (y/N) y

? Select user:
  1) demo@demo.com
  2) test@meow.com
  Answer: 1
```

Drill-down shows per-session token usage:

```
  Total input:   12,000
  Total output:  6,500
  Combined:      18,500

┌──────────────┬────────┬────────┬────────┬─────────────────────┬─────────────────────┐
│ Session ID   │ Input  │ Output │ Total  │ First               │ Last                │
├──────────────┼────────┼────────┼────────┼─────────────────────┼─────────────────────┤
│ a14451b2a6…  │ 5,000  │ 2,800  │ 7,800  │ 2026-04-03 09:20:05 │ 2026-04-03 09:23:24 │
│ b25562c3b7…  │ 4,200  │ 2,100  │ 6,300  │ 2026-04-02 14:10:00 │ 2026-04-02 14:18:30 │
│ c36673d4c8…  │ 2,800  │ 1,600  │ 4,400  │ 2026-04-01 10:05:00 │ 2026-04-01 10:12:00 │
└──────────────┴────────┴────────┴────────┴─────────────────────┴─────────────────────┘
```

Token data only appears after students have conversations with the `input_audio_transcription` and token logging enabled on the frontend.

---

## Tips

**Running over SSH:**
The TUI uses numbered menus (`rawlist`) instead of arrow-key navigation, so it works perfectly over SSH, tmux, screen, and Mosh.

**Safe to run alongside the server:**
SQLite WAL mode allows the TUI to read the database while the server writes to it. No locking issues.

**Creating your first admin:**
Use the TUI itself — option 2 (Create new user) lets you pick any role including admin.

```
? Email: admin@school.com
? Password: ****
? Role:
  1) student
  2) teacher
  3) admin
  Answer: 3

  ✅ Created admin "admin@school.com"
```

**Keyboard shortcuts:**
- Type a number + Enter to select
- Press Enter on "Press Enter to continue..." to go back to the menu
- Ctrl+C to force quit at any time
# iAmTeacher — API Documentation

> **Base URL:** `https://your-domain.com` or `http://localhost:3000`
>
> **Authentication:** Cookie-based. All non-public endpoints require an `auth-token` cookie set by `/login`. Send `credentials: "include"` in all fetch requests.
>
> **Content-Type:** All POST/PATCH/DELETE bodies are `application/json`.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Conversation & Voice](#2-conversation--voice)
3. [Teacher — Student Progress](#3-teacher--student-progress)
4. [Teacher — Token Usage](#4-teacher--token-usage)
5. [Admin — User Management](#5-admin--user-management)
6. [Admin — Logs](#6-admin--logs)
7. [Pagination](#7-pagination)
8. [Error Handling](#8-error-handling)
9. [Roles & Permissions](#9-roles--permissions)

---

## 1. Authentication

### `POST /login`

Login and receive an `auth-token` cookie.

**Body:**
```json
{
  "email": "student@example.com",
  "password": "secret123"
}
```

**Success:** `302` redirect to `/`  
**Failure:** `401` `"Invalid email or password"`

The response sets an `auth-token` httpOnly cookie valid for 7 days.

---

### `POST /logout`

Clear session and cookie.

**Success:** `302` redirect to `/login`

---

### `GET /api/me`

Get current user info.

**Response:**
```json
{
  "email": "demo@demo.com",
  "sessionId": "a14451b2-a686-41af-b4a7-a9435e4b9631",
  "role": "student"
}
```

**Failure:** `401` `{ "error": "Not authenticated" }`

---

## 2. Conversation & Voice

### `POST /conversation/log`

Log a conversation message (student speech, AI response, or info).

**Body:**
```json
{
  "role": "USER",
  "text": "I watched a movie yesterday!"
}
```

| Field | Type   | Required | Values                    |
|-------|--------|----------|---------------------------|
| role  | string | no       | `"USER"`, `"SYSTEM"`, `"INFO"` (default: `"SYSTEM"`) |
| text  | string | yes      | The message content       |

**Response:** `{ "success": true }`

---

### `POST /conversation/tokens`

Log token usage from an OpenAI `response.done` event.

**Body:**
```json
{
  "input_tokens": 245,
  "output_tokens": 118
}
```

| Field         | Type    | Required | Description                 |
|---------------|---------|----------|-----------------------------|
| input_tokens  | number  | yes*     | Tokens consumed as input    |
| output_tokens | number  | yes*     | Tokens generated as output  |

*At least one must be non-zero.

**Response:** `{ "success": true }`

---

### `POST /log-voice-session`

Log voice session start or end.

**Body (start):**
```json
{
  "action": "start"
}
```

**Body (stop):**
```json
{
  "action": "stop",
  "duration": 125,
  "reason": ""
}
```

| Field    | Type   | Required | Description                      |
|----------|--------|----------|----------------------------------|
| action   | string | yes      | `"start"` or `"stop"`           |
| duration | number | no       | Session length in seconds        |
| reason   | string | no       | Why session ended (e.g. `"inactive-30s"`) |

**Response:** `{ "success": true }`

---

### `GET /token`

Get an OpenAI ephemeral key for WebRTC Realtime API.

**Response:** OpenAI session object containing `client_secret.value`.

---

## 3. Teacher — Student Progress

> **Required role:** `teacher` or `admin`

### `GET /api/teacher/students`

Dashboard overview of all students.

**Response:**
```json
{
  "rows": [
    {
      "email": "demo@demo.com",
      "registered_at": "2026-04-01 10:00:00",
      "total_sessions": 3,
      "user_messages": 12,
      "last_activity": "2026-04-03 09:23:24"
    }
  ]
}
```

---

### `GET /api/teacher/students/:email`

Detailed stats for one student.

**Example:** `GET /api/teacher/students/demo@demo.com`

**Response:**
```json
{
  "email": "demo@demo.com",
  "registered_at": "2026-04-01 10:00:00",
  "total_sessions": 3,
  "total_messages": 18,
  "user_messages": 6,
  "system_messages": 6,
  "first_activity": "2026-04-01 10:05:00",
  "last_activity": "2026-04-03 09:23:24"
}
```

---

### `GET /api/teacher/students/:email/sessions`

List all sessions for a student with per-session message breakdown.

**Response:**
```json
{
  "email": "demo@demo.com",
  "sessions": [
    {
      "session_id": "a14451b2-a686-41af-b4a7-a9435e4b9631",
      "started_at": "2026-04-03 09:20:00",
      "last_activity": "2026-04-03 09:23:24",
      "message_count": 8,
      "user_messages": 3,
      "system_messages": 3
    }
  ]
}
```

---

### `GET /api/teacher/sessions/:sessionId`

Full conversation of a session (every message in order).

**Response:**
```json
{
  "session_id": "a14451b2-a686-41af-b4a7-a9435e4b9631",
  "messages": [
    {
      "role": "INFO",
      "message": "Conversation started",
      "created_at": "2026-04-03 09:20:00"
    },
    {
      "role": "SYSTEM",
      "message": "Hello! What movie did you watch yesterday?",
      "created_at": "2026-04-03 09:20:05"
    },
    {
      "role": "USER",
      "message": "I watched Spider-Man!",
      "created_at": "2026-04-03 09:20:15"
    }
  ]
}
```

---

### `GET /api/teacher/sessions/:sessionId/export`

Download a session as plain text.

**Response:** `Content-Type: text/plain`
```
2026-04-03 09:20:00 INFO: Conversation started
2026-04-03 09:20:05 SYSTEM: Hello! What movie did you watch yesterday?
2026-04-03 09:20:15 USER: I watched Spider-Man!
```

---

### `GET /api/teacher/students/:email/search`

Search through a student's conversation messages.

| Query Param | Type   | Required | Description         |
|-------------|--------|----------|---------------------|
| q           | string | yes      | Search term         |
| limit       | number | no       | Max results (default: 50) |

**Example:** `GET /api/teacher/students/demo@demo.com/search?q=movie&limit=20`

**Response:**
```json
{
  "email": "demo@demo.com",
  "query": "movie",
  "rows": [
    {
      "id": 42,
      "email": "demo@demo.com",
      "session_id": "a14451b2-...",
      "role": "SYSTEM",
      "message": "What movie did you watch yesterday?",
      "created_at": "2026-04-03 09:20:05"
    }
  ]
}
```

---

### `GET /api/teacher/activity`

Recent conversation activity across all students.

| Query Param | Type   | Required | Description                         |
|-------------|--------|----------|-------------------------------------|
| from        | string | no       | ISO datetime or `YYYY-MM-DD`        |
| to          | string | no       | ISO datetime or `YYYY-MM-DD`        |
| limit       | number | no       | Max entries (default: 100)          |

**Example:** `GET /api/teacher/activity?from=2026-04-03&limit=50`

**Response:**
```json
{
  "rows": [
    {
      "id": 99,
      "email": "demo@demo.com",
      "session_id": "a14451b2-...",
      "role": "USER",
      "message": "I watched Spider-Man!",
      "created_at": "2026-04-03 09:20:15"
    }
  ]
}
```

---

## 4. Teacher — Token Usage

> **Required role:** `teacher` or `admin`

### `GET /api/teacher/tokens`

Global token usage + per-user breakdown.

**Response:**
```json
{
  "global": {
    "total_input": 15230,
    "total_output": 8412
  },
  "perUser": [
    {
      "email": "demo@demo.com",
      "sessions": 3,
      "total_input": 12000,
      "total_output": 6500
    },
    {
      "email": "test@meow.com",
      "sessions": 1,
      "total_input": 3230,
      "total_output": 1912
    }
  ]
}
```

**Frontend usage tip:** To show total cost, calculate `(total_input + total_output)` and multiply by your model's per-token price.

---

### `GET /api/teacher/tokens/:email`

Token usage for a single user with per-session breakdown.

**Example:** `GET /api/teacher/tokens/demo@demo.com`

**Response:**
```json
{
  "email": "demo@demo.com",
  "totals": {
    "total_input": 12000,
    "total_output": 6500
  },
  "sessions": [
    {
      "session_id": "a14451b2-a686-41af-b4a7-a9435e4b9631",
      "input_tokens": 5000,
      "output_tokens": 2800,
      "first_use": "2026-04-03 09:20:05",
      "last_use": "2026-04-03 09:23:24"
    },
    {
      "session_id": "b25562c3-b797-52bg-c5b8-b0546f5ca742",
      "input_tokens": 7000,
      "output_tokens": 3700,
      "first_use": "2026-04-02 14:10:00",
      "last_use": "2026-04-02 14:18:30"
    }
  ]
}
```

---

## 5. Admin — User Management

> **Required role:** `admin`

### `GET /api/admin/users`

List all users.

| Query Param | Type   | Required | Description                        |
|-------------|--------|----------|------------------------------------|
| role        | string | no       | Filter: `student`, `teacher`, `admin` |
| limit       | number | no       | Default: 50                        |
| offset      | number | no       | Default: 0                         |

**Response:**
```json
{
  "rows": [
    {
      "id": 1,
      "email": "admin@school.com",
      "role": "admin",
      "created_at": "2026-04-01 08:00:00"
    },
    {
      "id": 2,
      "email": "demo@demo.com",
      "role": "student",
      "created_at": "2026-04-01 10:00:00"
    }
  ]
}
```

---

### `POST /api/admin/users`

Create a new user.

**Body:**
```json
{
  "email": "newteacher@school.com",
  "password": "secret123",
  "role": "teacher"
}
```

| Field    | Type   | Required | Default     | Values                            |
|----------|--------|----------|-------------|-----------------------------------|
| email    | string | yes      |             | Must be unique                    |
| password | string | yes      |             |                                   |
| role     | string | no       | `"student"` | `"student"`, `"teacher"`, `"admin"` |

**Success:** `201`
```json
{ "success": true, "email": "newteacher@school.com", "role": "teacher" }
```

**Failure:** `409` `{ "error": "User already exists" }`

---

### `DELETE /api/admin/users/:email`

Delete a user. Removes the user and all their sessions. Conversation and access logs are preserved for audit.

**Example:** `DELETE /api/admin/users/oldstudent@example.com`

**Success:**
```json
{ "success": true, "deleted": "oldstudent@example.com" }
```

**Failure:**
- `400` `{ "error": "Cannot delete your own account" }`
- `404` `{ "error": "User not found" }`

---

### `PATCH /api/admin/users/:email/role`

Change a user's role.

**Body:**
```json
{ "role": "teacher" }
```

**Success:**
```json
{ "success": true, "email": "demo@demo.com", "role": "teacher" }
```

---

### `PATCH /api/admin/users/:email/password`

Reset a user's password. Invalidates all their active sessions.

**Body:**
```json
{ "password": "newpassword123" }
```

**Success:**
```json
{ "success": true, "email": "demo@demo.com" }
```

**Failure:** `400` `{ "error": "Password is required (min 4 characters)" }`

---

## 6. Admin — Logs

> **Required role:** `admin`

### `GET /api/admin/logs/access`

Query access logs (logins, logouts, token requests, role changes, etc.).

| Query Param | Type   | Required | Description                          |
|-------------|--------|----------|--------------------------------------|
| email       | string | no       | Exact match                          |
| action      | string | no       | Partial match (e.g. `"logged"`)      |
| from        | string | no       | ISO datetime or `YYYY-MM-DD`         |
| to          | string | no       | ISO datetime or `YYYY-MM-DD`         |
| limit       | number | no       | Default: 50                          |
| offset      | number | no       | Default: 0                           |

**Response:**
```json
{
  "total": 142,
  "limit": 50,
  "offset": 0,
  "rows": [
    {
      "id": 142,
      "email": "demo@demo.com",
      "action": "logged in",
      "ip": "203.0.113.42",
      "user_agent": "Mozilla/5.0 ...",
      "created_at": "2026-04-03 09:19:50"
    }
  ]
}
```

---

### `GET /api/admin/logs/conversations`

Query all conversation logs across every user.

| Query Param | Type   | Required | Description                    |
|-------------|--------|----------|--------------------------------|
| email       | string | no       | Exact match                    |
| session_id  | string | no       | Exact match                    |
| role        | string | no       | `USER`, `SYSTEM`, or `INFO`    |
| from        | string | no       | ISO datetime or `YYYY-MM-DD`   |
| to          | string | no       | ISO datetime or `YYYY-MM-DD`   |
| limit       | number | no       | Default: 50                    |
| offset      | number | no       | Default: 0                     |

**Response:**
```json
{
  "total": 318,
  "limit": 50,
  "offset": 0,
  "rows": [
    {
      "id": 318,
      "email": "demo@demo.com",
      "session_id": "a14451b2-...",
      "role": "USER",
      "message": "I watched Spider-Man!",
      "created_at": "2026-04-03 09:20:15"
    }
  ]
}
```

---

### `GET /api/admin/logs/conversations/:sessionId/export`

> **Required role:** `admin` or `teacher`

Export a session as downloadable plain text.

**Response:** `Content-Type: text/plain`

---

## 7. Pagination

Endpoints that return lists support pagination via `limit` and `offset` query params.

**Paginated response shape:**
```json
{
  "total": 142,
  "limit": 50,
  "offset": 0,
  "rows": [ ... ]
}
```

**Frontend example — load page 3:**
```
GET /api/admin/logs/access?limit=20&offset=40
```

**Calculate total pages:**
```js
const totalPages = Math.ceil(total / limit);
const currentPage = Math.floor(offset / limit) + 1;
```

---

## 8. Error Handling

All errors return JSON:

```json
{ "error": "Description of what went wrong" }
```

| Status | Meaning                              |
|--------|--------------------------------------|
| 400    | Bad request (missing/invalid fields) |
| 401    | Not authenticated                    |
| 403    | Forbidden (wrong role)               |
| 404    | Resource not found                   |
| 409    | Conflict (e.g. duplicate user)       |
| 500    | Server error                         |

**Auth check pattern for your frontend:**
```js
const res = await fetch("/api/me", { credentials: "include" });
if (res.status === 401) {
  window.location.href = "/login";
  return;
}
const data = await res.json();
```

---

## 9. Roles & Permissions

| Endpoint prefix       | student | teacher | admin |
|-----------------------|---------|---------|-------|
| `/api/me`             | yes     | yes     | yes   |
| `/conversation/*`     | yes     | yes     | yes   |
| `/log-voice-session`  | yes     | yes     | yes   |
| `/token`              | yes     | yes     | yes   |
| `/api/teacher/*`      | no      | yes     | yes   |
| `/api/admin/*`        | no      | no      | yes   |

Admin inherits all teacher permissions. A student can only access their own session endpoints.

---

## Quick Reference — All Endpoints

| Method   | Endpoint                                       | Role           |
|----------|------------------------------------------------|----------------|
| `POST`   | `/login`                                       | public         |
| `POST`   | `/logout`                                      | any            |
| `GET`    | `/api/me`                                      | any            |
| `GET`    | `/config`                                      | public         |
| `GET`    | `/token`                                       | any            |
| `POST`   | `/conversation/log`                            | any            |
| `POST`   | `/conversation/tokens`                         | any            |
| `POST`   | `/log-voice-session`                           | any            |
| `GET`    | `/api/teacher/students`                        | teacher, admin |
| `GET`    | `/api/teacher/students/:email`                 | teacher, admin |
| `GET`    | `/api/teacher/students/:email/sessions`        | teacher, admin |
| `GET`    | `/api/teacher/students/:email/search?q=`       | teacher, admin |
| `GET`    | `/api/teacher/sessions/:sessionId`             | teacher, admin |
| `GET`    | `/api/teacher/sessions/:sessionId/export`      | teacher, admin |
| `GET`    | `/api/teacher/activity`                        | teacher, admin |
| `GET`    | `/api/teacher/tokens`                          | teacher, admin |
| `GET`    | `/api/teacher/tokens/:email`                   | teacher, admin |
| `GET`    | `/api/admin/users`                             | admin          |
| `POST`   | `/api/admin/users`                             | admin          |
| `DELETE` | `/api/admin/users/:email`                      | admin          |
| `PATCH`  | `/api/admin/users/:email/role`                 | admin          |
| `PATCH`  | `/api/admin/users/:email/password`             | admin          |
| `GET`    | `/api/admin/logs/access`                       | admin          |
| `GET`    | `/api/admin/logs/conversations`                | admin          |
| `GET`    | `/api/admin/logs/conversations/:sessionId/export` | admin, teacher |

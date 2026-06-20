# Project Context & Developer Guidelines

> [!IMPORTANT]
> **Never run commands, I will test it manually after the implementation or fix is done**

## Project Overview
This is the **Ping Backend**, a Node.js Express API server providing persistence and real-time WebSocket messaging for the Ping Angular chat application. It uses SQLite (via `better-sqlite3`) for data storage and the `ws` library for WebSocket connections.

## Tech Stack
*   **Runtime**: Node.js
*   **Framework**: Express 5
*   **Database**: SQLite via `better-sqlite3` (synchronous API, DELETE mode)
*   **WebSocket**: `ws` library
*   **CORS**: `cors` middleware

## Codebase Structure
*   `server.js`: Entry point. Creates Express app, mounts routes, initializes HTTP server, attaches WebSocket, handles graceful shutdown.
*   `src/database.js`: SQLite database connection singleton. Initializes schema with `users`, `chats`, `messages` tables. Uses standard DELETE journal mode and foreign keys.
*   `src/models.js`: Data access layer. All database read/write operations (user CRUD, chat CRUD, message insertion). Pure functions that accept parameters and return results.
*   `src/routes.js`: Express router with all API endpoints. Contains `authenticate` middleware that validates `X-User-Mobile` header. Routes call model functions and broadcast WebSocket events.
*   `src/websocket.js`: WebSocket server setup. Manages a `Map<mobile, Set<WebSocket>>` for per-user connection tracking. Provides `broadcastToUser()` for pushing real-time events.

## Key Architecture Patterns

### Authentication
*   User identity is based on **mobile number** (primary key in `users` table).
*   The `X-User-Mobile` header is the primary authentication mechanism.
*   The `authenticate` middleware in `routes.js` extracts the mobile, looks up the user, and attaches `req.userMobile` and `req.user`.

### WebSocket Broadcasting
*   Routes access `req.app.locals.broadcastToUser` to push events to connected clients.
*   The function is injected from `websocket.js` into `app.locals` in `server.js`.
*   Events are JSON-serialized and sent to all WebSocket connections for a given mobile number.
*   Event types: `connected`, `new_message`, `chat_added`, `pong`.

### Database Schema
*   `users`: `mobile` (PK), `name`, `email`, `password` (hashed with salt), `created_at`
*   `chats`: `id` (PK), `user_mobile` (FK), `contact_name`, `contact_mobile`, `avatar_initials`, `avatar_bg`, `last_message`, `last_time`, `unread_count`. Has `UNIQUE(user_mobile, contact_mobile)`.
*   `messages`: `id` (PK), `chat_id` (FK), `sender_mobile`, `sender_name`, `avatar_initials`, `avatar_bg`, `message`, `time`, `is_self`.

### Data Flow
1. Frontend sends REST request → `routes.js` validates & calls `models.js` → SQLite write → response + WebSocket broadcast
2. Frontend receives WebSocket event → updates local signal state

### API Response Format
All API responses return JSON matching the Angular frontend interfaces:
*   Chat objects use camelCase keys: `id`, `name`, `mobile`, `avatarInitials`, `avatarBg`, `lastMessage`, `time`, `unreadCount`, `messages[]`
*   Message objects: `id`, `sender`, `avatarInitials`, `avatarBg`, `message`, `time`, `isSelf`

### Error Handling
*   All route handlers are wrapped in try/catch blocks.
*   Validation errors return 400, auth errors 401, forbidden 403, not found 404, duplicates 409.
*   Internal errors return 500 with a generic message (no stack traces exposed).

## Frontend Connection
The Angular frontend (`../angularapp/src/app/services/chat.service.ts`) connects via:
*   REST: `http://localhost:3000/api`
*   WebSocket: `ws://localhost:3000/ws?mobile=<encoded_mobile>`

## Database Location
The SQLite database file (`ping.db`) is stored inside the `backend/` directory. It is git-ignored via `.gitignore`.

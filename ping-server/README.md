# Ping Chat Backend

Node.js Express backend API with WebSocket real-time messaging and SQLite persistence for the **Ping** Angular chat application.

## Tech Stack
*   **Runtime**: Node.js
*   **Framework**: Express 5
*   **Database**: SQLite via `better-sqlite3` (DELETE mode, foreign keys enabled)
*   **Real-time**: WebSocket via `ws` library
*   **CORS**: Configured for Angular dev server (`localhost:4200`)

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
# or
npm run dev
```

The server starts on **http://localhost:3000** by default.

## Project Structure

```
backend/
├── server.js              # Entry point: Express app, HTTP server, WebSocket setup
├── src/
│   ├── database.js        # SQLite connection, schema initialization (DELETE mode)
│   ├── models.js          # Data access layer: users, chats, messages CRUD
│   ├── routes.js          # Express API routes with auth middleware
│   └── websocket.js       # WebSocket server: per-user connections, broadcasting
├── package.json
├── .gitignore
├── README.md
└── GEMINI.md
```

## Database

SQLite database file is created at `backend/ping.db` (git-ignored). Tables:

| Table      | Purpose                                   |
|------------|-------------------------------------------|
| `users`    | User profiles (mobile as primary key)     |
| `chats`    | Chat conversations per user               |
| `messages` | Individual messages within chats          |

The database auto-initializes on first run. No migrations needed.

## API Endpoints

### Authentication

| Method | Endpoint           | Body                                      | Description                |
|--------|--------------------|-------------------------------------------|----------------------------|
| POST   | `/api/auth/signup` | `{ name, email, mobile, password }`       | Register a new user        |
| POST   | `/api/auth/login`  | `{ mobile, password }`                    | Authenticate and log in    |

### Profile

| Method | Endpoint        | Headers              | Body           | Description           |
|--------|-----------------|----------------------|----------------|-----------------------|
| PUT    | `/api/profile`  | `X-User-Mobile`      | `{ name }`    | Update display name   |

### Chats

| Method | Endpoint          | Headers              | Body                    | Description                 |
|--------|--------------------|----------------------|-------------------------|-----------------------------|
| GET    | `/api/chats`       | `X-User-Mobile`      | —                       | Get all chats with messages |
| POST   | `/api/chats/add`   | `X-User-Mobile`      | `{ name, mobile }`     | Add a new contact/chat      |

### Messages

| Method | Endpoint                      | Headers              | Body                                                          | Description      |
|--------|-------------------------------|----------------------|---------------------------------------------------------------|------------------|
| POST   | `/api/chats/:id/messages`     | `X-User-Mobile`      | `{ message, sender, avatarInitials, avatarBg, time, isSelf }` | Send a message   |

### Health

| Method | Endpoint    | Description              |
|--------|-------------|--------------------------|
| GET    | `/health`   | Server health check      |

## Authentication

All protected endpoints require the `X-User-Mobile` header containing the logged-in user's mobile number. An `Authorization: Bearer <base64>` header is also sent by the frontend but the backend primarily uses `X-User-Mobile` for user identification.

## WebSocket

**Endpoint**: `ws://localhost:3000/ws?mobile=<user_mobile>`

### Connection
Connect with the user's mobile number as a query parameter. The server confirms with:
```json
{ "type": "connected", "mobile": "+1234567890" }
```

### Events (Server → Client)

| Event Type     | Payload                                  | Description                    |
|----------------|------------------------------------------|--------------------------------|
| `connected`    | `{ type, mobile }`                       | Connection confirmed           |
| `new_message`  | `{ type, chatId, message }`              | New message in a chat          |
| `chat_added`   | `{ type, chat }`                         | New chat/contact added         |
| `pong`         | `{ type: "pong" }`                       | Response to client ping        |

### Events (Client → Server)

| Event Type | Payload              | Description          |
|------------|----------------------|----------------------|
| `ping`     | `{ type: "ping" }`  | Keep-alive ping      |

## Frontend Integration

The Angular frontend (`../angularapp`) connects to this backend via:
1. **REST API** at `http://localhost:3000/api` for CRUD operations
2. **WebSocket** at `ws://localhost:3000/ws` for real-time message delivery

Both are configured in `angularapp/src/app/services/chat.service.ts`.

## Environment Variables

| Variable | Default | Description     |
|----------|---------|-----------------|
| `PORT`   | `3000`  | Server port     |

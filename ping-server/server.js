require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

const routes = require('./src/routes');
const { setupWebSocket, broadcastToUser } = require('./src/websocket');
const { getDb, closeDb } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse CORS_ORIGINS from env (comma-separated) or use defaults
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:4200', 'http://localhost:4000'];

// ──── Middleware ────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Mobile']
}));
app.use(express.json());

// ──── Make WebSocket broadcast available to routes ────
app.locals.broadcastToUser = broadcastToUser;

// ──── API Routes ────
app.use('/api', routes);

// ──── Health Check ────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ──── Initialize DB on startup (auto-creates file if missing) ────
getDb();

// ──── Create HTTP server and attach WebSocket ────
const server = http.createServer(app);
setupWebSocket(server);

const logger = require('./src/logger');
const { getUser } = require('./src/models');
logger.setGetUserFn(getUser);

server.listen(PORT, '0.0.0.0', () => {
  const msg = `Ping Backend running on port ${PORT}`;
  console.log(`\n  🟢 ${msg}`);
  console.log(`  📡 WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
  console.log(`  🌐 CORS origins: ${corsOrigins.join(', ')}\n`);
  logger.logInfo(msg);
});

// ──── Graceful Shutdown ────
process.once('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  logger.logInfo('Server shutting down gracefully (SIGINT)');
  closeDb();
  server.close(() => process.exit(0));
});

process.once('SIGTERM', () => {
  logger.logInfo('Server shutting down (SIGTERM)');
  closeDb();
  server.close(() => process.exit(0));
});

module.exports = app;


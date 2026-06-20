require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let rawDbPath = process.env.DB_PATH || (process.env.VERCEL ? '/tmp/ping.db' : './ping.db');

// If on Vercel and the path is relative, force it to be inside /tmp
if (process.env.VERCEL && !path.isAbsolute(rawDbPath)) {
  rawDbPath = path.join('/tmp', path.basename(rawDbPath));
}

const DB_PATH = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(__dirname, '..', rawDbPath);

// Ensure parent directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    console.log(`[DB] Connecting to SQLite database at: ${DB_PATH}`);
    db = new Database(DB_PATH);
    db.pragma('journal_mode = DELETE');
    db.pragma('foreign_keys = ON');
    initSchema();
    console.log(`  📦 Database ready: ${DB_PATH}`);
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      mobile TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password TEXT NOT NULL,
      public_key TEXT DEFAULT NULL,
      encrypted_private_key TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
 
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_mobile TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      contact_mobile TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      avatar_bg TEXT NOT NULL,
      last_message TEXT DEFAULT '',
      last_time TEXT DEFAULT '',
      unread_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_mobile) REFERENCES users(mobile),
      UNIQUE(user_mobile, contact_mobile)
    );
 
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      sender_mobile TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      avatar_initials TEXT NOT NULL,
      avatar_bg TEXT NOT NULL,
      message TEXT NOT NULL,
      time TEXT NOT NULL,
      is_self INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chat_id) REFERENCES chats(id)
    );
 
    CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_mobile);
    CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
  `);
 
  // Safe migrations: add columns to existing databases
  try {
    db.exec('ALTER TABLE users ADD COLUMN public_key TEXT DEFAULT NULL;');
  } catch (e) {
    // Column already exists – ignore
  }
  try {
    db.exec('ALTER TABLE users ADD COLUMN encrypted_private_key TEXT DEFAULT NULL;');
  } catch (e) {
    // Column already exists – ignore
  }
  try {
    db.exec('ALTER TABLE users ADD COLUMN fcm_token TEXT DEFAULT NULL;');
  } catch (e) {
    // Column already exists – ignore
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };

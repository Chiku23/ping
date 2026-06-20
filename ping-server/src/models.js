const { getDb } = require('./database');
const crypto = require('crypto');

const AVATAR_BACKGROUNDS = [
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-purple-500 to-indigo-600',
  'from-cyan-400 to-blue-500',
  'from-sky-400 to-indigo-500',
  'from-fuchsia-500 to-pink-500',
  'from-lime-400 to-green-600',
  'from-red-400 to-rose-600',
  'from-violet-500 to-purple-600'
];

function getInitials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';
}

function getRandomBg() {
  return AVATAR_BACKGROUNDS[Math.floor(Math.random() * AVATAR_BACKGROUNDS.length)];
}

function formatTimeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ──── Password Hashing ────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!storedPassword || !storedPassword.includes(':')) return false;
  const [salt, hash] = storedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// ──── User Operations ────

function registerUser(name, email, mobile, password) {
  const db = getDb();
  // Check if mobile already exists
  const existing = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  if (existing) {
    throw new Error('User with this mobile number already exists');
  }
  
  const hashedPassword = hashPassword(password);
  db.prepare('INSERT INTO users (name, email, mobile, password) VALUES (?, ?, ?, ?)').run(name, email, mobile, hashedPassword);
  return { name, email, mobile };
}

function authenticateUser(mobile, password) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
  if (!user) {
    return null;
  }
  if (!verifyPassword(password, user.password)) {
    return null;
  }
  return {
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    publicKey: user.public_key,
    encryptedPrivateKey: user.encrypted_private_key
  };
}

function getUser(mobile) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
}

function updateUserName(mobile, name) {
  const db = getDb();
  db.prepare('UPDATE users SET name = ? WHERE mobile = ?').run(name, mobile);
  return { success: true, name };
}

function storePublicKey(mobile, publicKey) {
  const db = getDb();
  db.prepare('UPDATE users SET public_key = ? WHERE mobile = ?').run(publicKey, mobile);
  return { success: true };
}

function storePrivateKey(mobile, encryptedPrivateKey) {
  const db = getDb();
  db.prepare('UPDATE users SET encrypted_private_key = ? WHERE mobile = ?').run(encryptedPrivateKey, mobile);
  return { success: true };
}

function updateFcmToken(mobile, token) {
  const db = getDb();
  db.prepare('UPDATE users SET fcm_token = ? WHERE mobile = ?').run(token, mobile);
  return { success: true };
}

function getPublicKey(mobile) {
  const db = getDb();
  const user = db.prepare('SELECT public_key FROM users WHERE mobile = ?').get(mobile);
  return user ? user.public_key : null;
}

// ──── Chat Operations ────

function getUserChats(userMobile) {
  const db = getDb();
  const chats = db.prepare('SELECT * FROM chats WHERE user_mobile = ? ORDER BY id DESC').all(userMobile);

  return chats.map(chat => {
    const messages = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY id ASC').all(chat.id);
    return {
      id: chat.id,
      name: chat.contact_name,
      mobile: chat.contact_mobile,
      avatarInitials: chat.avatar_initials,
      avatarBg: chat.avatar_bg,
      lastMessage: chat.last_message,
      time: chat.last_time,
      unreadCount: chat.unread_count,
      messages: messages.map(m => ({
        id: m.id,
        sender: m.sender_name,
        avatarInitials: m.avatar_initials,
        avatarBg: m.avatar_bg,
        message: m.message,
        time: m.time,
        isSelf: m.is_self === 1
      }))
    };
  });
}

function addChat(userMobile, contactName, contactMobile) {
  const db = getDb();

  // Check duplicate
  const existing = db.prepare('SELECT * FROM chats WHERE user_mobile = ? AND contact_mobile = ?').get(userMobile, contactMobile);
  if (existing) {
    return null; // already exists
  }

  const initials = getInitials(contactName);
  const bg = getRandomBg();
  const time = formatTimeNow();

  const result = db.prepare(`
    INSERT INTO chats (user_mobile, contact_name, contact_mobile, avatar_initials, avatar_bg, last_message, last_time, unread_count)
    VALUES (?, ?, ?, ?, ?, '', ?, 0)
  `).run(userMobile, contactName, contactMobile, initials, bg, time);

  return {
    id: Number(result.lastInsertRowid),
    name: contactName,
    mobile: contactMobile,
    avatarInitials: initials,
    avatarBg: bg,
    lastMessage: '',
    time,
    unreadCount: 0,
    messages: []
  };
}

// ──── Message Operations ────

function addMessage(chatId, senderMobile, senderName, avatarInitials, avatarBg, message, time, isSelf) {
  const db = getDb();
  const isSelfInt = isSelf ? 1 : 0;

  const result = db.prepare(`
    INSERT INTO messages (chat_id, sender_mobile, sender_name, avatar_initials, avatar_bg, message, time, is_self)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chatId, senderMobile, senderName, avatarInitials, avatarBg, message, time, isSelfInt);

  // Update chat's last message
  db.prepare('UPDATE chats SET last_message = ?, last_time = ? WHERE id = ?').run(message, time, chatId);

  return {
    id: Number(result.lastInsertRowid),
    sender: senderName,
    avatarInitials,
    avatarBg,
    message,
    time,
    isSelf
  };
}

function getChatById(chatId) {
  const db = getDb();
  return db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
}

function getChatOwnerMobile(chatId) {
  const db = getDb();
  const chat = db.prepare('SELECT user_mobile FROM chats WHERE id = ?').get(chatId);
  return chat ? chat.user_mobile : null;
}

module.exports = {
  registerUser,
  authenticateUser,
  getUser,
  updateUserName,
  storePublicKey,
  storePrivateKey,
  updateFcmToken,
  getPublicKey,
  getUserChats,
  addChat,
  addMessage,
  getChatById,
  getChatOwnerMobile,
  getInitials,
  getRandomBg,
  formatTimeNow
};

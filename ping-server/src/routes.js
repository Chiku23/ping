const express = require('express');
const {
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
  getChatById
} = require('./models');
const { sendPushNotification } = require('./push');
const logger = require('./logger');

// Configure logger helper with database user lookup
logger.setGetUserFn(getUser);

const router = express.Router();

// ──── Auth Middleware ────
function authenticate(req, res, next) {
  const mobile = req.headers['x-user-mobile'];
  if (!mobile) {
    logger.logWarn('Unauthorized attempt: Missing X-User-Mobile header');
    return res.status(401).json({ error: 'Unauthorized: Missing X-User-Mobile header' });
  }
  const user = getUser(mobile);
  if (!user) {
    logger.logWarn('Unauthorized attempt: User not found for mobile identifier');
    return res.status(401).json({ error: 'Unauthorized: User not found. Please login first.' });
  }
  req.userMobile = mobile;
  req.user = user;
  next();
}

// ──── POST /api/auth/signup ────
router.post('/auth/signup', (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    if (!name || !email || !mobile || !password) {
      logger.logWarn('Signup failed: missing parameters');
      return res.status(400).json({ error: 'name, email, mobile, and password are required' });
    }
    const user = registerUser(name.trim(), email.trim(), mobile.trim(), password);
    logger.logInfo(`User [${user.name}] successfully registered`);
    res.status(201).json(user);
  } catch (err) {
    logger.logError('Signup error', err);
    if (err.message.includes('exists')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── POST /api/auth/login ────
router.post('/auth/login', (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) {
      logger.logWarn('Login failed: missing parameters');
      return res.status(400).json({ error: 'mobile and password are required' });
    }
    const user = authenticateUser(mobile.trim(), password);
    if (!user) {
      logger.logWarn(`Login failed: invalid credentials for User [${logger.getName(mobile)}]`);
      return res.status(401).json({ error: 'Invalid mobile number or password' });
    }
    logger.logInfo(`User [${user.name}] successfully logged in`);
    res.json(user);
  } catch (err) {
    logger.logError('Login error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── PUT /api/profile ────
router.put('/profile', authenticate, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const oldName = req.user.name;
    const result = updateUserName(req.userMobile, name.trim());
    logger.logInfo(`User [${oldName}] updated their profile name to [${name.trim()}]`);
    res.json(result);
  } catch (err) {
    logger.logError(`Update profile error for User [${req.user.name}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── PUT /api/keys/public  (store my ECDH public key) ────
router.put('/keys/public', authenticate, (req, res) => {
  try {
    const { publicKey, encryptedPrivateKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ error: 'publicKey is required' });
    }
    storePublicKey(req.userMobile, publicKey);
    if (encryptedPrivateKey) {
      storePrivateKey(req.userMobile, encryptedPrivateKey);
    }
    logger.logInfo(`User [${req.user.name}] updated E2E public key`);
    res.json({ success: true });
  } catch (err) {
    logger.logError(`Store public key error for User [${req.user.name}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── POST /api/keys/fcm-token  (store my FCM push token) ────
router.post('/keys/fcm-token', authenticate, (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }
    updateFcmToken(req.userMobile, token);
    logger.logInfo(`User [${req.user.name}] updated FCM push token`);
    res.json({ success: true });
  } catch (err) {
    logger.logError(`Store FCM token error for User [${req.user.name}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── GET /api/keys/:mobile  (get a contact's ECDH public key) ────
router.get('/keys/:mobile', authenticate, (req, res) => {
  try {
    const contactMobile = req.params.mobile;
    const publicKey = getPublicKey(contactMobile);
    if (!publicKey) {
      logger.logWarn(`E2E public key not found for User [${logger.getName(contactMobile)}] requested by User [${req.user.name}]`);
      return res.json({ mobile: contactMobile, publicKey: null });
    }
    res.json({ mobile: contactMobile, publicKey });
  } catch (err) {
    logger.logError(`Get public key error for contact requested by User [${req.user.name}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── GET /api/chats ────
router.get('/chats', authenticate, (req, res) => {
  try {
    const chats = getUserChats(req.userMobile);
    res.json(chats);
  } catch (err) {
    logger.logError(`Get chats error for User [${req.user.name}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── POST /api/chats/add ────
router.post('/chats/add', authenticate, (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: 'mobile is required' });
    }

    const contactMobile = mobile.trim();
    if (contactMobile === req.userMobile) {
      return res.status(400).json({ error: 'You cannot add yourself' });
    }

    // Lookup contact user details in registered users
    const contactUser = getUser(contactMobile);
    if (!contactUser) {
      logger.logWarn(`Add chat failed: User not registered`);
      return res.status(404).json({ error: 'User with this mobile number is not registered on Ping' });
    }

    const chat = addChat(req.userMobile, contactUser.name, contactMobile);
    if (!chat) {
      return res.status(409).json({ error: 'Contact already exists' });
    }
    
    logger.logInfo(`User [${req.user.name}] initiated chat with User [${contactUser.name}]`);

    // Broadcast new chat via WebSocket to the user who added it
    if (req.app.locals.broadcastToUser) {
      req.app.locals.broadcastToUser(req.userMobile, {
        type: 'chat_added',
        chat
      });
    }

    res.status(201).json(chat);
  } catch (err) {
    logger.logError(`Add chat error for User [${req.user.name}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──── POST /api/chats/:id/messages ────
router.post('/chats/:id/messages', authenticate, (req, res) => {
  try {
    const chatId = parseInt(req.params.id, 10);
    const chat = getChatById(chatId);
    if (!chat) {
      logger.logWarn(`Send message failed: Chat ID ${chatId} not found`);
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (chat.user_mobile !== req.userMobile) {
      logger.logWarn(`Send message forbidden: User [${req.user.name}] tried to send message to Chat ID ${chatId} owned by other`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { message, sender, avatarInitials, avatarBg, time } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const senderName = sender || req.user.name;
    const initials = avatarInitials || req.user.name.substring(0, 2).toUpperCase();
    const bg = avatarBg || 'from-indigo-500 to-purple-500';
    const msgTime = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Save message for sender (A)
    const savedMsg = addMessage(chatId, req.userMobile, senderName, initials, bg, message, msgTime, true);

    // 2. Save message for recipient (B)
    const recipientMobile = chat.contact_mobile;
    const { getDb } = require('./database');
    const db = getDb();
    
    // Check if B already has a chat with A
    let bChat = db.prepare('SELECT * FROM chats WHERE user_mobile = ? AND contact_mobile = ?')
      .get(recipientMobile, req.userMobile);

    if (!bChat) {
      // Auto-create chat for B with A as contact
      bChat = addChat(recipientMobile, req.user.name, req.userMobile);
      if (bChat) {
        logger.logInfo(`Auto-created chat for User [${logger.getName(recipientMobile)}] with contact User [${req.user.name}]`);
        if (req.app.locals.broadcastToUser) {
          req.app.locals.broadcastToUser(recipientMobile, {
            type: 'chat_added',
            chat: bChat
          });
        }
      }
    }

    if (bChat) {
      // Insert message for B's chat (isSelf = false from B's perspective)
      const msgForB = addMessage(bChat.id, req.userMobile, req.user.name, initials, bg, message, msgTime, false);
      
      // Broadcast the message to B's WebSocket connections
      let activeConnections = 0;
      if (req.app.locals.broadcastToUser) {
        activeConnections = req.app.locals.broadcastToUser(recipientMobile, {
          type: 'new_message',
          chatId: bChat.id,
          message: msgForB
        });
      }

      // If B has 0 active WebSocket connections (e.g. app in background / closed), send a push notification
      if (activeConnections === 0) {
        const recipient = getUser(recipientMobile);
        if (recipient && recipient.fcm_token) {
          sendPushNotification(recipient.fcm_token, req.user.name, message, bChat.id);
        }
      }
    }

    res.status(201).json(savedMsg);
  } catch (err) {
    logger.logError(`Send message error for User [${req.user.name}]`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

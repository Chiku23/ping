const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let messaging = null;

try {
  let serviceAccount = null;

  // 1. Try to load from environment variable (for production/Vercel)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      logger.logInfo('[Push] Loading Firebase service account from environment variable');
    } catch (parseErr) {
      logger.logError('[Push] Failed to parse FIREBASE_SERVICE_ACCOUNT env variable', parseErr);
    }
  }

  // 2. Fallback to local file (for local development)
  if (!serviceAccount) {
    const serviceAccountPath = path.resolve(__dirname, '..', 'firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      logger.logInfo('[Push] Loading Firebase service account from local file');
    }
  }

  if (serviceAccount) {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    
    const app = initializeApp({
      credential: cert(serviceAccount)
    });
    
    messaging = getMessaging(app);
    logger.logInfo('[Push] Firebase Admin SDK initialized successfully for FCM v1');
  } else {
    logger.logInfo('[Push] No Firebase service account config found. Using Push Mock mode.');
  }
} catch (err) {
  logger.logError('[Push] Failed to initialize Firebase Admin SDK', err);
}

/**
 * Send a background push notification to a user via Firebase Cloud Messaging v1
 * @param {string} fcmToken The recipient's FCM push token
 * @param {string} senderName Name of the person who sent the message
 * @param {string} messageText The decrypted message text
 * @param {number} chatId The chat ID context
 */
function sendPushNotification(fcmToken, senderName, messageText, chatId) {
  if (!messaging) {
    logger.logInfo(`[Push Mock] To token: ${fcmToken.substring(0, 15)}... | Sender: ${senderName} | Message: ${messageText} (Place firebase-service-account.json in backend/ to send real push notifications via FCM v1)`);
    return;
  }

  const payload = {
    token: fcmToken,
    notification: {
      title: senderName,
      body: messageText
    },
    data: {
      chatId: String(chatId)
    }
  };

  messaging.send(payload)
    .then((response) => {
      logger.logInfo(`[Push] Successfully sent FCM v1 push notification: ${response}`);
    })
    .catch((error) => {
      logger.logError('[Push] FCM v1 send error', error);
    });
}

module.exports = { sendPushNotification };

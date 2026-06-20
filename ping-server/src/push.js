const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let messaging = null;

try {
  const serviceAccountPath = path.resolve(__dirname, '..', 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const { initializeApp, cert } = require('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    
    const app = initializeApp({
      credential: cert(serviceAccount)
    });
    
    messaging = getMessaging(app);
    logger.logInfo('[Push] Firebase Admin SDK initialized successfully for FCM v1');
  } else {
    logger.logInfo('[Push] No firebase-service-account.json found in backend. Using Push Mock mode.');
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

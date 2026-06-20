const fs = require('fs');
const path = require('path');

const LOG_FILE = path.resolve(__dirname, '..', 'server.log');

let getUserFn = null;

/**
 * Configure the database user lookup function
 * @param {Function} fn 
 */
function setGetUserFn(fn) {
  getUserFn = fn;
}

/**
 * Convert a mobile number to user's name if possible, otherwise return sanitized name
 * @param {string} mobileOrName 
 */
function getName(mobileOrName) {
  if (!mobileOrName) return 'Unknown User';
  
  // Check if it's a mobile number (digit sequence, optional plus, optional spaces/dashes)
  const cleanMobile = mobileOrName.replace(/[\s-]/g, '');
  const isMobile = /^\+?\d+$/.test(cleanMobile);
  
  if (isMobile && getUserFn) {
    try {
      const user = getUserFn(cleanMobile);
      if (user) {
        return user.name;
      }
    } catch (e) {
      // Ignore database errors in logger
    }
    // If user is not found, do not print phone number, say "Unregistered User"
    return 'Unregistered User';
  }
  
  return mobileOrName;
}

/**
 * Helper to write a sanitized log line to file
 */
function writeLog(level, message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}`;
  
  // Always log to console so Vercel dashboard captures it
  if (level === 'ERROR') {
    console.error(logLine);
  } else {
    console.log(logLine);
  }

  // Skip file logging entirely on Vercel
  if (!process.env.VERCEL) {
    try {
      fs.appendFileSync(LOG_FILE, logLine + '\n');
    } catch (err) {
      // Fail silently to avoid clogging console output in other read-only environments
    }
  }
}

function logInfo(message) {
  writeLog('INFO', message);
}

function logWarn(message) {
  writeLog('WARN', message);
}

function logError(message, err) {
  let errStr = '';
  if (err) {
    errStr = ` - Error: ${err.message || err}`;
    if (err.stack) {
      errStr += `\nStack trace: ${err.stack}`;
    }
  }
  writeLog('ERROR', `${message}${errStr}`);
}

module.exports = {
  setGetUserFn,
  getName,
  logInfo,
  logWarn,
  logError
};

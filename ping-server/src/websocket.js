const WebSocket = require('ws');
const url = require('url');
const logger = require('./logger');

// Map of mobile number -> Set of WebSocket connections
const clients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Extract user mobile from query param: ws://host/ws?mobile=+1234567890
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const mobile = params.get('mobile');

    if (!mobile) {
      logger.logWarn('WS Connection rejected: missing mobile parameter');
      ws.close(4001, 'Missing mobile parameter');
      return;
    }

    // Register this connection
    if (!clients.has(mobile)) {
      clients.set(mobile, new Set());
    }
    clients.get(mobile).add(ws);
    
    const userName = logger.getName(mobile);
    console.log(`[WS] Client connected: ${userName} (${clients.get(mobile).size} connections)`);
    logger.logInfo(`User [${userName}] established WebSocket connection`);

    // Handle incoming WebSocket messages from client
    ws.on('message', (data) => {
      try {
        const payload = JSON.parse(data);
        // Client can send ping/pong or other control messages
        if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      const userConns = clients.get(mobile);
      if (userConns) {
        userConns.delete(ws);
        if (userConns.size === 0) {
          clients.delete(mobile);
        }
      }
      console.log(`[WS] Client disconnected: ${userName}`);
      logger.logInfo(`User [${userName}] closed WebSocket connection`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for ${userName}:`, err.message);
      logger.logError(`WS error for User [${userName}]`, err);
    });

    // Send connection confirmation
    ws.send(JSON.stringify({ type: 'connected', mobile }));
  });

  console.log('[WS] WebSocket server ready on /ws');
  return wss;
}


// Broadcast a message to all connections for a specific user
function broadcastToUser(mobile, data) {
  const userConns = clients.get(mobile);
  if (!userConns) return 0;

  const payload = JSON.stringify(data);
  let count = 0;
  for (const ws of userConns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
      count++;
    }
  }
  return count;
}

module.exports = { setupWebSocket, broadcastToUser };

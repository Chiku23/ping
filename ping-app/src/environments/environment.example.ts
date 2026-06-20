// ──── Ping Angular – Environment Configuration ────
// This is the DEVELOPMENT environment file.
// For production, create src/environments/environment.prod.ts with the same shape.
//
// HOW TO USE:
//   1. Copy this file to src/environments/environment.ts
//   2. Adjust the values to match your backend.
//   3. The file is git-ignored — never commit real environment.ts.
//
// In Angular, import with:
//   import { environment } from '../environments/environment';

export const environment = {
  production: false,

  // ──── Backend REST API ────
  // Base URL of the Ping Node.js backend server.
  apiUrl: 'http://localhost:3000/api',

  // ──── WebSocket ────
  // WebSocket endpoint – must match the backend WS path.
  wsUrl: 'ws://localhost:3000/ws',
};

# Ping Chat Application

A real-time, lightweight cross-device chat application built with **Angular (Frontend)** and **Node.js + WebSocket + SQLite (Backend)**. Styled with **Tailwind CSS v4** to resemble a modern WhatsApp-like workspace.

---

## Key Integrations & Accomplishments

### 1. End-To-End Encryption (E2E)
- **Algorithm**: Implemented using the browser-native **Web Crypto API** (ECDH P-256 for key exchange, AES-GCM 256 for message encryption/decryption).
- **Public Key Store**: Added a `public_key` column to the sqlite database. Implemented `PUT /api/keys/public` and `GET /api/keys/:mobile` endpoints.
- **Auto-Publishing**: Public keys are automatically generated and published to the server upon registration, login, or session restoration (auto-login on startup).
- **Graceful Fallback**: If either contact hasn't registered a public key yet, messages fall back to plaintext.
- **Secure Context Shielding**: Checks for `crypto.subtle` availability. In unsecure contexts (like testing via HTTP IP on laptops), it logs warnings and falls back to plaintext instead of throwing crashes.

### 2. Android Porting & Push Notifications (Capacitor + FCM v1)
- **Platform**: Ported to native Android using **Ionic Capacitor**.
- **Background Push Notifications**: Integrated Google **FCM HTTP v1 API** (using the Node.js `firebase-admin` SDK) on the backend and `@capacitor/push-notifications` on the frontend. When a user is offline (0 active WebSocket connections), the server automatically pulls their token from SQLite and dispatches a background push notification.
- **Local Notification Bridge**: Integrated `@capacitor/local-notifications` to trigger local system notifications when messages arrive and the app is in the background, falling back to browser-native notifications on Web.
- **Auto-Reconnect on Resume**: Listens to the web-standard `visibilitychange` event. The moment the app returns to the foreground, it instantly triggers a WebSocket connection restart and a fresh `loadChats()` to pull messages sent while closed.
- **Cleartext HTTP Support**: Added `android:usesCleartextTraffic="true"` to `AndroidManifest.xml` and configured `"androidScheme": "http"` in `capacitor.config.json` to allow local HTTP testing.
- **Build Pipeline**: Created a single root command (`npm run build:android`) that automatically builds the Angular app and syncs assets into the Android native platform.

### 3. Server Connection Settings & Diagnostics
- Expansion drawer on the Login page allowing users to configure the Backend API URL (e.g. `192.168.0.102:3000/api`).
- Automatically formats input URLs (adds `http://` protocol when missing).
- Automatically formats and appends the WS endpoint (e.g., `ws://192.168.0.102:3000/ws`).
- Includes a **"Test Connection"** diagnostic button that queries `/health` with loading, success, and error readouts.

### 4. Dynamic Theme Engine & Security Protection
- Configured 10 premium CSS variable-based color themes (defaulting to purple).
- Persists user preferences dynamically to `localStorage`.
- **Git Protection**: Configured robust `.gitignore` layers across Workspace Root, Angular, and Backend to prevent any credentials (`firebase-service-account.json`, `.env`), platform folders (`android/`), local databases (`*.db*`), and logging outputs (`*.log`) from leaking to version control.

---

## Directory Structure

```text
├── angularapp/          # Angular frontend client
│   ├── android/         # Android native project files
│   └── src/             # Frontend source (Theme, CryptoService, Login UI)
├── backend/             # Node.js Express & WebSocket backend
│   └── src/             # Backend routing, database, and websocket logic
├── package.json         # Workspace scripts to start and build both apps
└── README.md            # Project documentation
```

---

## Installation & Setup

### Prerequisites
- Node.js (version 18+ recommended)
- npm (version 10+)
- Android Studio (for native Android compilation/debugging)

### Step 1: Install Dependencies
Run dependency installation inside both the `backend` and `angularapp` subfolders:
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../angularapp && npm install
```

### Step 2: Configure Environment Variables
- **Backend Configuration (`backend/.env`)**:
  Verify the database path and port settings.
- **Frontend Configuration (`angularapp/src/environments/environment.ts`)**:
  Define the fallback default API/WS addresses.

---

## Running the Application

### 1. Run local development (Web)
To start both the frontend development server and the backend API server concurrently, run the following command in the **root workspace directory**:
```bash
npm run dev
```
- **Backend API**: Running on `http://0.0.0.0:3000`
- **Frontend Web**: Running on `http://localhost:4200`

### 2. Build and Sync to Android Phone
1. Connect your Android phone via USB debugging.
2. In the **root workspace directory**, run:
   ```bash
   npm run build:android
   ```
3. Open the Android project in Android Studio:
   ```bash
   npx --prefix angularapp cap open android
   ```
4. Run the app on your phone via Android Studio debugging.
5. In the app login screen, open **Configure Server Connection**, enter your computer's local network IP address (e.g., `192.168.0.102:3000/api`), and tap **Test Connection** to confirm connectivity.

# Ping Chat App

A simplified, high-fidelity, and premium **WhatsApp Web** styled chat dashboard application built with **Angular (v21)** and **Tailwind CSS**.

## Features
*   **Initial Login Page**: Log in using your Nickname, Email, and Mobile number. Securely enter the chatroom. Designed with a fully scrollable, mobile-responsive card layout.
*   **Initiate Contact by Mobile Number**: Add contacts immediately by typing their name and Mobile number. Once connected, a new direct chat conversation history is initiated (similar to the WhatsApp connection model).
*   **User Profile Settings**: Modify your display name, view your Email and Mobile details, and log out to end the session. Designed with a fully scrollable settings panel.
*   **WhatsApp Mobile Responsiveness**: A clean mobile-first view transition. Selecting a conversation displays the active chat viewport full-screen with a "Back to Chats list" navigation arrow.
*   **WhatsApp Web Dark Theme Layout**: Beautifully curated CSS/SVG doodle background pattern, color palettes (slate and emerald-green accents), and spacing mimicking standard desktop WhatsApp Web.
*   **Real-time Local Messaging**: Instantly send messages to the selected contact. Messages are appended dynamically.
*   **Interactive Simulation**: Automated responses from contact profiles 1.5 seconds after a user sends a message.
*   **Contact Search**: Filter existing conversations by name or message contents in real-time.
*   **Plus Action Button**: Conveniently placed next to the search box in the sidebar for adding new contacts.
*   **Simple Emoji Picker**: Built-in, dependency-free emoji picker popup directly inside the chat footer input area.
*   **Overlapping-Proof Message Bubbles**: Soft-rounded sent and received message bubbles styled with custom padding to guarantee timestamps never overlap message text.
*   **Reactive Auto-Scrolling**: Chat window automatically scrolls down to show the latest messages when conversations change or new messages arrive.

## Tech Stack
*   **Core**: Angular (v21.2.0)
*   **Styling**: Tailwind CSS (v4.x) using `@tailwindcss/postcss`
*   **Icons**: FontAwesome (`@fortawesome/angular-fontawesome`)
*   **Testing**: Vitest (v4.0.8) with Angular Unit Testing

## Directory Structure
*   `src/app/app.ts`, `src/app/app.html`, `src/app/app.css`: Root layout routing.
*   `src/app/home/`: Home dashboard component containing layout proportions for sidebar and chatbox wrappers.
*   `src/app/services/chat.service.ts`: Local state management service handling profiles, search query signals, filtered selections, and message sending logic.
*   `src/app/component/header/`: Global header top-navigation component containing app branding, settings button, and user avatar.
*   `src/app/component/sidebar/`: Left panel component displaying contact searches, the Add Contact drawer, and contact lists.
*   `src/app/component/chatbox/`: Chat conversation viewport rendering active contact details, message list bubbles with soft border radius, and text message inputs with emoji picker.
*   `src/app/component/login/`: Form component for user nickname, email, and mobile registration.
*   `src/app/component/settings/`: Dashboard user profile settings view and session clear.

## Node.js Backend API Integration
The client is pre-wired to integrate with a Node.js Express/NestJS backend server:
1. Open `src/app/services/chat.service.ts`.
2. Configure `API_URL` to point to your Node.js server (e.g. `http://localhost:3000/api`).
3. Uncomment the API connectivity code blocks inside:
   - `login()`: Registers the credentials at `POST /auth/login`.
   - `updateProfileName()`: Updates profile details via `PUT /profile`.
   - `loadChats()`: Synchronizes contacts and messages from `GET /chats`.
   - `addContactByMobile()`: Saves a new connection at `POST /chats/add`.
   - `sendMessage()`: Transmits a new text payload to `POST /chats/:id/messages`.
4. The service automatically injects `HttpClient` and provides authentication headers (`Authorization: Bearer <base64>` and `X-User-Mobile: <mobile>`) on API calls.

## Development Tasks

### Start Development Server
```bash
npm run dev
# or
ng serve
```
Navigate to `http://localhost:4200/` inside your browser.

### Run Tests
```bash
npm run test
# or
ng test
```

### Build Production Bundle
```bash
npm run build
# or
ng build
```
The optimized production bundle will be generated under the `dist/` directory.

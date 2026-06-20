# Project Context & Developer Guidelines

> [!IMPORTANT]
> **Never run commands, i will test it manually after the implementaion or fix is done**
> **Strictly use Tailwind CSS for styling. Avoid writing custom CSS files unless absolutely necessary**

## Project Overview
This project, named **Ping**, is an Angular application serving as a simplified, high-fidelity chat dashboard styled like WhatsApp Web dark mode. It features a login portal, a user profile settings page, a navigation sidebar, and an active chat conversation box. Mobile responsiveness has been integrated so that smaller viewports toggle between the sidebar list and active chat panel.

## Tech Stack
*   **Frontend Framework**: Angular (v21.2.0)
*   **Styling**: Tailwind CSS (v4.x) using `@tailwindcss/postcss`
*   **Testing**: Vitest (v4.0.8) with Angular Unit Testing
*   **Icons**: FontAwesome (`@fortawesome/angular-fontawesome`)

## Codebase Structure
*   `src/app/app.ts`, `src/app/app.html`, `src/app/app.css`: Root layout views.
*   `src/app/home/`: Home dashboard component containing layout proportions for sidebar and chatbox wrappers.
*   `src/app/services/chat.service.ts`: Local state management service for managing user sessions, search queries, active chat selections, and contacts. Includes skeleton HTTP methods prepared for Node.js API connections.
*   `src/app/component/header/`: Top header component with brand logo, settings action, and user avatar.
*   `src/app/component/sidebar/`: Left panel displaying contact list, search inputs, and contact initiation drawers. (No secondary header is present inside the sidebar).
*   `src/app/component/chatbox/`: Chat bubble container displaying message history and text inputs with mobile back arrows.
*   `src/app/component/login/`: Form component for email and mobile login.
*   `src/app/component/settings/`: Dashboard user profile settings panel.

## Key Component Layout & Styling Patterns
*   **Angular Component Host Styling**:
    By default, custom Angular component host elements (like `<app-home>`, `<app-sidebar>`, `<app-chatbox>`, `<app-login>`, and `<app-settings>`) are inline elements.
    To ensure they stretch and layout correctly in flexbox and grid layouts, their respective stylesheets (`.css` files) must declare `:host` styles:
    ```css
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    ```
    For components that are nested alongside top-level siblings like `<app-header>` inside a flex column layout, ensure the host declarations use `flex-1 min-h-0` (or `grow`) rather than forcing `h-full` to prevent layout overflow (e.g. `<app-home>` and `<app-settings>`).
*   **Root Layout**:
    The root wrapper inside `app.html` uses a flexbox column layout spanning the full height of the viewport:
    ```html
    <div class="font-roboto bg-[#0b141a] h-screen w-full flex flex-col overflow-hidden">
    ```

## Mobile Responsive Layout
On viewports narrower than `md` (768px):
- The Sidebar wrapper hides if `chatService.showChatMobile()` is `true`.
- The Chatbox wrapper hides if `chatService.showChatMobile()` is `false`.
- A back arrow is rendered in the Chatbox header to toggle `showChatMobile` back to `false` and return to the chat list.
This ensures a native WhatsApp mobile feel.

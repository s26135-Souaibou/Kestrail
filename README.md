# Kestrel Workspace — Multi-Company Task Management & Collaboration Platform

Kestrel Workspace is a multi-tenant SaaS application for managing companies, departments, projects, tasks, subtasks, timelines, reports, role-based access control, and team collaboration.

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, Lucide icons.
- **Backend Gateway (`server.ts`)**: Express server with Firebase Admin ID Token verification (`verifyIdToken`), Zod request validation, OpenAPI JSON specification (`/api/docs`), and prepared ChatGPT MCP manifest/tool contracts (`/api/mcp/manifest`, `/api/mcp/tools/:toolName`).
- **Database & Authentication**: Firebase Authentication (Google Sign-In + Email/Password + Account Linking + Password Reset) and Cloud Firestore (`ai-studio-c6cad297-d559-40bd-b291-83cddda6a607`) enforced by hardened `firestore.rules`.

## Company-Level Isolation & Security

- All company data lives under `/companies/{companyId}/*` and requires active membership in `/companies/{companyId}/members/{uid}`.
- Configurable 16-permission RBAC policies live in `/companies/{companyId}/roles/{roleId}` and are enforced directly inside `firestore.rules` (not just the UI).
- Private user profile PII lives under `/users/{uid}` and is readable/writable strictly by `request.auth.uid == uid`.
- Company audit logs (`/companies/{companyId}/auditLogs`) and task histories (`/companies/{companyId}/tasks/{taskId}/history`) are append-only (`allow update, delete: if false`).

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Ensure `firebase-applet-config.json` and `firestore.rules` are configured for your Firebase project.
3. Start development server on port 3000:
   ```bash
   npm run dev
   ```
4. Build and run production server:
   ```bash
   npm run build
   npm start
   ```

## Enabling Email/Password Sign-In in Firebase Console

`ProvisionFirebase` enables Google Sign-In automatically. To enable Email & Password registration, login, and password reset:

1. Open [Firebase Console](https://console.firebase.google.com/) and select project `gen-lang-client-0123607019`.
2. Navigate to **Authentication → Sign-in method**.
3. Click **Add new provider → Email/Password**, toggle **Enable**, and save.

## Future ChatGPT MCP Integration

The backend prepares `/api/mcp/manifest` and `/api/mcp/tools/:toolName` using OAuth 2.1 + PKCE and Firebase ID Token verification. Live MCP execution remains disabled (`501`) until `MCP_OAUTH_CLIENT_ID`, `MCP_OAUTH_CLIENT_SECRET`, `MCP_ALLOWED_REDIRECT_URI`, and a user-owned GCP project with Firebase Admin IAM credentials are configured.

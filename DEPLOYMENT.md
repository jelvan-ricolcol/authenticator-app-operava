# 🚀 Deployment Playbook: Operava Authenticator
### Hand-Coded and Published by **Jelvan Ricolcol, Developer**

This deployment workbook outlines the step-by-step instructions required to build, test, and host **Operava Authenticator**. 

**Note on Cloudflare:** While initially intended to be hosted on Cloudflare (Workers, Pages, D1), the application is currently built as a standard Node.js Express server utilizing the local file system (`fs`) and a local JSON datastore (`db.json`). As a result, it is **not** natively Cloudflare-ready. You can deploy this application on any standard VPS or platform-as-a-service (PaaS) that supports Node.js.

---

## 🏗️ Deployment Lifecycle Architecture

The application is structured for a standard Node.js deployment. The production workflow operates as follows:

```
[ Developer Local Machine ] ---> [ GitHub Private Repo ] ---> [ CI/CD Pipeline / PaaS ]
                                                                       |
                                                                       v
                                                           [ Node.js Hosting Server ]
```

---

## 💻 Part 1: Provisioning Your Server Environment

You will need a server environment that supports Node.js (e.g., Render, Heroku, DigitalOcean, AWS EC2, or a standard VPS).

### 1. Requirements
Ensure your hosting environment has:
- **Node.js**: Version 18 or newer
- **NPM**: Version 9 or newer
- Persistent storage for the local `db.json` database.

---

## ⚡ Part 2: Compiling & Publishing

To host the front-end SPA static assets and dynamic server endpoints, follow these steps on your server or CI pipeline:

### 1. Install Dependencies
Clone the repository and install the necessary dependencies:
```bash
npm install
```

### 2. Build Compilation
Convert your TypeScript, React 19, and Tailwind CSS code into an optimized web bundle, and compile the Express server:
```bash
npm run build
```
Verify that this compiles code flawlessly. The static production assets and compiled server file will be placed in the `/dist` directory.

### 3. Start the Server
Start the Express server in production mode:
```bash
npm run start
```
The server will boot up and host the API endpoints as well as serve the static assets on the specified port (default 3000).

---

## 🧱 Part 3: Environment Variables

Set up your `.env` file or define environment variables in your hosting provider's dashboard:
- `NODE_ENV`: Set to `production`
- `PORT`: (Optional) The port your server will listen on. Defaults to 3000.

---

## ⚙️ Part 4: Configuring Automatic CI/CD

If deploying to a PaaS like Render or Heroku, you can typically connect your GitHub repository directly, and set the Build Command and Start Command as follows:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`

Make sure to attach a persistent disk or volume to your deployment so that `db.json` persists across server restarts.

---

## 🗄️ Part 5: Backend Architecture & Persistence

The backend operates as a monolithic **Express.js** server managed within `server.ts`. It controls SPA asset delivery alongside secure API integrations.

### 1. Database Persistence (`db.json`)
The application currently bypasses heavy SQL infrastructure in favor of a local JSON schema, creating an instantly portable zero-configuration database.
- **Storage Path**: `db.json` (auto-generated in the root working directory).
- **Structure**: Stores relational collections including `users`, `vaultEntries`, `sessions`, and `auditLogs`.
- **Warning on Ephemeral Storage**: When deploying on containerized instances (like Docker, Heroku, or Render), you **must mount a persistent disk volume** mapped to the working directory. Otherwise, `db.json` resets on every deployment cycle or container spin-down.

### 2. Security Middleware & Headers
The server enforces rigorous enterprise security measures directly at the network layer:
- **Strict Content-Security-Policy (CSP)**: Locks down cross-site scripting (XSS) vectors while preserving internal operations and sandbox boundaries.
- **In-Memory Rate Limiting**: Tracks failed authentication attempts (`loginFailures`) to mitigate and block targeted brute-force and dictionary attacks.
- **Session Verification**: Backend endpoints actively validate session tokens against the internal session registry.

### 3. API Endpoint Mappings
The server coordinates the following critical internal paths:
- `/api/auth/*`: Controls zero-knowledge authentication handshakes, master key enrollment, and passkey registration.
- `/api/vault/*`: The core storage conduit dealing purely with sealed WebCrypto payloads (list, add, update, delete).
- `/api/security/*`: Exposes session management tools and immutable activity logs for user review.

---

## 🔒 Security & Client Production Pledge
No decryptor hashes, master secrets, or TOTP keys ever traverse the network plaintext. Decryption pipelines remain fully sealed within the web browser.

This platform represents a secure showcase and PORTFOLIO application developed and managed by **Jelvan Ricolcol, Developer**. Released with absolute privacy mechanisms and complete client applicability under the permissive **MIT License**.

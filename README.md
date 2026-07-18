# Operava Authenticator
### Developed and Hand-Coded by **Jelvan Ricolcol, Developer**

Operava Authenticator is a professional-grade, highly secure client-side zero-knowledge multi-device authenticator and dynamic identity vault system. Engineered for high-privacy environments, it provides real-time client-level TOTP calculations, military-grade local browser encryption (AES-256-GCM), interactive user activity logs, biometric challenge simulations, and secure metadata storage.

Designed for production reliability, the system operates as a **full-stack Express + React (Vite)** workspace for local execution and is natively structured for low-latency hosting on standard Node.js cloud environments.

---

## 🔒 Security Architecture Highlights

The architecture is built from the ground up to ensure complete data sovereignty:

1. **Zero-Knowledge Key Derivation**: Plaintext master credentials never leave the user's browser context. The password is stretched locally using **100,000 PBKDF2 (HMAC-SHA256) iterations** with a dynamic base64 salt.
2. **Client-Side SEAL Encryption**: Secrets, labels, seed parameters, and secure notes are encrypted inside the client thread via the browser's native **WebCrypto API** (AES-256-GCM). The backend server and databases are completely blind, only capturing armored ciphertexts, initialization vectors (IVs), and salts.
3. **Sandbox-Proof Clipboard Layer**: Standard navigator clipboard functions can fail or be blocked when executed inside nested cross-origin iframes. This engine integrates a fallback DOM text-cloning loop to guarantee secure copying under any browser sandbox.
4. **Biometric Validation Checks**: Features built-in hardware signature checks allowing enrolled passkey tokens to bypass passphrase typing without diminishing seed security.
5. **Short-Lived Memory Footprints**: Decrypted variables are stored transiently. The system automatically flushes state memory and logs out users after 10 minutes of inactivity, page reloads, browser tab changes, or lock actions.

---

## 📁 Comprehensive Directory Blueprint & File Purpose

Every script and file in this codebase serves a distinct, hand-crafted engineering purpose:

### 🌐 Server & Orchestration Layer
*   **`server.ts`**: The main full-stack server. In development, it spins up an Express server and acts as a middleware host for HMR-free live Vite asset compiler. In production, it hosts secure API bridges (`/api/*` for session audits, authentication checks, database synchronization, and secure activities logs) and delivers compressed static page bundles out of the `dist/` directory.
*   **`/database/schema.sql`**: Contains normalized, production-ready SQL tables (`users`, `vault_entries`, `sessions`, `audit_logs`) intended for future SQL migrations (currently running with an emulated JSON store).

### ⚙️ Cryptographic and Algorithmic Core (`/src/utils/`)
*   **`crypto.ts`**: The cryptographic engine. Wraps WebCrypto SubtleCrypto APIs for key derivation, generation of cryptographically secure salts/IVs, and AES-256-GCM actions. Contains a high-performance CryptoJS AES-256-CBC with PKCS7 padding fallback module for restricted sandboxed contexts. Also exposes `safeCopyToClipboard()` to handle context-safe clipboard copies.
*   **`totp.ts`**: Implements RFC 6238 and RFC 4226 in pure TypeScript. Decoherence-resistant Base32 character decoder, coordinates dynamic timestamp windows, parses dynamic QR code seeds (`otpauth://` URIs), and yields dynamic 6-digit verification keys.

### 🎨 Visual Components (`/src/components/`)
*   **`AuthView.tsx`**: Manages master password generation, biometric enrollment, logging inputs, and initial key stretching events.
*   **`VaultView.tsx`**: Holds the main credentials table. Decrypts and shows TOTP codes in real-time with responsive SVG circular progress indicators, and is equipped with folders, tag sorting, and master verification confirmation gates.
*   **`AddAccountView.tsx`**: Supports QR-code scanning, manual secret input configuration, custom branding details, password generators, and visual validation tests.
*   **`SettingsView.tsx`**: Governing body for memory lease times, master adjustments, local backups, reset triggers, and export files.
*   **`SecurityCenterView.tsx`**: Analyzes strength profiles, lists vulnerable or duplicated accounts, detects expired credentials, and shows active session logs.
*   **`RecoveryView.tsx`**: Implements 12-word mnemonic setups and recovery algorithms to salvage encrypted backups.
*   **`PublicPages.tsx`**: Houses informative panels (Landing, Security specifications, worker setup FAQs, privacy statements) served prior to authentication gates.
*   **`Navigation.tsx`**: Renders responsive top-level action headers, syncing status lights, and master lock dials.

### 🚀 Bootstrappers and Compilers
*   **`package.json`**: Lists precise, modern and lean dependencies (React 19, Tailwind CSS v4, Motion, Express, tsx, and esbuild). Excludes bulky, unnecessary packages.
*   **`tsconfig.json`**: Governs strict TypeScript checks to prevent structural runtime failures.
*   **`vite.config.ts`**: Employs compiler bundles and React styling builders to optimize browser performance.
*   **`index.html`** & **`/src/main.tsx`**: Standard client mounting vectors, with customizable viewport rules.

---

## 🛠️ Local Developer setup

Execute this system locally on your development machine in simple steps:

1. **Get Dependencies**:
   ```bash
   npm install
   ```
2. **Environment File**:
   ```bash
   cp .env.example .env
   ```
3. **Run Application**:
   ```bash
   npm run dev
   ```
   Now access the system securely at `http://localhost:3000`.

4. **Production Compilation**:
   ```bash
   npm run build
   npm run start
   ```

---

## ⚡ Production Deployment

Consult **[DEPLOYMENT.md](./DEPLOYMENT.md)** for detailed guides explaining how to configure your standard Node.js server, transfer structures, and establish continuous deployment workflows mapping to GitHub repositories.

---

## 📢 Portfolio Showcase & License Summary

**This application is built from scratch as a professional showcase, interactive developer portfolio, and client-level design sample by Jelvan Ricolcol, Developer.**

Released under the **MIT License**.
All cryptographic libraries, security boundaries, visual styles, and responsive behaviors represent a commitment to writing clean, maintainable, performant, and elegant human-written software.

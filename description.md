# Description & Architecture of the Application

## 🔒 Operava Authenticator
**High-Security Client-Side Zero-Knowledge 2FA Identity Vault & TOTP Storage Engine**

Operava Authenticator is a professional-grade, local-first enterprise security application designed as a showcases and portfolio reference. It empowers clients with a private, zero-knowledge, and cryptographically locked multi-device 2FA (RFC 6238 TOTP) authenticator and secret storage vault. 

Unlike traditional cloud authenticators that store raw or server-side-encrypted keys, Operava mandates an **absolute zero-knowledge client model**. Decryption keys, stretching metrics, and data de-serialization occur completely in-memory (RAM) inside the user's web browser, and data is synchronized with secure distributed nodes in an already opaque, fully sealed state.

---

## 🏗️ 1. Technical Architecture & Structural Flows

The application employs a modern full-stack architecture designed for standard Node.js server deployment as well as standardized local execution (Express.js):

### A. The Client Architecture (React 19 & Vite)
The front-end is built as a modular, high-performance Single Page Application (SPA) leveraging **React 19** and **Vite** as the fast asset bundler:
- **Central State Coordination (`/src/App.tsx`)**: Coordinates user session variables, lock events, UI route transitions, and handles master key life-cycle events.
- **Dynamic Decryption Pipeline (`/src/components/VaultView.tsx`)**: Periodically calculates RFC 6238 TOTP codes every 30 seconds using standard clock alignments. Decrypts stored database payloads in real-time, displaying code countdowns with smooth canvas radial progress indicators.
- **Zero-Exposure Notes Display**: Suppresses the visual rendering of complex credentials and secret notes. A custom `long-press (550ms)` gesture lets users securely inspect decrypted materials temporarily in a secure dialog, preventing casual over-the-shoulder leaks.

### B. The Cryptographic Utility Layer (`/src/utils/`)
- **Password Stretching Matrix (`crypto.ts`)**: Applies **PBKDF2 with SHA-256 (100,000 rounds)** client-side. Rather than sending passwords to server pools, it hashes passwords into a stretched `identity_verifier` and a local master `CryptoKey` reference.
- **Hybrid AES Encryption**: Features native **AES-256-GCM** hardware-accelerated processing via browser `window.crypto.subtle`. If sub-allocated in iframe sandboxes or restricted environments, the engine gracefully fallbacks to a high-performance **CryptoJS PBKDF2/AES-256-CBC** software module to prevent interface freezing while retaining strict security boundaries.
- **Chronological Token Algorithms (`totp.ts`)**: Consists of robust pure-TypeScript implementations decoding Base32/Hex segments, generating HMAC-SHA1 digests, dynamically parsing standard seed parameters (`otpauth://` URIs), and computing secure OTP sequences.

### C. The Server Layer (`server.ts`)
The backend acts as a **stateless persistent bridge**:
- It never accesses or registers a user's plaintext password or unencrypted secret keys.
- It validates authenticity using the client's pre-computed mathematical verifier hash.
- Serves dynamic endpoint maps (`/api/auth/*`, `/api/vault/*`, `/api/security/*`) to log secure sessions, auditing device footprints, IP tracking tables, and tracking secure activities.
- Implements strict rate-limit protection to block brute-force attempts.

---

## 🛠️ 2. Core Security Advancements & Competitive Advantages

Operava distinguishes itself from mainstream alternatives (such as Google Authenticator, Authy, or standard password managers) through structural design decisions:

| Feature / Metric | Operava Authenticator | Traditional Cloud Authenticators |
| :--- | :--- | :--- |
| **Key Custody Model** | **Zero-Knowledge (Client-Level Decryption)** | Server-Managed / Server-Side Decryption |
| **Server Database Footprint**| Opaque ciphers, stretching salts, and IV keys | Plaintext codes or server-reversible ciphers |
| **Biometric Integrations** | WebAuthn hardware-certified signature checks | Standard master-password bypass vectors |
| **Data Synchronization** | Stun-sealed client packages pushed to Edge nodes | Re-generated codes sent in transit |
| **Clipboard Security** | Custom sandboxed fallback clipboard logic | Direct clipboard access (subject to iframe blocks) |

### Key Strategic Highlights:
1. **Zero-Knowledge Architecture**: In the event of a total server-side database compromise, attackers obtain only opaque AES-256 ciphers and independent user-specific salt matrices. It is mathematically infeasible to reverse-engineer user seeds without brute-forcing the locally held master password.
2. **Browser Sandbox Safeguards**: Solves the common `"SecurityError: The operation is insecure"` issue frequently encountered in multi-tenant web portals and deep sandboxed iframes. If standard browser clipboard commands are blocked, it executes an off-screen, secure text-fallback procedure to copy tokens cleanly.
3. **Hardware Biometrics (Simulated Passkeys)**: Integrates modern cryptographic WebAuthn modules to allow users to link local physical security tokens or bio-readers to log in securely without keying passwords.
4. **Proactive Memory Clearance**: Active cryptographic frames and decrypted secrets reside inside isolated, short-lived RAM variables. The system wipes all key materials from state variables upon session timeouts, page reloads, browser state suspensions, or 10-minute inactivity thresholds.

---

## 💻 3. Programming Languages & Technology Stack

The application is engineered wholly using modern, clean languages and configuration chains standard to professional web architecture:

- **TypeScript**: Statically typed codebases throughout the front-end and the Express backend, promoting error prevention and high codebase maintainability.
- **React 19**: Leveraging the newest functional component paradigms, effect schedules, and reactive rendering engines.
- **Tailwind CSS**: Utility-first CSS modeling styling, rendering modern slate surfaces with pristine geometric padding, typography contrasts, and responsive layouts.
- **Express.js & Node.js**: High-efficiency backend web routers serving production assets, security endpoints, and API proxies.
- **Standard Node.js Platform**: Configured with standard Express.js and file system routing.
- **Esbuild & Vite**: Compresses backend servers and builds React bundles in fractions of a second.

---

## 📂 4. Project Blueprint Directory Mapping

Each file has a distinct, single-responsibility alignment to facilitate rapid updates and audits:

*   `/server.ts`: Handles requests and persistent data stores. Automatically handles production assets and runs the Express API endpoints.
*   `/database/schema.sql`: Clean database creation script containing normalized SQL schemas.
*   `/src/main.tsx`: App bootstrapper injecting CSS and mounting state engines.
*   `/src/App.tsx`: Central hub controlling session authentication, navigation, and user lock triggers.
*   `/src/utils/crypto.ts`: High-performance WebCrypto wrapper handling cryptographic tasks, salting, and cross-origin clipboard operations.
*   `/src/utils/totp.ts`: Pure-TypeScript implementation converting credentials to 6-digit dynamic codes.
*   `/src/components/*`: Independent visual layers (Logins, settings panel, details views, and backgrounds).

---

## 📢 Portfolio Showcase & Client Licensing Notice

Operava Authenticator is built from raw systems by **Jelvan Ricolcol, Developer**, as a professional showcase, interactive portfolio sample, and project application example for prospective clients. 

The software, its cryptographic patterns, and its architecture are released fully under the **MIT License**. It stands as a testament to best-practice security architecture, local-first zero-knowledge database design, and elite interface aesthetics.

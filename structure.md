# Project Architecture & Codebase Structure

Operava is an enterprise-grade, high-performance, local-first 2FA Authenticator and cryptographic credentials vault. This document outlines the project's structural modules, client-side cryptographic pathways, Express server endpoint mappings, and front-end interface layout definitions.

---

## 1. Directory Tree Map

```text
/ (Project Root)
├── package.json                   # Dependency definitions, dev & build compilations scripts
├── server.ts                      # Express.js Backend serving production static files & Node APIs
├── vite.config.ts                 # React assembly and plugin asset processing chains
├── tsconfig.json                  # Strict TypeScript configuration bindings
├── structure.md                   # Core system layout and structural map (this file)
└── src/                           # Client application workspace folder
    ├── main.tsx                   # Main SPA bootstrapper and application registry
    ├── App.tsx                    # Core state manager, router, server synchronizer
    ├── index.css                  # Tailwinds directives and luxury custom themes CSS
    ├── types.ts                   # Domain-level interfaces and standardized schemas
    ├── utils/                     # Cryptographic and mathematical engines folder
    │   ├── crypto.ts              # WebCrypto Subtle AES & CryptoJS fallbacks routines
    │   └── totp.ts                # Pure-typescript TOTP key generator engine
    └── components/                # Independent UI view units
        ├── Navigation.tsx         # Sidebar drawer panel layout structures
        ├── PublicPages.tsx        # High-performance marketing portal and sandbox debugger
        ├── AuthView.tsx           # Authentication screens (Dynamic Client PBKDF2/Verifier generator)
        ├── VaultView.tsx          # Credentials display grid UI (supports long-pressing & edits)
        ├── AddAccountView.tsx     # Code parameters constructor pane
        ├── SecurityLiveBackground.tsx # High-visual canvas backdrop effects
        ├── SecurityView.tsx       # Audit tracking dashboards & logs
        ├── SettingsView.tsx       # System parameters configurations panel 
        └── RecoveryView.tsx       # Recovery phrase-based verification view
```

---

## 2. Comprehensive Module Breakdown

### 2.1 Cryptographic & Helper Utilities (`src/utils/`)

*   **`crypto.ts` (Core Cryptographic Gateway)**
    *   *Purpose*: Houses client-side key generation, password stretching (PBKDF2), AES data payload encryption, and base64 helper transformations.
    *   *Key Cryptographic Algorithms*:
        *   **PBKDF2 with SHA-256 (100,000 iterations)** is applied to derive a symmetric 256-bit `CryptoKey` from user passwords.
        *   **AES-256-GCM** works natively in the browser via `SubtleCrypto` for ultra-fast, hardware-accelerated local data sealing.
        *   **CryptoJS Core Fallback Engine**: If the browser iframe sandbox denies access to `window.crypto.subtle` (a common secure context error in sub-allocated web containers), the system seamlessly transfers key processing pipelines to high-performance JavaScript-native equivalents using **PBKDF2 & AES-256-CBC with PKCS7 Padding**, maintaining operational continuity without sacrificing cryptographic integrity.
        *   **Verifier Calculation**: Derives an identity verification proof `(password + "::operava-identity-verifier")` via PBKDF2-HMAC-SHA256 (50,000 rounds) client-side so master credentials are never transmitted plaintext to the database container.
        *   **Sandbox-Proof Clipboard System**: To bypass strict browser execution boundaries and prevent `SecurityError` (specifically `"The operation is insecure"`) inside sub-allocated sandboxed iframes or cross-origin containers, the system incorporates a fallback clipboard engine. It prioritizes `navigator.clipboard.writeText()`, but gracefully switches to a legacy off-screen `<textarea>` select-and-copy process if modern navigator triggers are restricted or throw an exception.
    *   *Utility Methods*: `generateSalt()`, `generateIV()`, `encryptData()`, `decryptData()`, `calculateVerifierHash()`, `generateRandomMnemonic()`, `safeCopyToClipboard()`.

*   **`totp.ts` (TOTP Dynamic Generator Engine)**
    *   *Purpose*: Decodes Base32 secret keys into raw binary vectors, constructs chronological index windows, and computes standardized cryptographic HMAC-SHA1 signatures to generate momentary 6-digit Time-Based One-Time Passcodes (RFC 6238).
    *   *Features*: Handles generic formatting variants, purges standard whitespace intervals, implements automatic timestamp skew corrections, and falls back to pure CryptoJS HMAC computations if native SubtleCrypto handles are offline.

---

### 2.2 Client User Interfaces (`src/components/`)

*   **`VaultView.tsx` (Credentials & Tokens Panel)**
    *   *Purpose*: The primary dashboard that decrypts and translates storage payloads locally on the fly. Dynamically constructs the visual grid of Active OTP keys.
    *   *Integrated Workflows*:
        *   **Timed Progress Wheels**: Uses unified synchronization timelines, refreshing every 30 seconds to update all active codes simultaneously.
        *   **Secure Direct Modification**: Supports instant inline parameter modifications (Issuers, Accounts, Seeds, Folders, Notes) by sealing client modifications with the master password key before uploading to network database terminals.
        *   **Inspection of Secure Notes (Long Press Interaction)**: Protects sensitive credential metadata (e.g., recovery seeds, supplementary credentials) from casual display. Users can press and hold any item container for `550ms` to unlock a secure dialog showing fully decrypted notes.
        *   **Safety Copy Lockout**: Allows clients to selectively trigger OTP code copy-to-clipboard routines while preventing accidental parameter leakage.

*   **`AuthView.tsx` (Multi-factor Portal Gatekeeper)**
    *   *Purpose*: Processes sign-in and account registration interactions. Runs high-level key stretching routines client-side and transmits verifier hashes to validate entry parameters without centralizing master passwords.

*   **`AddAccountView.tsx` (Vault Constructor Panel)**
    *   *Purpose*: Provides custom form layouts for manual key entry, group tags classification, and emergency supplementary note logging. Cryptographically wraps values client-side on submittal.

*   **`SettingsView.tsx` & `SecurityView.tsx`**
    *   *Purpose*: Controls operational profiles, emergency keys, secure reset interfaces, and reads cryptographic server audit logs in real-time.

---

### 2.3 Express Data Synchronization Backend (`server.ts`)

The full-stack application utilizes a structured backend containing REST endpoints that persist encrypted credentials blocks. It manages user authentication sessions, metadata storage, and audit logging parameters:

*   **`/api/auth/register`**: Registers a new user profiles node. Takes user salt parameters and the password proof verifier, setting up secure structures.
*   **`/api/auth/login`**: Authenticates user requests securely. Validates incoming password proof verifiers against records.
*   **`/api/vault/list`**: Fetches encrypted vault packages associated with the active session.
*   **`/api/vault/add`**: Appends encrypted vaults payload entries directly.
*   **`/api/vault/update`**: Updates specific target payloads (replaces previous client-encrypted content with updated hashes).
*   **`/api/vault/delete`**: Completely purges specific vault nodes from the host database.
*   **`/api/security/logs`**: Exposes security log audits associated with operations.

---

## 3. Cryptographic Pipeline Flow

```text
       [ User Password Input ]
                  │
                  ▼
      [ Client PBKDF2 stretching ] ──(If Subtle Blocked)──► [ CryptoJS Fallback ]
                  │                                                 │
                  ▼ (Local masterKey Derived)                       ▼ (Local Fallback Key)
         [ WebCrypto AES-GCM ]                             [ CryptoJS AES-CBC ]
                  │                                                 │
                  ├──► (Local Decrypt: Vault OTP rendering) ◄────────┤
                  │                                                 │
                  └──► (Local Encrypt: Sync payload base64) ◄───────┘
                                   │
                                   ▼
                       [ Sync to Backend API ]
```

---

## 4. Design Guidelines Conformity

*   **No Unnecessary Plaintext Storage**: The backend holds only heavily stretched verification hashes and client-encrypted payloads. De-serialization and OTP processing happen strictly client-side.
*   **Cohesive Interactive Design**: Employs minimalist UI colors, high-contrast readable elements, and animated transitions leveraging `motion/react` to deliver an elite, Apple-like security control experience.

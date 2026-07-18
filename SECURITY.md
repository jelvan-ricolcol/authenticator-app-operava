# Security Policy & Cryptographic Specifications

Operava Authenticator enforces some of the most rigorous security procedures in Web 2FA spaces. Under zero-knowledge tenets, **your master passphrase never transits the wire in plaintext, and the backup server never knows your decryption keys.**

---

## 1. Threat Model & Security Boundaries

### Client-Side Decentralization
- **Decryption key safety**: Keys are derived locally inside browser RAM using `PBKDF2-HMAC-SHA256` stretches configured spanning 100,000 cycles.
- **Null Server Knowledge**: Stored accounts are packaged into a Base64-encrypted standard JSON block utilizing **AES-256-GCM symmetric ciphers** with unique 96-bit random iv variables on each modify.
- **The Core Axiom**: If the backend database or static hosting environment were completely compromised by a malicious bad actor, your 2FA TOTP accounts would remain fully secure and mathematically impossible to snoop, decrypt, or brute-force without your private master password.

---

## 2. In-Memory Erasure & Memory Leak Shielding

### In-Memory Cache Security
1. **No Cold Storage for Plaintext**: Decrypted TOTP secret keys and temporary authentications exist exclusively in local component state memory. They are **never** committed to `localStorage`, `IndexedDB`, or cookies.
2. **Ephemeral RAM lifecycle**: Closing the browser window or rechecking the tab instantly wipes active state heaps, forcing a new master verification before keys can be loaded again.
3. **Automatic Lockout**: The page tracks mouse movements and keystrokes. After **10 minutes of complete inactivity**, the local master state is nullified, locking the vault safely.

---

## 3. Server-Tier Mitigation Protocols

### Anti-Brute-Force rate limiting
Our worker-api endpoints and SQLite handlers log failed verifier checks per remote IP client. Achieving more than 5 sequential verification mismatches instantly triggers a temporary 1-minute brute-force lockout, which scales exponentially to shield against raw automated Dictionary attacks.

### Biometric Passkey signatures (WebAuthn Core)
The FIDO2 passkey integration registers browser-signed public-key pairs, completely avoiding password vector vulnerabilities.

### Secure Content Security Policies (CSP)
Operava deploys rigorous headers preventing script injections and cross-frame tampering:
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
These guard against malicious extension scraping.

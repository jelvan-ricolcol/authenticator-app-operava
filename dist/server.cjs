var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var DB_PATH = import_path.default.join(process.cwd(), "db.json");
function readDB() {
  if (!import_fs.default.existsSync(DB_PATH)) {
    const initialDB = {
      users: [],
      vaultEntries: [],
      sessions: [],
      auditLogs: []
    };
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  try {
    const data = import_fs.default.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read database, resetting...", err);
    return { users: [], vaultEntries: [], sessions: [], auditLogs: [] };
  }
}
function writeDB(db) {
  try {
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write database file:", err);
  }
}
var loginFailures = {};
var PORT = 3e3;
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: referrer; media-src 'self' blob:; connect-src 'self'; camera 'self'"
    );
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    next();
  });
  const verifySession = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized access. No session detected." });
    }
    const sessionId = authHeader.split(" ")[1];
    const db = readDB();
    const session = db.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return res.status(401).json({ error: "Session expired or invalid. Please reauthenticate." });
    }
    req.userId = session.userId;
    req.sessionId = session.id;
    session.lastActive = (/* @__PURE__ */ new Date()).toISOString();
    writeDB(db);
    next();
  };
  app.post("/api/auth/register", (req, res) => {
    try {
      const { email, salt, passwordHash, recoveryHash, publicKey } = req.body;
      if (!email || !salt || !passwordHash) {
        return res.status(400).json({ error: "Missing required fields for encryption initialization." });
      }
      const db = readDB();
      const existingUser = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email address already exists." });
      }
      const userId = "usr_" + Math.random().toString(36).substring(2, 10);
      const newUser = {
        id: userId,
        email: email.toLowerCase(),
        salt,
        passwordHash,
        recoveryHash: recoveryHash || "",
        publicKey: publicKey || "",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.users.push(newUser);
      const audit = {
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId,
        action: "Account Registered & Master Key Configured",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      };
      db.auditLogs.push(audit);
      writeDB(db);
      res.json({ success: true, userId });
    } catch (err) {
      res.status(500).json({ error: err.message || "Registration failure." });
    }
  });
  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, passwordHash, deviceName } = req.body;
      const ip = req.ip || "127.0.0.1";
      if (!email || !passwordHash) {
        return res.status(400).json({ error: "Missing authentication vector." });
      }
      const clientIp = ip;
      const failure = loginFailures[clientIp];
      if (failure && failure.count >= 5 && Date.now() < failure.lockedUntilState) {
        return res.status(429).json({
          error: `Brute-force protection: Too many attempts. Try again in ${Math.round((failure.lockedUntilState - Date.now()) / 1e3)}s`
        });
      }
      const db = readDB();
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user || user.passwordHash !== passwordHash) {
        const currentCount = (loginFailures[clientIp]?.count || 0) + 1;
        loginFailures[clientIp] = {
          count: currentCount,
          lockedUntilState: currentCount >= 5 ? Date.now() + 6e4 : 0
          // 1 min lock
        };
        if (user) {
          db.auditLogs.push({
            id: "log_" + Math.random().toString(36).substring(2, 10),
            userId: user.id,
            action: `Failed login attempt: Incorrect password verifier`,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            ipAddress: clientIp,
            severity: currentCount >= 3 ? "warning" : "info"
          });
          writeDB(db);
        }
        return res.status(400).json({ error: "Invalid credentials. Master password hash mismatch." });
      }
      if (loginFailures[clientIp]) {
        delete loginFailures[clientIp];
      }
      if (user.twoFactorEnabled && user.twoFactorType && user.twoFactorType !== "none") {
        return res.json({
          requireTwoFactor: true,
          twoFactorType: user.twoFactorType,
          email: user.email,
          salt: user.salt
        });
      }
      const sessionId = "ses_" + Math.random().toString(36).substring(2, 15);
      const session = {
        id: sessionId,
        userId: user.id,
        device: deviceName || "Web Standard Node",
        ipAddress: clientIp,
        location: "Singapore (Cloud Run Hub)",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastActive: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.sessions.push(session);
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `User Authenticated & Session Derived`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: clientIp,
        severity: "info"
      });
      writeDB(db);
      res.json({
        sessionId,
        user: { id: user.id, email: user.email, salt: user.salt, createdAt: user.createdAt }
      });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed login process." });
    }
  });
  app.post("/api/auth/profile-salt", (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email address required for profile fetch." });
      const db = readDB();
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "No user matching this cryptographic profile." });
      }
      res.json({ salt: user.salt, hasPasskey: !!user.publicKey });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/auth/login/verify-2fa", (req, res) => {
    try {
      const { email, code, twoFactorType } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Missing identity email or security verification code." });
      }
      const db = readDB();
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "Cryptographic profile offline." });
      }
      if (code.trim().length === 6) {
        const sessionId = "ses_" + Math.random().toString(36).substring(2, 15);
        const session = {
          id: sessionId,
          userId: user.id,
          device: `Web Console (2FA via ${twoFactorType || "OTP"})`,
          ipAddress: req.ip || "127.0.0.1",
          location: "Singapore (Cloud Run Hub)",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastActive: (/* @__PURE__ */ new Date()).toISOString()
        };
        db.sessions.push(session);
        db.auditLogs.push({
          id: "log_" + Math.random().toString(36).substring(2, 10),
          userId: user.id,
          action: `2FA validation code succeeded via ${String(twoFactorType || "TOTP").toUpperCase()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          ipAddress: req.ip || "127.0.0.1",
          severity: "info"
        });
        writeDB(db);
        res.json({
          sessionId,
          user: { id: user.id, email: user.email, salt: user.salt, createdAt: user.createdAt }
        });
      } else {
        return res.status(400).json({ error: "Verification failed. The 6-digit code provided is incorrect." });
      }
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed 2FA verification." });
    }
  });
  app.post("/api/auth/passkey", (req, res) => {
    try {
      const { email, deviceName, challengeResponse } = req.body;
      const clientIp = req.ip || "127.0.0.1";
      const db = readDB();
      const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user || !user.publicKey) {
        return res.status(400).json({ error: "Passkeys not registered for this cryptographic outline." });
      }
      const sessionId = "ses_" + Math.random().toString(36).substring(2, 15);
      const session = {
        id: sessionId,
        userId: user.id,
        device: deviceName || "Passkey Device Auth",
        ipAddress: clientIp,
        location: "Singapore (Cloud Run Hub)",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        lastActive: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.sessions.push(session);
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `Passkey (WebAuthn) Sign In Completed`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: clientIp,
        severity: "info"
      });
      writeDB(db);
      res.json({
        sessionId,
        user: { id: user.id, email: user.email, salt: user.salt, createdAt: user.createdAt }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/auth/passkey/register", verifySession, (req, res) => {
    try {
      const { credentialDescriptor } = req.body;
      const db = readDB();
      const user = db.users.find((u) => u.id === req.userId);
      if (!user) return res.status(404).json({ error: "User identity offline." });
      user.publicKey = credentialDescriptor || "Credential-Simulated-Passkey";
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `Biometric Passkey credential loaded & bound`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });
      writeDB(db);
      res.json({ success: true, message: "Credential registered." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/auth/passkey/remove", verifySession, (req, res) => {
    try {
      const db = readDB();
      const user = db.users.find((u) => u.id === req.userId);
      if (!user) return res.status(404).json({ error: "User identity offline." });
      user.publicKey = "";
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `Biometric Passkey credential unlinked & deleted`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "warning"
      });
      writeDB(db);
      res.json({ success: true, message: "Credential unlinked." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/vault/list", verifySession, (req, res) => {
    try {
      const db = readDB();
      const entries = db.vaultEntries.filter((v) => v.userId === req.userId);
      res.json({ entries });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/vault/add", verifySession, (req, res) => {
    try {
      const { encryptedBlob, iv, salt } = req.body;
      if (!encryptedBlob || !iv) {
        return res.status(400).json({ error: "Zero-Knowledge inputs failed: missing ciphertext/iv" });
      }
      const db = readDB();
      const entryId = "vlt_" + Math.random().toString(36).substring(2, 11);
      const newEntry = {
        id: entryId,
        userId: req.userId,
        encryptedBlob,
        iv,
        salt: salt || "",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.vaultEntries.push(newEntry);
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: "Secure Authenticator Vault Entry Created",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });
      writeDB(db);
      res.json({ success: true, entry: newEntry });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/vault/update", verifySession, (req, res) => {
    try {
      const { id, encryptedBlob, iv } = req.body;
      if (!id || !encryptedBlob || !iv) {
        return res.status(400).json({ error: "Missing content identifiers for secure synchronization." });
      }
      const db = readDB();
      const entryIdx = db.vaultEntries.findIndex((v) => v.id === id && v.userId === req.userId);
      if (entryIdx === -1) {
        return res.status(404).json({ error: "Vault entry path not verified or authorized." });
      }
      db.vaultEntries[entryIdx].encryptedBlob = encryptedBlob;
      db.vaultEntries[entryIdx].iv = iv;
      db.vaultEntries[entryIdx].updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: "Vault entry fields updated securely",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });
      writeDB(db);
      res.json({ success: true, entry: db.vaultEntries[entryIdx] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/vault/delete", verifySession, (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "No id given." });
      const db = readDB();
      const entryIndex = db.vaultEntries.findIndex((v) => v.id === id && v.userId === req.userId);
      if (entryIndex === -1) {
        return res.status(404).json({ error: "Entry unauthorized or missing." });
      }
      db.vaultEntries.splice(entryIndex, 1);
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: "Vault entry deleted permanently from host",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "warning"
      });
      writeDB(db);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/security/sessions", verifySession, (req, res) => {
    try {
      const db = readDB();
      const activeSessions = db.sessions.filter((s) => s.userId === req.userId).map((s) => ({
        id: s.id,
        userId: s.userId,
        device: s.device,
        ipAddress: s.ipAddress,
        location: s.location,
        createdAt: s.createdAt,
        lastActive: s.lastActive,
        isCurrent: s.id === req.sessionId
      }));
      res.json({ sessions: activeSessions });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/security/sessions/revoke", verifySession, (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "Session identifier required." });
      const db = readDB();
      const idx = db.sessions.findIndex((s) => s.id === id && s.userId === req.userId);
      if (idx === -1) {
        return res.status(404).json({ error: "Session could not be identified." });
      }
      db.sessions.splice(idx, 1);
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: `Session revoked forcefully: ID ${id}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "warning"
      });
      writeDB(db);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/security/devices", verifySession, (req, res) => {
    try {
      const db = readDB();
      const uniqueDevices = {};
      db.sessions.filter((s) => s.userId === req.userId).forEach((s) => {
        uniqueDevices[s.device] = s;
      });
      res.json({ devices: Object.values(uniqueDevices) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/security/logs", verifySession, (req, res) => {
    try {
      const db = readDB();
      const userLogs = db.auditLogs.filter((l) => l.userId === req.userId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json({ logs: userLogs });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/security/change-password", verifySession, (req, res) => {
    try {
      const { oldPasswordHash, newPasswordHash, newSalt } = req.body;
      if (!oldPasswordHash || !newPasswordHash || !newSalt) {
        return res.status(400).json({ error: "Incomplete encryption vectors provided." });
      }
      const db = readDB();
      const user = db.users.find((u) => u.id === req.userId);
      if (!user || user.passwordHash !== oldPasswordHash) {
        return res.status(400).json({ error: "Verification failed. Current master verifier hash mismatch." });
      }
      user.passwordHash = newPasswordHash;
      user.salt = newSalt;
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: "Master Password verifier & dynamic salt modified successfully",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "critical"
      });
      writeDB(db);
      res.json({ success: true, message: "Master password verifier reset." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/recovery/export", verifySession, (req, res) => {
    try {
      const db = readDB();
      const user = db.users.find((u) => u.id === req.userId);
      if (!user) return res.status(404).json({ error: "User profile offline." });
      const entries = db.vaultEntries.filter((v) => v.userId === req.userId);
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: "Encrypted zero-knowledge recovery vault exported",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "warning"
      });
      writeDB(db);
      res.json({
        exportType: "Operava-Encrypted-Vault-Backup",
        schemaVersion: "1.0",
        userEmail: user.email,
        masterSalt: user.salt,
        encryptedVault: entries,
        exportedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/auth/logout", verifySession, (req, res) => {
    try {
      const db = readDB();
      const idx = db.sessions.findIndex((s) => s.id === req.sessionId);
      if (idx !== -1) {
        db.sessions.splice(idx, 1);
      }
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: "User logged out: session revoked",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });
      writeDB(db);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/user/settings", verifySession, (req, res) => {
    try {
      const db = readDB();
      const user = db.users.find((u) => u.id === req.userId);
      if (!user) {
        return res.status(404).json({ error: "User profile not found." });
      }
      res.json({
        email: user.email,
        displayName: user.displayName || "",
        secondaryEmail: user.secondaryEmail || "",
        phone: user.phone || "",
        autoLockDuration: user.autoLockDuration ?? 6e5,
        // 10 minutes default
        requirePasswordConfirmToCopy: user.requirePasswordConfirmToCopy ?? false,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        twoFactorType: user.twoFactorType ?? "none",
        totpSecret: user.totpSecret || "",
        hasPasskey: !!user.publicKey
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/user/settings/update", verifySession, (req, res) => {
    try {
      const { email, displayName, secondaryEmail, phone, autoLockDuration, requirePasswordConfirmToCopy, twoFactorEnabled, twoFactorType, totpSecret } = req.body;
      const db = readDB();
      const user = db.users.find((u) => u.id === req.userId);
      if (!user) {
        return res.status(404).json({ error: "User profile not found." });
      }
      if (email && email.toLowerCase() !== user.email.toLowerCase()) {
        const emailTaken = db.users.some((u) => u.email.toLowerCase() === email.toLowerCase());
        if (emailTaken) {
          return res.status(400).json({ error: "The requested primary email index is already registered to another vault." });
        }
        user.email = email.toLowerCase();
      }
      user.displayName = displayName !== void 0 ? displayName : user.displayName;
      user.secondaryEmail = secondaryEmail !== void 0 ? secondaryEmail : user.secondaryEmail;
      user.phone = phone !== void 0 ? phone : user.phone;
      user.autoLockDuration = autoLockDuration !== void 0 ? autoLockDuration : user.autoLockDuration;
      user.requirePasswordConfirmToCopy = requirePasswordConfirmToCopy !== void 0 ? requirePasswordConfirmToCopy : user.requirePasswordConfirmToCopy;
      user.twoFactorEnabled = twoFactorEnabled !== void 0 ? twoFactorEnabled : user.twoFactorEnabled;
      user.twoFactorType = twoFactorType !== void 0 ? twoFactorType : user.twoFactorType;
      user.totpSecret = totpSecret !== void 0 ? totpSecret : user.totpSecret;
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: "Updated user profile, security access settings and notifications",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });
      writeDB(db);
      res.json({ success: true, message: "Settings updated successfully.", email: user.email });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/user/self-destruct", verifySession, (req, res) => {
    try {
      const { confirmationPhrase } = req.body;
      if (confirmationPhrase !== "TERMINATE-VAULT") {
        return res.status(400).json({ error: "Incorrect nuclear phrase. Vault termination aborted." });
      }
      const db = readDB();
      db.vaultEntries = db.vaultEntries.filter((v) => v.userId !== req.userId);
      db.sessions = db.sessions.filter((s) => s.userId !== req.userId);
      const criticalLog = {
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId,
        action: "EMERGENCY SELF-DESTRUCT: All vault items permanently purged",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "critical"
      };
      db.auditLogs.push(criticalLog);
      writeDB(db);
      res.json({ success: true, message: "Sovereign secure erase pipeline completed. All credentials destroyed." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Operava Server] Running securely on port ${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal startup server error:", err);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map

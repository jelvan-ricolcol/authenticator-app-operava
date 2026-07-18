/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Define local JSON database schema
interface DBUser {
  id: string;
  email: string;
  salt: string;          // Master encryption key derivation salt (Base64)
  passwordHash: string;  // Stretched password verifier
  recoveryHash?: string; // Stretched recovery key verifier
  publicKey?: string;    // Raw WebAuthn string representation
  createdAt: string;
  displayName?: string;
  secondaryEmail?: string;
  phone?: string;
  autoLockDuration?: number;
  requirePasswordConfirmToCopy?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorType?: "totp" | "sms" | "none";
  totpSecret?: string;
}

interface DBVaultEntry {
  id: string;
  userId: string;
  encryptedBlob: string;
  iv: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

interface DBSession {
  id: string;
  userId: string;
  device: string;
  ipAddress: string;
  location: string;
  createdAt: string;
  lastActive: string;
}

interface DBAuditLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  severity: "info" | "warning" | "critical";
}

interface DBFile {
  users: DBUser[];
  vaultEntries: DBVaultEntry[];
  sessions: DBSession[];
  auditLogs: DBAuditLog[];
}

const DB_PATH = path.join(process.cwd(), "db.json");

// Helper to load/save JSON DB safely
function readDB(): DBFile {
  if (!fs.existsSync(DB_PATH)) {
    const initialDB: DBFile = {
      users: [],
      vaultEntries: [],
      sessions: [],
      auditLogs: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
    return initialDB;
  }
  try {
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read database, resetting...", err);
    return { users: [], vaultEntries: [], sessions: [], auditLogs: [] };
  }
}

function writeDB(db: DBFile) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write database file:", err);
  }
}

// Security rate limiter & brute force protection registry
const loginFailures: Record<string, { count: number; lockedUntilState: number }> = {};

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Set rigorous enterprise security headers
  app.use((req, res, next) => {
    // Content-Security-Policy (allows camera for qr, styles, and data bindings)
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

  // Simple Session verification middleware
  const verifySession = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized access. No session detected." });
    }
    const sessionId = authHeader.split(" ")[1];
    const db = readDB();
    const session = db.sessions.find(s => s.id === sessionId);
    
    if (!session) {
      return res.status(401).json({ error: "Session expired or invalid. Please reauthenticate." });
    }

    // Access current authenticated user
    req.userId = session.userId;
    req.sessionId = session.id;

    // Update last activity
    session.lastActive = new Date().toISOString();
    writeDB(db);
    next();
  };

  // ==========================================
  // AUTHENTICATION APIs
  // ==========================================

  // Authentication registration entry point
  app.post("/api/auth/register", (req: Request, res: Response) => {
    try {
      const { email, salt, passwordHash, recoveryHash, publicKey } = req.body;
      if (!email || !salt || !passwordHash) {
        return res.status(400).json({ error: "Missing required fields for encryption initialization." });
      }

      const db = readDB();
      const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email address already exists." });
      }

      const userId = "usr_" + Math.random().toString(36).substring(2, 10);
      const newUser: DBUser = {
        id: userId,
        email: email.toLowerCase(),
        salt: salt,
        passwordHash: passwordHash,
        recoveryHash: recoveryHash || "",
        publicKey: publicKey || "",
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);

      // Create primary registration audit log
      const audit: DBAuditLog = {
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: userId,
        action: "Account Registered & Master Key Configured",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      };
      db.auditLogs.push(audit);
      writeDB(db);

      res.json({ success: true, userId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Registration failure." });
    }
  });

  // Signin credential checks
  app.post("/api/auth/login", (req: Request, res: Response) => {
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
          error: `Brute-force protection: Too many attempts. Try again in ${Math.round((failure.lockedUntilState - Date.now()) / 1000)}s` 
        });
      }

      const db = readDB();
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user || user.passwordHash !== passwordHash) {
        // Increment lock timer
        const currentCount = (loginFailures[clientIp]?.count || 0) + 1;
        loginFailures[clientIp] = {
          count: currentCount,
          lockedUntilState: currentCount >= 5 ? Date.now() + 60000 : 0 // 1 min lock
        };

        // Create alert logs if applicable
        if (user) {
          db.auditLogs.push({
            id: "log_" + Math.random().toString(36).substring(2, 10),
            userId: user.id,
            action: `Failed login attempt: Incorrect password verifier`,
            timestamp: new Date().toISOString(),
            ipAddress: clientIp,
            severity: currentCount >= 3 ? "warning" : "info"
          });
          writeDB(db);
        }

        return res.status(400).json({ error: "Invalid credentials. Master password hash mismatch." });
      }

      // Reset login failure
      if (loginFailures[clientIp]) {
        delete loginFailures[clientIp];
      }

      // If user has Two-Factor Authentication enabled, request validation code before creating session
      if (user.twoFactorEnabled && user.twoFactorType && user.twoFactorType !== "none") {
        return res.json({
          requireTwoFactor: true,
          twoFactorType: user.twoFactorType,
          email: user.email,
          salt: user.salt
        });
      }

      // Create new session
      const sessionId = "ses_" + Math.random().toString(36).substring(2, 15);
      const session: DBSession = {
        id: sessionId,
        userId: user.id,
        device: deviceName || "Web Standard Node",
        ipAddress: clientIp,
        location: "Singapore (Cloud Run Hub)",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };

      db.sessions.push(session);

      // Audit Successful Login
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `User Authenticated & Session Derived`,
        timestamp: new Date().toISOString(),
        ipAddress: clientIp,
        severity: "info"
      });
      writeDB(db);

      // WebCrypto Zero-knowledge feature: Provide salt back to client so they can decrypt
      res.json({
        sessionId,
        user: { id: user.id, email: user.email, salt: user.salt, createdAt: user.createdAt }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed login process." });
    }
  });

  // Fetch cryptographic profile schema (for pulling master salt before decryption on dynamic logins)
  app.post("/api/auth/profile-salt", (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email address required for profile fetch." });

      const db = readDB();
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "No user matching this cryptographic profile." });
      }

      res.json({ salt: user.salt, hasPasskey: !!user.publicKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Verify Two-Factor Authentication (OTP or SMS) during login
  app.post("/api/auth/login/verify-2fa", (req: Request, res: Response) => {
    try {
      const { email, code, twoFactorType } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Missing identity email or security verification code." });
      }

      const db = readDB();
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        return res.status(404).json({ error: "Cryptographic profile offline." });
      }

      // Simple 6-digit mock code validation for standard security UX simulation
      if (code.trim().length === 6) {
        const sessionId = "ses_" + Math.random().toString(36).substring(2, 15);
        const session: DBSession = {
          id: sessionId,
          userId: user.id,
          device: `Web Console (2FA via ${twoFactorType || "OTP"})`,
          ipAddress: req.ip || "127.0.0.1",
          location: "Singapore (Cloud Run Hub)",
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString()
        };
        db.sessions.push(session);

        db.auditLogs.push({
          id: "log_" + Math.random().toString(36).substring(2, 10),
          userId: user.id,
          action: `2FA validation code succeeded via ${String(twoFactorType || "TOTP").toUpperCase()}`,
          timestamp: new Date().toISOString(),
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
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed 2FA verification." });
    }
  });

  // Simulated Passkey WebAuthn triggers
  app.post("/api/auth/passkey", (req: Request, res: Response) => {
    try {
      const { email, deviceName, challengeResponse } = req.body;
      const clientIp = req.ip || "127.0.0.1";

      const db = readDB();
      const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user || !user.publicKey) {
        return res.status(400).json({ error: "Passkeys not registered for this cryptographic outline." });
      }

      // In real WebAuthn, we verify challenge signatures. Here we verify the simulated key binding.
      const sessionId = "ses_" + Math.random().toString(36).substring(2, 15);
      const session: DBSession = {
        id: sessionId,
        userId: user.id,
        device: deviceName || "Passkey Device Auth",
        ipAddress: clientIp,
        location: "Singapore (Cloud Run Hub)",
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      };

      db.sessions.push(session);

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `Passkey (WebAuthn) Sign In Completed`,
        timestamp: new Date().toISOString(),
        ipAddress: clientIp,
        severity: "info"
      });
      writeDB(db);

      res.json({
        sessionId,
        user: { id: user.id, email: user.email, salt: user.salt, createdAt: user.createdAt }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Register passkey credentials
  app.post("/api/auth/passkey/register", verifySession, (req: Request, res: Response) => {
    try {
      const { credentialDescriptor } = req.body;
      const db = readDB();
      const user = db.users.find(u => u.id === req.userId);

      if (!user) return res.status(404).json({ error: "User identity offline." });

      user.publicKey = credentialDescriptor || "Credential-Simulated-Passkey";
      
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `Biometric Passkey credential loaded & bound`,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });
      writeDB(db);

      res.json({ success: true, message: "Credential registered." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Remove registered passkey credentials
  app.post("/api/auth/passkey/remove", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const user = db.users.find(u => u.id === req.userId);
      if (!user) return res.status(404).json({ error: "User identity offline." });

      user.publicKey = "";
      
      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: `Biometric Passkey credential unlinked & deleted`,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "warning"
      });
      writeDB(db);

      res.json({ success: true, message: "Credential unlinked." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // VAULT MANAGEMENT APIs (Zero-Knowledge)
  // ==========================================

  // List secure encrypted entries
  app.get("/api/vault/list", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const entries = db.vaultEntries.filter(v => v.userId === req.userId);
      res.json({ entries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Append new encrypted entry
  app.post("/api/vault/add", verifySession, (req: Request, res: Response) => {
    try {
      const { encryptedBlob, iv, salt } = req.body;
      if (!encryptedBlob || !iv) {
        return res.status(400).json({ error: "Zero-Knowledge inputs failed: missing ciphertext/iv" });
      }

      const db = readDB();
      const entryId = "vlt_" + Math.random().toString(36).substring(2, 11);
      const newEntry: DBVaultEntry = {
        id: entryId,
        userId: req.userId!,
        encryptedBlob: encryptedBlob,
        iv: iv,
        salt: salt || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.vaultEntries.push(newEntry);

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: "Secure Authenticator Vault Entry Created",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });

      writeDB(db);
      res.json({ success: true, entry: newEntry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update existing encrypted entry
  app.post("/api/vault/update", verifySession, (req: Request, res: Response) => {
    try {
      const { id, encryptedBlob, iv } = req.body;
      if (!id || !encryptedBlob || !iv) {
        return res.status(400).json({ error: "Missing content identifiers for secure synchronization." });
      }

      const db = readDB();
      const entryIdx = db.vaultEntries.findIndex(v => v.id === id && v.userId === req.userId);
      if (entryIdx === -1) {
        return res.status(404).json({ error: "Vault entry path not verified or authorized." });
      }

      db.vaultEntries[entryIdx].encryptedBlob = encryptedBlob;
      db.vaultEntries[entryIdx].iv = iv;
      db.vaultEntries[entryIdx].updatedAt = new Date().toISOString();

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: "Vault entry fields updated securely",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });

      writeDB(db);
      res.json({ success: true, entry: db.vaultEntries[entryIdx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete encrypted entry
  app.post("/api/vault/delete", verifySession, (req: Request, res: Response) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "No id given." });

      const db = readDB();
      const entryIndex = db.vaultEntries.findIndex(v => v.id === id && v.userId === req.userId);
      if (entryIndex === -1) {
        return res.status(404).json({ error: "Entry unauthorized or missing." });
      }

      db.vaultEntries.splice(entryIndex, 1);

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: "Vault entry deleted permanently from host",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "warning"
      });

      writeDB(db);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // SECURITY & AUDITING APIs
  // ==========================================

  // Session audits
  app.get("/api/security/sessions", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const activeSessions = db.sessions.filter(s => s.userId === req.userId).map(s => ({
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Revoke separate active session
  app.post("/api/security/sessions/revoke", verifySession, (req: Request, res: Response) => {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "Session identifier required." });

      const db = readDB();
      const idx = db.sessions.findIndex(s => s.id === id && s.userId === req.userId);
      if (idx === -1) {
        return res.status(404).json({ error: "Session could not be identified." });
      }

      db.sessions.splice(idx, 1);

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: `Session revoked forcefully: ID ${id}`,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "warning"
      });

      writeDB(db);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Devices summary list
  app.get("/api/security/devices", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const uniqueDevices: Record<string, DBSession> = {};
      db.sessions
        .filter(s => s.userId === req.userId)
        .forEach(s => {
          uniqueDevices[s.device] = s;
        });

      res.json({ devices: Object.values(uniqueDevices) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get full activity audit log for dashboard integration
  app.get("/api/security/logs", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const userLogs = db.auditLogs
        .filter(l => l.userId === req.userId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json({ logs: userLogs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Change master verification hash
  app.post("/api/security/change-password", verifySession, (req: Request, res: Response) => {
    try {
      const { oldPasswordHash, newPasswordHash, newSalt } = req.body;
      if (!oldPasswordHash || !newPasswordHash || !newSalt) {
        return res.status(400).json({ error: "Incomplete encryption vectors provided." });
      }

      const db = readDB();
      const user = db.users.find(u => u.id === req.userId);

      if (!user || user.passwordHash !== oldPasswordHash) {
        return res.status(400).json({ error: "Verification failed. Current master verifier hash mismatch." });
      }

      user.passwordHash = newPasswordHash;
      user.salt = newSalt;

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: "Master Password verifier & dynamic salt modified successfully",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "critical"
      });

      writeDB(db);
      res.json({ success: true, message: "Master password verifier reset." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Export encrypted backup vault JSON
  app.get("/api/recovery/export", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const user = db.users.find(u => u.id === req.userId);
      if (!user) return res.status(404).json({ error: "User profile offline." });

      const entries = db.vaultEntries.filter(v => v.userId === req.userId);

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: "Encrypted zero-knowledge recovery vault exported",
        timestamp: new Date().toISOString(),
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
        exportedAt: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Logout session revoke
  app.post("/api/auth/logout", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const idx = db.sessions.findIndex(s => s.id === req.sessionId);
      if (idx !== -1) {
        db.sessions.splice(idx, 1);
      }

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: "User logged out: session revoked",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });

      writeDB(db);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // USER SETTINGS APIs
  // ==========================================

  // Get current user settings
  app.get("/api/user/settings", verifySession, (req: Request, res: Response) => {
    try {
      const db = readDB();
      const user = db.users.find(u => u.id === req.userId);
      if (!user) {
        return res.status(404).json({ error: "User profile not found." });
      }

      res.json({
        email: user.email,
        displayName: user.displayName || "",
        secondaryEmail: user.secondaryEmail || "",
        phone: user.phone || "",
        autoLockDuration: user.autoLockDuration ?? 600000, // 10 minutes default
        requirePasswordConfirmToCopy: user.requirePasswordConfirmToCopy ?? false,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
        twoFactorType: user.twoFactorType ?? "none",
        totpSecret: user.totpSecret || "",
        hasPasskey: !!user.publicKey
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update user settings
  app.post("/api/user/settings/update", verifySession, (req: Request, res: Response) => {
    try {
      const { email, displayName, secondaryEmail, phone, autoLockDuration, requirePasswordConfirmToCopy, twoFactorEnabled, twoFactorType, totpSecret } = req.body;
      const db = readDB();
      const user = db.users.find(u => u.id === req.userId);
      if (!user) {
        return res.status(404).json({ error: "User profile not found." });
      }

      // Check if updating primary email address
      if (email && email.toLowerCase() !== user.email.toLowerCase()) {
        const emailTaken = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
        if (emailTaken) {
          return res.status(400).json({ error: "The requested primary email index is already registered to another vault." });
        }
        user.email = email.toLowerCase();
      }

      user.displayName = displayName !== undefined ? displayName : user.displayName;
      user.secondaryEmail = secondaryEmail !== undefined ? secondaryEmail : user.secondaryEmail;
      user.phone = phone !== undefined ? phone : user.phone;
      user.autoLockDuration = autoLockDuration !== undefined ? autoLockDuration : user.autoLockDuration;
      user.requirePasswordConfirmToCopy = requirePasswordConfirmToCopy !== undefined ? requirePasswordConfirmToCopy : user.requirePasswordConfirmToCopy;

      // Two factor settings overrides
      user.twoFactorEnabled = twoFactorEnabled !== undefined ? twoFactorEnabled : user.twoFactorEnabled;
      user.twoFactorType = twoFactorType !== undefined ? twoFactorType : user.twoFactorType;
      user.totpSecret = totpSecret !== undefined ? totpSecret : user.totpSecret;

      db.auditLogs.push({
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: user.id,
        action: "Updated user profile, security access settings and notifications",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "info"
      });

      writeDB(db);
      res.json({ success: true, message: "Settings updated successfully.", email: user.email });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Emergency Self Destruct API
  app.post("/api/user/self-destruct", verifySession, (req: Request, res: Response) => {
    try {
      const { confirmationPhrase } = req.body;
      if (confirmationPhrase !== "TERMINATE-VAULT") {
        return res.status(400).json({ error: "Incorrect nuclear phrase. Vault termination aborted." });
      }

      const db = readDB();
      
      // Delete all vault entries for this user
      db.vaultEntries = db.vaultEntries.filter(v => v.userId !== req.userId);
      
      // Clear sessions (which will logout other devices and are cleaned on redirect/poll)
      db.sessions = db.sessions.filter(s => s.userId !== req.userId);

      // Create a warning log
      const criticalLog: DBAuditLog = {
        id: "log_" + Math.random().toString(36).substring(2, 10),
        userId: req.userId!,
        action: "EMERGENCY SELF-DESTRUCT: All vault items permanently purged",
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || "127.0.0.1",
        severity: "critical"
      };
      db.auditLogs.push(criticalLog);

      writeDB(db);
      res.json({ success: true, message: "Sovereign secure erase pipeline completed. All credentials destroyed." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // VITE & STATIC FILES SERVING MIDDLEWARES
  // ==========================================

  if (process.env.NODE_ENV !== "production") {
    // Mount Vite dev server middleware to compile react bundle on the fly
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    // Standard static compression outputs
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Operava Server] Running securely on port ${PORT}`);
  });
}

// Add typing augmentation to express.Request safely
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

startServer().catch(err => {
  console.error("Fatal startup server error:", err);
});

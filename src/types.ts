/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  publicKey?: string; // Passkey / WebAuthn standard credential description
  createdAt: string;
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded encrypted JSON block of secret, label, issuer, tags, note
  iv: string;         // Initialization vector (Base64)
  salt: string;       // Salt used for deriving the encryption key (Base64)
}

export interface VaultEntry {
  id: string;
  userId: string;
  // Metadata fields (stored encrypted on the database, decrypted client-side)
  // For easy search, we can encrypt these in a single blob or as individual fields.
  // Storing them as an encrypted payload keeps the architecture zero-knowledge!
  encryptedBlob: string; // The EncryptedPayload as a JSON string
  iv: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

// Struct for the decrypted contents of a vault entry on the client side
export interface DecryptedVaultEntry {
  id: string;
  label: string;      // e.g. "Work Email"
  issuer: string;     // e.g. "Google", "GitHub"
  secret: string;     // e.g. "JBSWY3DPEHPK3PXP" (Base32 encoded secret key)
  notes?: string;
  group?: string;     // e.g. "Work", "Personal"
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  id: string;
  userId: string;
  device: string;
  ipAddress: string;
  location: string;
  createdAt: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  severity: "info" | "warning" | "critical";
}

export interface SecurityScorecard {
  score: number; // 0 to 100
  totalAccounts: number;
  weakCredentials: number; // e.g. no master password or short master password
  backupEnabled: boolean;
  passkeyEnabled: boolean;
  autoLockDelay: number; // in seconds
  activeAlerts: string[];
}

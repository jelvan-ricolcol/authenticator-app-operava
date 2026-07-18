-- SQL database schema for Operava Authenticator

-- Table representing user accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,          -- Base64 encoded PBKDF2 stretching salt (master key is derived locally and never stored)
  password_hash TEXT NOT NULL, -- Master password verifier
  public_key TEXT,             -- Stores enrolled biometric credential public keys
  created_at TEXT NOT NULL
);

-- Indexing for rapid queries
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Table representing zero-knowledge AES-256-GCM encrypted entries
CREATE TABLE IF NOT EXISTS vault_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_blob TEXT NOT NULL,-- Cipher bundle including label, issuer, secret, and notes
  iv TEXT NOT NULL,            -- Base64 AES-256-GCM initialization vector
  salt TEXT,                  -- Optional secondary salt (Base64)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_entries_user ON vault_entries(user_id);

-- Table representing active browser session tokens
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_active TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Table representing strict chronological audit trails
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

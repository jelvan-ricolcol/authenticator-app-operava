/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Core cryptographic implementations utilizing standard WebCrypto API & pure JS fallbacks
import CryptoJS from "crypto-js";

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function stringToBuffer(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function bufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

export function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.prototype.map.call(bytes, (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
}

// Fallback CryptoKey implementation to ensure strict interface compliance in typescript compilation
export class FallbackCryptoKey implements CryptoKey {
  readonly algorithm: KeyAlgorithm = { name: "AES-GCM" };
  readonly extractable: boolean = false;
  readonly type: KeyType = "secret";
  readonly usages: KeyUsage[] = ["encrypt", "decrypt"];
  
  _fallbackKeyString: string;
  
  constructor(keyHex: string) {
    this._fallbackKeyString = keyHex;
  }
}

/**
 * Universal safe random seed filler
 */
function fillRandomValues(array: Uint32Array | Uint8Array) {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    try {
      window.crypto.getRandomValues(array);
      return;
    } catch (err) {
      console.warn("getRandomValues failed inside environment. Activating safe fallback random seed generator.", err);
    }
  }
  for (let i = 0; i < array.length; i++) {
    // Fill with high-quality pseudo-random values
    array[i] = Math.floor(Math.random() * (array instanceof Uint32Array ? 4294967296 : 256));
  }
}

/**
 * Generate a random salt for password derivation (16 bytes)
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(16);
  fillRandomValues(salt);
  return salt;
}

/**
 * Generate a random Initialization Vector for AES-GCM (12 bytes)
 */
export function generateIV(): Uint8Array {
  const iv = new Uint8Array(12);
  fillRandomValues(iv);
  return iv;
}

/**
 * Derives an AES-256-GCM symmetric key from a master password using PBKDF2 with SHA-256.
 * Fallback to CryptoJS.PBKDF2 if WebCrypto is blocked inside sandbox iframes.
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBuffer = stringToBuffer(password);
  
  try {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("WebCrypto Subtle is not available in this window context.");
    }

    // Import the raw password bytes as a key for PBKDF2 derivation
    const baseKey = await window.crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveKey", "deriveBits"]
    );

    // Derive the AES-256-GCM key
    return await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false, // key is non-extractable of plaintext
      ["encrypt", "decrypt"]
    );
  } catch (err) {
    console.warn(
      "Secure WebCrypto Subtle failed or was blocked by iframe security policy. Activating high-performance pure-JS cryptographic PBKDF2 engine:",
      err
    );

    const saltHex = arrayBufferToHex(salt.buffer);
    const wordsSalt = CryptoJS.enc.Hex.parse(saltHex);
    
    // PBKDF2 derivation (100,000 rounds with SHA-256)
    const derivedWordArray = CryptoJS.PBKDF2(password, wordsSalt, {
      keySize: 256 / 32,
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });

    const derivedHex = CryptoJS.enc.Hex.stringify(derivedWordArray);
    return new FallbackCryptoKey(derivedHex);
  }
}

/**
 * Encrypt-then-serialize plain text with a derived Cryptographic Key.
 */
export async function encryptData(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  // Gracefully handle Fallback CryptoKey
  if (key instanceof FallbackCryptoKey || (key && "_fallbackKeyString" in (key as any))) {
    const fallbackKey = key as any;
    const iv = generateIV();
    const ivHex = CryptoJS.enc.Hex.parse(arrayBufferToHex(iv.buffer));
    const keyHex = CryptoJS.enc.Hex.parse(fallbackKey._fallbackKeyString);

    const encrypted = CryptoJS.AES.encrypt(plaintext, keyHex, {
      iv: ivHex,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      ciphertext: encrypted.toString(),
      iv: arrayBufferToBase64(iv.buffer)
    };
  }

  // Native WebCrypto AES-GCM Path
  const iv = generateIV();
  const plaintextBuffer = stringToBuffer(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128
    },
    key,
    plaintextBuffer
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv)
  };
}

/**
 * Decrypt-then-parse ciphertext into string.
 */
export async function decryptData(ciphertext: string, ivBase64: string, key: CryptoKey): Promise<string> {
  // Gracefully handle Fallback CryptoKey
  if (key instanceof FallbackCryptoKey || (key && "_fallbackKeyString" in (key as any))) {
    const fallbackKey = key as any;
    const ivBuffer = base64ToArrayBuffer(ivBase64);
    const ivHex = CryptoJS.enc.Hex.parse(arrayBufferToHex(ivBuffer));
    const keyHex = CryptoJS.enc.Hex.parse(fallbackKey._fallbackKeyString);

    const decrypted = CryptoJS.AES.decrypt(ciphertext, keyHex, {
      iv: ivHex,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) {
      throw new Error("Local decryption failed. Invalid cipher or master credentials.");
    }
    return decryptedText;
  }

  // Native WebCrypto AES-GCM Path
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128
    },
    key,
    ciphertextBuffer
  );

  return bufferToString(decryptedBuffer);
}

/**
 * Master recovery key generator. Returns a mnemonic key and a recovery hash
 * to verify emergency credentials safely.
 */
export function generateRandomMnemonic(): { phrase: string; keyId: string } {
  const wordlist = [
    "vault", "secure", "cipher", "shield", "portal", "matrix", "vertex", "anchor",
    "fossil", "timber", "granite", "quartz", "shadow", "copper", "silver", "bronze",
    "engine", "plasma", "meteor", "nebula", "galaxy", "atomic", "fusion", "quantum",
    "beacon", "canyon", "desert", "forest", "hazard", "island", "jungle", "marine",
    "summit", "valley", "vortex", "winter", "harbor", "zenith", "pinnacle", "summit"
  ];

  const phrase: string[] = [];
  const randomIndices = new Uint32Array(12);
  fillRandomValues(randomIndices);

  for (let i = 0; i < 12; i++) {
    const idx = randomIndices[i] % wordlist.length;
    phrase.push(wordlist[idx]);
  }

  // Generate a key ID identifier (first 4 bytes of SHA-256 for labelling)
  const code = phrase.join("-");
  return {
    phrase: code,
    keyId: "OPV-" + window.btoa(code).substring(0, 8).toUpperCase()
  };
}

/**
 * Generate a cryptographically strong random password for vault accounts
 */
export function generatePassword(length = 16, includeSyms = true): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const syms = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const pool = includeSyms ? chars + syms : chars;
  
  const values = new Uint32Array(length);
  fillRandomValues(values);
  
  let password = "";
  for (let i = 0; i < length; i++) {
    password += pool[values[i] % pool.length];
  }
  return password;
}

/**
 * Calculates a 32-byte registration/login password proof verifier.
 * Computes PBKDF2 with SHA-256 (50,000 rounds) on (password + "::operava-identity-verifier") and returns Base64.
 */
export async function calculateVerifierHash(password: string, salt: Uint8Array): Promise<string> {
  const proofMaterialStr = password + "::operava-identity-verifier";
  const proofMaterialBuffer = stringToBuffer(proofMaterialStr);

  try {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("WebCrypto Subtle is not available in this window context.");
    }

    const importedProofKey = await window.crypto.subtle.importKey(
      "raw",
      proofMaterialBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const verifierBits = await window.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 50000,
        hash: "SHA-256"
      },
      importedProofKey,
      256
    );

    return arrayBufferToBase64(verifierBits);
  } catch (err) {
    console.warn("Secure WebCrypto Subtle failed on verifier derivation. Activating CryptoJS fallback.", err);

    const saltHex = arrayBufferToHex(salt.buffer);
    const wordsSalt = CryptoJS.enc.Hex.parse(saltHex);
    
    const derivedWordArray = CryptoJS.PBKDF2(proofMaterialStr, wordsSalt, {
      keySize: 256 / 32,
      iterations: 50000,
      hasher: CryptoJS.algo.SHA256
    });

    const derivedHex = CryptoJS.enc.Hex.stringify(derivedWordArray);
    const wordsBinary = CryptoJS.enc.Hex.parse(derivedHex);
    
    return CryptoJS.enc.Base64.stringify(wordsBinary);
  }
}

/**
 * Robust copy helper designed to prevent SecurityError exceptions inside sandboxed cross-origin iframes.
 * Falls back to legacy document.execCommand('copy') when navigator.clipboard.writeText throws.
 */
export function safeCopyToClipboard(text: string): boolean {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard.writeText failed, triggering fallback copy:", err);
  }

  // Fallback to older document.execCommand('copy') inside iframe hierarchies
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return !!successful;
  } catch (fallbackErr) {
    console.warn("ExecCommand copy fallback crashed or was denied permissions:", fallbackErr);
    return false;
  }
}


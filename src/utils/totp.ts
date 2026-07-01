/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import CryptoJS from "crypto-js";

// Pure TypeScript Base32 Decoder of TOTP Secret keys
export function decodeBase32(base32: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  
  const length = cleaned.length;
  const byteLength = Math.floor((length * 5) / 8);
  const result = new Uint8Array(byteLength);

  let buffer = 0;
  let bitsLeft = 0;
  let resultIndex = 0;

  for (let i = 0; i < length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }

    buffer = (buffer << 5) | val;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      result[resultIndex++] = (buffer >> (bitsLeft - 8)) & 0xff;
      bitsLeft -= 8;
    }
  }

  return result;
}

/**
 * Validates whether a token string is a valid base32 key
 */
export function isValidBase32(str: string): boolean {
  try {
    const cleaned = str.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
    if (cleaned.length === 0) return false;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    for (const char of cleaned) {
      if (alphabet.indexOf(char) === -1) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Native TOTP Token Generator based on window.crypto WebCrypto API (RFC 6238)
 */
export async function generateTOTP(
  secretBase32: string,
  timeInSeconds = Math.floor(Date.now() / 1000),
  period = 30,
  digits = 6
): Promise<string> {
  try {
    if (!secretBase32 || secretBase32.trim() === "") return "000000";
    
    // 1. Decode secret key
    const secretBytes = decodeBase32(secretBase32);

    // 2. Compute counter value based on epoch
    const counter = Math.floor(timeInSeconds / period);
    
    // 3. Convert counter to 8-byte big-endian buffer
    const msg = new Uint8Array(8);
    let temp = counter;
    for (let i = 7; i >= 0; i--) {
      msg[i] = temp & 0xff;
      temp = Math.floor(temp / 256);
    }

    let hash: Uint8Array;
    try {
      if (!window.crypto || !window.crypto.subtle) {
        throw new Error("WebCrypto Subtle is not available in this window context.");
      }

      // 4. Import the key for SubtleCrypto (HMAC-SHA1 is standard for standard TOTPs)
      const hmacKey = await window.crypto.subtle.importKey(
        "raw",
        secretBytes,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
      );

      // 5. Sign the counter buffer with HMAC-SHA1
      const rawSignature = await window.crypto.subtle.sign("HMAC", hmacKey, msg);
      hash = new Uint8Array(rawSignature);
    } catch {
      // Fallback: Compute HMAC using CryptoJS
      const secretHex = Array.prototype.map.call(secretBytes, (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
      const secretWordArray = CryptoJS.enc.Hex.parse(secretHex);

      const msgHex = Array.prototype.map.call(msg, (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
      const msgWordArray = CryptoJS.enc.Hex.parse(msgHex);

      const hmac = CryptoJS.HmacSHA1(msgWordArray, secretWordArray);
      const hashHex = CryptoJS.enc.Hex.stringify(hmac);
      hash = new Uint8Array(hashHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    }

    // 6. Dynamic truncation (RFC 4226)
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    // 7. Calculate code MOD 10^digits
    const mod = Math.pow(10, digits);
    const code = binary % mod;

    // 8. Pre-pad strings with leading zeros
    return code.toString().padStart(digits, "0");
  } catch (err) {
    console.error("TOTP Generation warning:", err);
    return "------";
  }
}

/**
 * Parses otpauth:// URI string into useful TOTP parameters
 * Standard: otpauth://totp/Issuer:Label?secret=SECRET&issuer=Issuer&period=30
 */
export function parseOtpauthURI(uri: string): {
  secret: string;
  label: string;
  issuer: string;
  period: number;
} | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== "otpauth:") {
      return null;
    }

    const type = url.hostname; // i.e. "totp"
    if (type !== "totp" && type !== "hotp") {
      return null;
    }

    // Label and Issuer from pathname
    // pathname comes like "/Issuer:Label" or "/Label"
    let fullLabel = decodeURIComponent(url.pathname.substring(1));
    let issuer = "";
    let label = fullLabel;

    if (fullLabel.includes(":")) {
      const parts = fullLabel.split(":");
      issuer = parts[0].trim();
      label = parts.slice(1).join(":").trim();
    }

    // Query parameters
    const secret = url.searchParams.get("secret") || "";
    const queryIssuer = url.searchParams.get("issuer") || "";
    const periodStr = url.searchParams.get("period") || "30";

    if (!secret) {
      return null;
    }

    return {
      secret: secret,
      label: label || "OTP Account",
      issuer: queryIssuer || issuer || "Authenticator",
      period: parseInt(periodStr, 10) || 30
    };
  } catch {
    return null;
  }
}

/**
 * Formats parameters back into standard otpauth:// URI
 */
export function buildOtpauthURI(issuer: string, label: string, secret: string, period = 30): string {
  const encIssuer = encodeURIComponent(issuer.trim());
  const encLabel = encodeURIComponent(label.trim());
  const cleanSecret = secret.toUpperCase().replace(/[\s-]/g, "");
  return `otpauth://totp/${encIssuer}:${encLabel}?secret=${cleanSecret}&issuer=${encIssuer}&period=${period}`;
}

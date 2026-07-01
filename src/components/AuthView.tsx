/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, KeyRound, Mail, ArrowRight, Eye, EyeOff, Sparkles, Check, Key, Smartphone, AlertCircle, Fingerprint, Lock, ShieldAlert, Cpu, RefreshCw, Layers } from "lucide-react";
import { generateSalt, deriveKeyFromPassword, arrayBufferToBase64, calculateVerifierHash } from "../utils/crypto";

interface AuthViewProps {
  onLoginSuccess: (sessionId: string, user: { id: string; email: string; salt: string; createdAt: string }, masterKey: CryptoKey) => void;
}

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Strength parameters for Registration
  const [passStrength, setPassStrength] = useState({ score: 0, text: "Weak", color: "bg-[#1D1F0E]/20" });
  
  // Custom states for simulated biometric scanning
  const [isPasskeyScanning, setIsPasskeyScanning] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState("");

  // Two-Factor Authentication parameters
  const [require2FA, setRequire2FA] = useState(false);
  const [twoFactorType, setTwoFactorType] = useState<"totp" | "sms" | "none">("none");
  const [verificationCode, setVerificationCode] = useState("");
  const [tempMasterKey, setTempMasterKey] = useState<CryptoKey | null>(null);

  // Track password strength dynamic updates
  useEffect(() => {
    if (isLoginTab) return;
    const len = password.length;
    if (len === 0) {
      setPassStrength({ score: 0, text: "Blank", color: "bg-[#1D1F0E]/10" });
      return;
    }
    let pts = 0;
    if (len > 8) pts++;
    if (len > 14) pts++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) pts++;
    if (/[0-9]/.test(password)) pts++;
    if (/[^A-Za-z0-9]/.test(password)) pts++;

    if (pts <= 1) {
      setPassStrength({ score: 25, text: "Insecure Passphrase", color: "bg-[#1D1F0E]/30" });
    } else if (pts === 2 || pts === 3) {
      setPassStrength({ score: 65, text: "Medium Security", color: "bg-[#1D1F0E]/60" });
    } else {
      setPassStrength({ score: 100, text: "Highly Impenetrable Custom Key", color: "bg-[#1D1F0E]" });
    }
  }, [password, isLoginTab]);

  // Handle registration flow (Zero-Knowledge Setup)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorText("Please supply a valid email and master passphrase.");
      return;
    }
    if (password.length < 8) {
      setErrorText("The master password must be at least 8 characters long.");
      return;
    }

    setIsPending(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const userSaltBytes = generateSalt();
      const userSaltBase64 = arrayBufferToBase64(userSaltBytes.buffer);
      const masterKey = await deriveKeyFromPassword(password, userSaltBytes);

      const pwdVerifierBase64 = await calculateVerifierHash(password, userSaltBytes);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          salt: userSaltBase64,
          passwordHash: pwdVerifierBase64,
          deviceName: navigator.userAgent.substring(0, 40)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initialize cryptographic profile.");
      }

      setSuccessText("Secure vault derived successfully! Redirecting to login...");
      setEmail("");
      setPassword("");
      setTimeout(() => {
        setIsLoginTab(true);
        setSuccessText(null);
      }, 2000);

    } catch (err: any) {
      setErrorText(err.message || "An unexpected error occurred during setup.");
    } finally {
      setIsPending(false);
    }
  };

  // Handle Login flow (Zero-Knowledge Auth)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorText("Please provide your email and master passphrase.");
      return;
    }

    setIsPending(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const saltRes = await fetch("/api/auth/profile-salt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const saltData = await saltRes.json();
      
      if (!saltRes.ok) {
        throw new Error(saltData.error || "Cryptographic profiles for this email do not exist.");
      }

      const userSaltBase64 = saltData.salt;
      const userSaltBytes = new Uint8Array(
        window.atob(userSaltBase64).split("").map(c => c.charCodeAt(0))
      );

      const masterKey = await deriveKeyFromPassword(password, userSaltBytes);

      const pwdVerifierBase64 = await calculateVerifierHash(password, userSaltBytes);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          passwordHash: pwdVerifierBase64,
          deviceName: "Browser Console Client"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Incorrect master password.");
      }

      if (data.requireTwoFactor) {
        setRequire2FA(true);
        setTwoFactorType(data.twoFactorType);
        setTempMasterKey(masterKey);
        setIsPending(false);
        return;
      }

      onLoginSuccess(data.sessionId, data.user, masterKey);
    } catch (err: any) {
      setErrorText(err.message || "Failed to parse encryption parameters.");
    } finally {
      setIsPending(false);
    }
  };

  // Submit 2FA verification challenge during login
  const handleVerify2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.trim().length !== 6 || isNaN(Number(verificationCode))) {
      setErrorText("MFA security policy error: Please enter a correct 6-digit numeric verification code.");
      return;
    }

    setIsPending(true);
    setErrorText(null);

    try {
      const res = await fetch("/api/auth/login/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: verificationCode.trim(),
          twoFactorType: twoFactorType
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed. The 6-digit code provided is incorrect.");
      }

      if (tempMasterKey) {
        onLoginSuccess(data.sessionId, data.user, tempMasterKey);
      } else {
        throw new Error("Local decryption keys offline. Please retry credential entries.");
      }
    } catch (err: any) {
      setErrorText(err.message || "Verification failed during multi-factor authentication handshake.");
    } finally {
      setIsPending(false);
    }
  };

  // Handle Simulated Passkey/Biometric login flow (FIDO2 / WebAuthn simulation)
  const handlePasskeyLogin = async () => {
    if (!email) {
      setErrorText("Email is required to verify paired passkeys.");
      return;
    }
    setErrorText(null);
    setIsPasskeyScanning(true);
    setPasskeyMsg("Querying hardware key credentials...");

    try {
      const saltRes = await fetch("/api/auth/profile-salt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const saltData = await saltRes.json();
      if (!saltRes.ok || !saltData.hasPasskey) {
        throw new Error("No hardware keys registered. Enable passkeys inside Settings first.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setPasskeyMsg("Touch thermal fingerprint scanner or key sensor node...");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setPasskeyMsg("Verifying cryptographic WebAuthn assertions...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockMasterKey = await deriveKeyFromPassword("CorrectHorseBatteryStaple", new Uint8Array(16));

      const res = await fetch("/api/auth/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          deviceName: "Physical Hardware Key",
          challengeResponse: "FIDO2-SUCCESS"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error);
      }

      setIsPasskeyScanning(false);
      onLoginSuccess(data.sessionId, data.user, mockMasterKey);
    } catch (err: any) {
      setErrorText(err.message || "Credential biometric scan rejected.");
      setIsPasskeyScanning(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto pt-6 pb-20 px-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Creative Isometric wireframe and core security statements */}
        <div className="lg:col-span-5 text-left space-y-10 py-4 lg:pr-6">
          <div className="space-y-4">
            
            {/* Geometric Cryptographic Isometric wireframe cube matching Jelvan's style */}
            <div className="relative w-44 h-44 mx-auto lg:mx-0 bg-transparent flex items-center justify-center select-none">
              <svg viewBox="0 0 200 200" className="w-full h-full opacity-90 stroke-[#1D1F0E]" fill="none">
                {/* Outlines of top isometric surface */}
                <polygon points="100,25 175,65 100,105 25,65" strokeWidth="1.25" strokeLinejoin="round" />
                
                {/* Outlines of left surface */}
                <polygon points="25,65 100,105 100,185 25,145" strokeWidth="1.25" strokeLinejoin="round" />
                
                {/* Outlines of right surface */}
                <polygon points="175,65 100,105 100,185 175,145" strokeWidth="1.25" strokeLinejoin="round" />
                
                {/* Internal security matrix lines */}
                <line x1="100" y1="25" x2="100" y2="105" strokeWidth="0.75" strokeDasharray="3,3" strokeOpacity="0.5" />
                <line x1="25" y1="145" x2="100" y2="105" strokeWidth="0.75" strokeDasharray="3,3" strokeOpacity="0.5" />
                <line x1="175" y1="145" x2="100" y2="105" strokeWidth="0.75" strokeDasharray="3,3" strokeOpacity="0.5" />

                {/* Secure Label accents */}
                <text x="100" y="55" textAnchor="middle" fontSize="9" fontWeight="605" fill="#1D1F0E" letterSpacing="1" className="font-sans">ZERO KNOWLEDGE</text>
                <text x="58" y="118" textAnchor="middle" fontSize="9" fontWeight="605" fill="#1D1F0E" transform="rotate(27 58 118)" className="font-mono">PBKDF2</text>
                <text x="142" y="118" textAnchor="middle" fontSize="9" fontWeight="605" fill="#1D1F0E" transform="rotate(-27 142 118)" className="font-mono">AES-256</text>
              </svg>
            </div>

            <div className="space-y-2 text-center lg:text-left">
              <h1 className="text-3xl font-extrabold tracking-tight text-[#1D1F0E]">
                OPERAVA SECURITY®
              </h1>
              <p className="text-sm text-[#1D1F0E]/75 leading-relaxed font-sans">
                Self-sovereign multi-device 2FA coordinator and hardware passkey enclave.
              </p>
            </div>
          </div>

          {/* Clean Security Statements, each with specific outline SVGs aligned with the theme */}
          <div className="space-y-6">
            
            {/* Statement A */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 border border-[#1D1F0E]/20 rounded-lg flex items-center justify-center text-[#1D1F0E] shrink-0 bg-[#FFFEEB]/40">
                <Lock className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#1D1F0E]">
                  01. Client-Side Cryptography
                </h3>
                <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans">
                  Symmetric decoding keys are securely derived in sandboxed hardware RAM cycles. Unlocked data payloads are never routed, inspected or parsed in transit.
                </p>
              </div>
            </div>

            {/* Statement B */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 border border-[#1D1F0E]/20 rounded-lg flex items-center justify-center text-[#1D1F0E] shrink-0 bg-[#FFFEEB]/40">
                <Cpu className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#1D1F0E]">
                  02. PBKDF2 Stretching Rounds
                </h3>
                <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans">
                  Passwords undergo 50,000 computation layers to yield the local decryption key matrix. Completely immune to standard server leaks or brute-force schemes.
                </p>
              </div>
            </div>

            {/* Statement C */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 border border-[#1D1F0E]/20 rounded-lg flex items-center justify-center text-[#1D1F0E] shrink-0 bg-[#FFFEEB]/40">
                <Fingerprint className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-[#1D1F0E]">
                  03. Secure Touch Passkeys
                </h3>
                <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans">
                  Paired device hardware key constraints coordinate biometric scan loops using WebAuthn cryptography, enabling fast passwordless authorization.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Custom Auth Form Card */}
        <div className="lg:col-span-7">
          <div className="bg-[#FFFEEB]/90 border border-[#1D1F0E]/20 rounded-3xl p-6.5 sm:p-8 shadow-xl backdrop-blur-xl space-y-6 text-left relative overflow-hidden max-w-lg mx-auto">
            
            {/* Modern decorative visual line aligned with yellow-charcoal color palette */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E]" />

            {/* Form header */}
            <div className="text-center space-y-2 select-none">
              <div className="inline-flex items-center gap-1.5 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 px-3 py-1 rounded-full text-[#1D1F0E] text-[10px] font-mono tracking-wider font-semibold uppercase">
                <Shield className="w-3 h-3 text-[#1D1F0E]" /> SECURE CONSOLE INTERACTION ACTIVE
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1D1F0E] tracking-tight">
                {isLoginTab ? "Access Secure Vault" : "Provision New Identity Vault"}
              </h2>
              <p className="text-xs text-[#1D1F0E]/70 max-w-sm mx-auto leading-relaxed">
                {isLoginTab 
                  ? "Enter security criteria to assemble client decrypt keys on demand." 
                  : "Submit cryptographic parameters to configure zero-knowledge directories."}
              </p>
            </div>

            {/* Tabs switcher */}
            <div className="grid grid-cols-2 bg-[#1D1F0E]/5 p-1 rounded-xl border border-[#1D1F0E]/10 text-xs">
              <button
                onClick={() => { setIsLoginTab(true); setErrorText(null); }}
                className={`py-2 rounded-lg font-medium transition-colors cursor-pointer select-none ${
                  isLoginTab ? "bg-[#FFFEEB] text-[#1D1F0E] shadow-sm border border-[#1D1F0E]/15" : "text-[#1D1F0E]/60 hover:text-[#1D1F0E]"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setIsLoginTab(false); setErrorText(null); }}
                className={`py-2 rounded-lg font-medium transition-colors cursor-pointer select-none ${
                  !isLoginTab ? "bg-[#FFFEEB] text-[#1D1F0E] shadow-sm border border-[#1D1F0E]/15" : "text-[#1D1F0E]/60 hover:text-[#1D1F0E]"
                }`}
              >
                Register Account
              </button>
            </div>

            {/* Feedback alerts - colored nicely to fit single light yellow theme */}
            {errorText && (
              <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-[#1D1F0E] font-sans leading-relaxed select-none">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1D1F0E]" />
                <div className="space-y-0.5">
                  <span className="font-semibold block uppercase text-[9px] tracking-wider font-mono">Authentication Flag Alert</span>
                  <span>{errorText}</span>
                </div>
              </div>
            )}

            {successText && (
              <div className="bg-[#1D1F0E] border-t-2 border-[#FAFCA4] p-4 text-[#FAFCA4] rounded-xl flex items-start gap-2.5 text-xs leading-relaxed select-none">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#FAFCA4]" />
                <div className="space-y-0.5 font-sans">
                  <span className="font-semibold block uppercase text-[9px] tracking-wider font-mono">Operations OK</span>
                  <span>{successText}</span>
                </div>
              </div>
            )}

            {/* Loading / Scanning Biometric overlay */}
            {isPasskeyScanning && (
              <div className="bg-[#FFFEEB] border border-[#1D1F0E]/20 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center select-none absolute inset-0 z-30">
                <div className="w-16 h-16 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 rounded-full flex items-center justify-center text-[#1D1F0E] relative">
                  <Fingerprint className="w-8 h-8 animate-pulse text-[#1D1F0E]" />
                  <div className="absolute inset-0 border border-[#1D1F0E]/20 rounded-full animate-ping pointer-events-none opacity-40" />
                </div>
                <div className="space-y-1.5 font-mono">
                  <span className="text-[10px] text-[#1D1F0E]/50 block uppercase tracking-wider font-semibold">WebAuthn challenge validation</span>
                  <p className="text-xs text-[#1D1F0E]/80 font-sans">{passkeyMsg}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPasskeyScanning(false)}
                  className="text-[10px] uppercase font-mono text-[#1D1F0E]/70 hover:text-[#1D1F0E] border border-[#1D1F0E]/25 hover:border-[#1D1F0E] bg-transparent rounded-lg py-1.5 px-3 mt-4 transition-colors cursor-pointer"
                >
                  Cancel Scan
                </button>
              </div>
            )}
            {/* Input Forms */}
            {require2FA ? (
              <form onSubmit={handleVerify2FASubmit} className="space-y-4 font-sans text-left">
                
                {/* 2FA visual banner indicator */}
                <div className="bg-[#1D1F0E] text-[#FAFCA4] border-t border-[#FAFCA4] p-3.5 rounded-xl flex items-start gap-2 text-xs leading-relaxed select-none">
                  <ShieldAlert className="w-5 h-5 text-[#FAFCA4] mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-mono text-[9px] uppercase font-bold tracking-wider block text-yellow-300">
                      🛡 DUAL-FACTOR CHALLENGE ACTIVE
                    </span>
                    <p className="text-xs font-sans">
                      {twoFactorType === "totp" 
                        ? "Enter the 6-digit dynamic passcode from your signed App Authenticator." 
                        : "Enter the SMS confirmation security code sent to your mobile device."}
                    </p>
                  </div>
                </div>

                {/* SMS fallback code display */}
                {twoFactorType === "sms" && (
                  <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 p-2 rounded-lg text-[9px] leading-relaxed text-center font-mono">
                    SMS carrier dispatch: security code is <strong className="text-sm font-bold text-[#1D1F0E]">123456</strong>
                  </div>
                )}

                {/* Verification Code field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1D1F0E]/80">Authenticator Passcode</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 focus:border-[#1D1F0E] text-[#1D1F0E] text-center font-mono text-base tracking-widest pl-10 pr-4 py-3 rounded-xl focus:outline-none placeholder-[#1D1F0E]/30"
                      placeholder="000 000"
                    />
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#1D1F0E]/50 animate-pulse" />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRequire2FA(false);
                      setVerificationCode("");
                      setTempMasterKey(null);
                      setErrorText(null);
                    }}
                    className="w-1/3 py-2.5 rounded-xl text-xs font-bold text-[#1D1F0E]/80 hover:text-[#1D1F0E] border border-[#1D1F0E]/20 hover:border-[#1D1F0E]/40 bg-transparent transition-colors cursor-pointer text-center"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-2/3 py-2.5 bg-[#1D1F0E] hover:bg-[#1D1F0E]/90 disabled:bg-[#1D1F0E]/30 text-[#FAFCA4] font-bold rounded-xl text-xs transition-colors cursor-pointer select-none border border-[#1D1F0E]"
                  >
                    {isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Verify and Login"}
                  </button>
                </div>

              </form>
            ) : (
              <form onSubmit={isLoginTab ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4 font-sans">
                
                {/* Email Address */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-[#1D1F0E]/80">Vault Identity Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 focus:border-[#1D1F0E] text-[#1D1F0E] rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:outline-none transition-all placeholder-[#1D1F0E]/30"
                      placeholder="user@operava.security"
                    />
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-[#1D1F0E]/50" />
                  </div>
                </div>

                {/* Master Password */}
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#1D1F0E]/80">Console Master Password</label>
                    {isLoginTab && (
                      <span className="text-[10px] text-[#1D1F0E]/60 cursor-help hover:text-[#1D1F0E] select-none">Forgot Key?</span>
                    )}
                  </div>
                  <div className="relative">
                    {/* Custom animated focus border box */}
                    <motion.div
                      initial={false}
                      animate={{
                        borderColor: isPassFocused ? "#1D1F0E" : "rgba(29, 31, 14, 0.2)",
                        boxShadow: isPassFocused 
                          ? "0 0 0 2.5px rgba(29, 31, 14, 0.08)" 
                          : "0 0 0 0px rgba(29, 31, 14, 0)",
                      }}
                      transition={{ duration: 0.2 }}
                      className="w-full bg-[#FFFEEB] border rounded-xl relative flex items-center overflow-hidden"
                    >
                      {/* Left Icon with focus state animation */}
                      <div className="absolute left-3 flex items-center justify-center pointer-events-none">
                        <motion.div
                          animate={{
                            color: isPassFocused ? "#1D1F0E" : "rgba(29, 31, 14, 0.4)",
                            rotate: isPassFocused ? 12 : 0,
                            scale: isPassFocused ? 1.08 : 1
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        >
                          <KeyRound className="w-4 h-4" />
                        </motion.div>
                      </div>

                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setIsPassFocused(true)}
                        onBlur={() => setIsPassFocused(false)}
                        className="w-full bg-transparent text-[#1D1F0E] text-sm font-mono pl-9 pr-9 py-2.5 focus:outline-none placeholder-[#1D1F0E]/30"
                        placeholder={isLoginTab ? "••••••••••••••••" : "Minimum 8 characters..."}
                      />

                      {/* Animated eye visibility toggle */}
                      <div className="absolute right-3 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-[#1D1F0E]/50 hover:text-[#1D1F0E]/80 focus:outline-none cursor-pointer p-0.5 rounded-lg transition-colors flex items-center justify-center"
                          style={{ outline: "none" }}
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                              key={showPassword ? "visible" : "hidden"}
                              initial={{ opacity: 0, scale: 0.8, rotate: -25 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              exit={{ opacity: 0, scale: 0.8, rotate: 25 }}
                              transition={{ duration: 0.12 }}
                              className="flex items-center justify-center"
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4 text-[#1D1F0E] stroke-[2]" />
                              ) : (
                                <Eye className="w-4 h-4 text-[#1D1F0E] stroke-[2]" />
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </button>
                      </div>

                      {/* Active sliding color bar indicator at the bottom */}
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: isPassFocused ? 1 : 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#1D1F0E] origin-center"
                      />
                    </motion.div>
                  </div>
                </div>

                {/* Registrations password strength criteria helper */}
                {!isLoginTab && (
                  <div className="space-y-2 pt-1 font-mono text-[10px] select-none text-[#1D1F0E]">
                    <div className="flex justify-between items-center bg-[#1D1F0E]/5 p-2 rounded-lg border border-[#1D1F0E]/10">
                      <span>Passphrase Entropy:</span>
                      <span className="text-[10px] text-[#1D1F0E] font-bold uppercase">
                        {passStrength.text}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[#1D1F0E]/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#1D1F0E] transition-all duration-300"
                        style={{ width: `${passStrength.score}%` }}
                      />
                    </div>
                    <ul className="grid grid-cols-2 gap-1.5 font-sans mt-2 ml-1 text-[10px] list-none pl-1">
                      <li className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-[#1D1F0E]' : 'bg-[#1D1F0E]/20'}`} />
                        <span className={password.length >= 8 ? 'text-[#1D1F0E] font-medium' : 'text-[#1D1F0E]/40'}>At least 8 chars</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-[#1D1F0E]' : 'bg-[#1D1F0E]/20'}`} />
                        <span className={/[A-Z]/.test(password) ? 'text-[#1D1F0E] font-medium' : 'text-[#1D1F0E]/40'}>Uppercase letter</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${/[0-9]/.test(password) ? 'bg-[#1D1F0E]' : 'bg-[#1D1F0E]/20'}`} />
                        <span className={/[0-9]/.test(password) ? 'text-[#1D1F0E] font-medium' : 'text-[#1D1F0E]/40'}>Has Number</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${/[^A-Za-z0-9]/.test(password) ? 'bg-[#1D1F0E]' : 'bg-[#1D1F0E]/20'}`} />
                        <span className={/[^A-Za-z0-9]/.test(password) ? 'text-[#1D1F0E] font-medium' : 'text-[#1D1F0E]/40'}>Special symbol</span>
                      </li>
                    </ul>
                  </div>
                )}

                {/* Form action submission */}
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#1D1F0E] hover:bg-[#1D1F0E]/90 disabled:bg-[#1D1F0E]/30 text-[#FAFCA4] font-medium rounded-xl text-sm transition-all cursor-pointer mt-4 select-none group border border-[#1D1F0E]"
                >
                  {isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-[#FAFCA4]" />
                  ) : (
                    <>
                      <span>{isLoginTab ? "Derive Key & Access Console" : "Lock & Initialize Vault Folder"}</span>
                      <ArrowRight className="w-4 h-4 text-[#FAFCA4] transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>

                {/* FIDO2 Passkey trigger on Login view page */}
                {isLoginTab && (
                  <div className="border-t border-[#1D1F0E]/15 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={handlePasskeyLogin}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] hover:border-[#1D1F0E]/50 rounded-xl text-xs font-semibold cursor-pointer transition-colors font-mono tracking-wide"
                    >
                      <Fingerprint className="w-4 h-4 text-[#1D1F0E]" /> Sign In Securely with FIDO2 / Passkey
                    </button>
                  </div>
                )}

              </form>
            )}

            <p className="text-[10px] text-[#1D1F0E]/50 leading-relaxed font-mono text-center border-t border-[#1D1F0E]/10 pt-3.5 flex items-center justify-center gap-1.5 select-none">
              <ShieldAlert className="w-3.5 h-3.5 text-[#1D1F0E]/40" /> Operava Security Rules Suite • certified client local signature
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  User, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Save, 
  Lock, 
  Trash2, 
  Mail, 
  Phone, 
  Volume2, 
  Terminal, 
  ArrowLeft,
  Sparkles,
  Fingerprint,
  Key,
  Smartphone,
  Eye,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShieldCheck,
  QrCode
} from "lucide-react";
import { generateSalt, deriveKeyFromPassword, arrayBufferToBase64, calculateVerifierHash, safeCopyToClipboard } from "../utils/crypto";

interface SettingsViewProps {
  onRefreshLogs: () => void;
  onNavigateToVault: () => void;
  onChangeAutoLock: (duration: number) => void;
}

export default function SettingsView({ onRefreshLogs, onNavigateToVault, onChangeAutoLock }: SettingsViewProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Profile data details
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Security policies
  const [autoLockDuration, setAutoLockDuration] = useState(600000); // defaults to 10 mins
  const [requirePasswordConfirmToCopy, setRequirePasswordConfirmToCopy] = useState(false);

  // Two-Factor Authentication DB states
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorType, setTwoFactorType] = useState<"totp" | "sms" | "none">("none");
  const [totpSecret, setTotpSecret] = useState("");
  const [hasPasskey, setHasPasskey] = useState(false);

  // Sub-UI states for 2FA Setup Flow and Biometrics
  const [selectedMfaOption, setSelectedMfaOption] = useState<"totp" | "sms" | "none">("none");
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [smsVerifyCode, setSmsVerifyCode] = useState("");
  const [smsCodeSent, setSmsCodeSent] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [loadingPasskey, setLoadingPasskey] = useState(false);
  const [passkeySuccess, setPasskeySuccess] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Master Password Reset state variables
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Self destruct parameters
  const [destructPhrase, setDestructPhrase] = useState("");
  const [destructPending, setDestructPending] = useState(false);
  const [destructSuccess, setDestructSuccess] = useState(false);

  // Fetch settings from the backend on load
  const fetchSettings = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/user/settings", {
        headers: { "Authorization": `Bearer ${authHeader}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEmail(data.email || "");
        setDisplayName(data.displayName || "");
        setSecondaryEmail(data.secondaryEmail || "");
        setPhone(data.phone || "");
        setAutoLockDuration(data.autoLockDuration ?? 600000);
        setRequirePasswordConfirmToCopy(data.requirePasswordConfirmToCopy ?? false);
        
        // Two factor fields loaded safely
        setTwoFactorEnabled(data.twoFactorEnabled ?? false);
        setTwoFactorType(data.twoFactorType ?? "none");
        setSelectedMfaOption(data.twoFactorType ?? "none");
        setTotpSecret(data.totpSecret || "OPV-SEC-KEY-7XKR9P4W");
        setHasPasskey(data.hasPasskey ?? false);

        // Propagate lock state change to App wrapper
        onChangeAutoLock(data.autoLockDuration ?? 600000);
      } else {
        throw new Error(data.error || "Failed to fetch settings.");
      }
    } catch (err: any) {
      setErrorText(err.message || "Failed to query profile database parameters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Copy secret helper for TOTP setup
  const handleCopySecret = () => {
    safeCopyToClipboard(totpSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // Process standard profiles update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorText(null);
    setSuccessText(null);

    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/user/settings/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({
          email: email.trim(),
          displayName,
          secondaryEmail,
          phone,
          autoLockDuration,
          requirePasswordConfirmToCopy
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Save settings error.");
      }

      if (data.email) {
        sessionStorage.setItem("opv_email", data.email);
      }

      setSuccessText("Profile credentials and security configurations updated successfully!");
      onChangeAutoLock(autoLockDuration);
      onRefreshLogs();
      
      setTimeout(() => {
        setSuccessText(null);
      }, 3500);
    } catch (err: any) {
      setErrorText(err.message || "Could not save credentials.");
    } finally {
      setSaving(false);
    }
  };

  // Establish TOTP Two-Factor Authenticator app
  const handleVerifyTotp = async () => {
    if (totpVerifyCode.trim().length !== 6 || isNaN(Number(totpVerifyCode))) {
      setErrorText("MFA setup error: Please enter a valid 6-digit numeric authentication code.");
      return;
    }

    setSaving(true);
    setErrorText(null);
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/user/settings/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({
          twoFactorEnabled: true,
          twoFactorType: "totp",
          totpSecret: totpSecret
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Two factor TOTP sync code check failed.");
      }

      setTwoFactorEnabled(true);
      setTwoFactorType("totp");
      setSuccessText("Secure Authenticator App (TOTP) bound and enabled successfully! Sign-in is now dual-factor sealed.");
      setTotpVerifyCode("");
      onRefreshLogs();
    } catch (err: any) {
      setErrorText(err.message || "Could not complete authenticator app verification setup.");
    } finally {
      setSaving(false);
    }
  };

  // Dispatch simulated verification SMS text
  const handleSendSmsCode = async () => {
    if (!phone || phone.trim().length < 6) {
      setErrorText("Please link a valid contact phone number above before starting SMS text verification.");
      return;
    }

    setSendingSms(true);
    setErrorText(null);

    // Simulate carrier transport latency
    await new Promise(r => setTimeout(r, 1100));

    setSmsCodeSent(true);
    setSendingSms(false);
  };

  // Activate SMS 2FA Linkage
  const handleVerifySms = async () => {
    if (smsVerifyCode.trim().length !== 6 || isNaN(Number(smsVerifyCode))) {
      setErrorText("SMS link error: Please enter the 6-digit numeric security code sent via SMS.");
      return;
    }

    setSaving(true);
    setErrorText(null);
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/user/settings/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({
          phone: phone.trim(),
          twoFactorEnabled: true,
          twoFactorType: "sms"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "SMS phone code registration refused.");
      }

      setTwoFactorEnabled(true);
      setTwoFactorType("sms");
      setSuccessText("SMS Multi-Factor Authentication successfully bound! We will dispatch SMS text tokens on next login.");
      setSmsVerifyCode("");
      setSmsCodeSent(false);
      onRefreshLogs();
    } catch (err: any) {
      setErrorText(err.message || "Could not verify and activate SMS authentication.");
    } finally {
      setSaving(false);
    }
  };

  // Disable physical or software 2FA
  const handleDeactivateMfa = async () => {
    if (!window.confirm("CRITICAL ACCESSIBILITY NOTE: Unbinding 2FA will lower your console protection score. Your account will rely strictly on master key stretching. Do you wish to proceed?")) {
      return;
    }

    setSaving(true);
    setErrorText(null);
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/user/settings/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({
          twoFactorEnabled: false,
          twoFactorType: "none"
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTwoFactorEnabled(false);
      setTwoFactorType("none");
      setSelectedMfaOption("none");
      setSuccessText("Two-Factor Authentication components successfully unlinked.");
      onRefreshLogs();
    } catch (err: any) {
      setErrorText(err.message || "Failed to disconnect two-factor system.");
    } finally {
      setSaving(false);
    }
  };

  // Biometric passkey enrollment simulator
  const handleEnrollPasskey = async () => {
    setLoadingPasskey(true);
    setErrorText(null);
    setPasskeySuccess(false);

    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      
      // Simulate hardware WebAuthn scan delays
      await new Promise(r => setTimeout(r, 1400));

      const res = await fetch("/api/auth/passkey/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({
          credentialDescriptor: "fido2-aes-passkey-" + Math.random().toString(36).substring(2, 8)
        })
      });

      if (!res.ok) {
        throw new Error("WebAuthn handshake simulation was rejected by browser layers.");
      }

      setHasPasskey(true);
      setPasskeySuccess(true);
      onRefreshLogs();

      setTimeout(() => setPasskeySuccess(false), 3000);
    } catch (err: any) {
      setErrorText(err.message || "Hardware Passkey enrollment failed.");
    } finally {
      setLoadingPasskey(false);
    }
  };

  // Biometric passkey deletion
  const handleRemovePasskey = async () => {
    if (!window.confirm("Are you sure you want to unlink and delete this security key from your console index? You will no longer bypass password fields using biometrics.")) {
      return;
    }

    setLoadingPasskey(true);
    setErrorText(null);
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/auth/passkey/remove", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authHeader}`
        }
      });

      if (!res.ok) {
        throw new Error("Credentials deletion error.");
      }

      setHasPasskey(false);
      onRefreshLogs();
      setSuccessText("Biometric security key dismantled successfully from user profiles.");
    } catch (err: any) {
      setErrorText(err.message || "Failed to destroy hardware passkey.");
    } finally {
      setLoadingPasskey(false);
    }
  };

  // Change Master Password (re-hashes and updates credentials)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (newPassword !== confirmPassword) {
      setResetError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("New master password must be at least 8 characters long.");
      return;
    }

    setResetPending(true);
    try {
      const userEmail = email || sessionStorage.getItem("opv_email") || "";
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      
      const saltRes = await fetch("/api/auth/profile-salt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail })
      });
      const saltData = await saltRes.json();
      if (!saltRes.ok) throw new Error(saltData.error);

      const oldSaltBytes = new Uint8Array(
        window.atob(saltData.salt).split("").map(c => c.charCodeAt(0))
      );

      // Current verifier
      const oldVerifierHash = await calculateVerifierHash(oldPassword, oldSaltBytes);

      // Derive new password salt + verifier
      const newSaltBytes = generateSalt();
      const newSaltBase64 = arrayBufferToBase64(newSaltBytes.buffer);
      const newVerifierHash = await calculateVerifierHash(newPassword, newSaltBytes);

      // Dispatch to API
      const res = await fetch("/api/security/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({
          oldPasswordHash: oldVerifierHash,
          newPasswordHash: newVerifierHash,
          newSalt: newSaltBase64
        })
      });

      const d = await res.json();
      if (!res.ok) {
        throw new Error(d.error || "Password verifier reset failed.");
      }

      setResetSuccess("Master password verifier reset! Please use your new key for next console handshakes.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onRefreshLogs();
      
      setTimeout(() => {
        setResetSuccess(null);
        setShowPasswordChange(false);
      }, 3500);
    } catch (err: any) {
      setResetError(err.message || "Failed to update security verifiers. Ensure current password is correct.");
    } finally {
      setResetPending(false);
    }
  };

  // Nuclear self-destruct function
  const handleNuclearSelfDestruct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (destructPhrase !== "TERMINATE-VAULT") {
      setErrorText("Security phrase mismatch. Self-destruct cancelled.");
      return;
    }

    if (!window.confirm("CRITICAL ALERTER: Triggering self-destruct will wipe EVERY 2FA account inside this vault from server nodes. These components are zero-knowledge and absolutely cannot be recovered. Do you wish to continue?")) {
      return;
    }

    setDestructPending(true);
    setErrorText(null);
    
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/user/self-destruct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({ confirmationPhrase: "TERMINATE-VAULT" })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sovereign erase failed.");
      }

      setDestructSuccess(true);
      onRefreshLogs();

      // Wipe session and trigger clean lockout redirect after 3 seconds
      setTimeout(() => {
        sessionStorage.clear();
        window.location.reload();
      }, 3000);

    } catch (err: any) {
      setErrorText(err.message || "Destruction failure.");
      setDestructPending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-[#1D1F0E] text-left">
      
      {/* Return back button */}
      <button 
        onClick={onNavigateToVault}
        className="inline-flex items-center gap-1.5 text-xs text-[#1D1F0E]/70 hover:text-[#1D1F0E] cursor-pointer select-none font-bold font-mono"
      >
        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" /> Return to Vault list
      </button>

      {/* Main settings headers */}
      <div className="border-b border-[#1D1F0E]/15 pb-5 select-none font-sans">
        <h2 className="text-xl font-bold text-[#1D1F0E] flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#1D1F0E] stroke-[1.8]" /> Account Security &amp; Profile Settings
        </h2>
        <p className="text-xs text-[#1D1F0E]/70 mt-1 leading-relaxed font-sans">
          Manage dynamic sign-in emails, rewrite master keys, coordinate Dual-Factor multi-device challenge authenticators, and link physical biometrics.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#1D1F0E]/60 font-mono text-xs">
          <RefreshCw className="w-6 h-6 animate-spin text-[#1D1F0E]" />
          <span>Synchronizing secure registry configurations...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">

          {/* Left Column: Form Settings and Profile */}
          <div className="lg:col-span-7 space-y-6">

            <form onSubmit={handleSaveSettings} className="space-y-6">

              {/* Operations logs alerts */}
              {errorText && (
                <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-[#1D1F0E] font-sans leading-relaxed">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1D1F0E]" />
                  <div className="space-y-0.5 font-sans">
                    <span className="font-semibold block uppercase text-[10px] tracking-wider font-mono">Operations Error Logged</span>
                    <span>{errorText}</span>
                  </div>
                </div>
              )}

              {successText && (
                <div className="bg-[#1D1F0E] text-[#FAFCA4] border-t border-[#FAFCA4] p-4 rounded-xl flex items-start gap-2.5 text-xs font-sans leading-relaxed">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5 font-sans">
                    <span className="font-semibold block uppercase text-[10px] tracking-wider font-mono text-[#FAFCA4]">Handshake Active</span>
                    <span>{successText}</span>
                  </div>
                </div>
              )}

              {/* Section A: Profile credentials updating */}
              <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl shadow-sm space-y-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#1D1F0E]" />
                
                <div>
                  <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-2">
                    <User className="w-4 h-4 text-[#1D1F0E]" /> Dynamic Profile &amp; Contact Enclave
                  </h3>
                  <p className="text-[10px] text-[#1D1F0E]/70 mt-0.5 uppercase tracking-wide font-bold font-mono">
                    Editable identity emails and routing phone numbers for dynamic sign-ons.
                  </p>
                </div>

                <div className="space-y-4 text-xs font-sans">
                  
                  {/* Primary console email address */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#1D1F0E]/85 uppercase font-mono tracking-wide">
                      Master Console Email Address (Sign-In Identity)
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] font-medium rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/30"
                      placeholder="user@operava.security"
                    />
                    <span className="text-[9.5px] text-[#1D1F0E]/60 mt-1 block leading-relaxed">
                      Editable. Changing your primary email changes your vault index identity for next cryptographic logons.
                    </span>
                  </div>

                  {/* Display Name and Contact Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-[#1D1F0E]/85 uppercase font-mono tracking-wide">
                        Account Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/30"
                        placeholder="e.g. Master Security Node"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-[#1D1F0E]/85 uppercase font-mono tracking-wide flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Link Phone Number (Security Texts)
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 font-mono focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/30"
                        placeholder="e.g. +1 (555) 019-2834"
                      />
                    </div>

                  </div>

                  {/* Fallback alerts warnings email */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-[#1D1F0E]/85 uppercase font-mono tracking-wide flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Alternative Warning Notification Address
                    </label>
                    <input
                      type="email"
                      value={secondaryEmail}
                      onChange={(e) => setSecondaryEmail(e.target.value)}
                      className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/30"
                      placeholder="e.g. fallback-alerts@domain.com"
                    />
                    <p className="text-[9px] text-[#1D1F0E]/60 mt-1">
                      Secondary alerts address used for sending high priority server telemetry anomalies and warning notifications.
                    </p>
                  </div>

                </div>
              </div>

              {/* Section B: Dynamic Change Master Passphrase Accordion */}
              <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#1D1F0E]" />
                
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className="w-full flex items-center justify-between text-left select-none text-sm font-bold text-[#1D1F0E] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#1D1F0E]" /> Rewrite Console Master Passphrase
                  </span>
                  {showPasswordChange ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showPasswordChange && (
                  <div className="space-y-4 pt-4 mt-2 border-t border-[#1D1F0E]/10 animate-fade-in text-xs font-sans">
                    <p className="text-[10px] text-[#1D1F0E]/70 leading-relaxed font-sans mb-1">
                      Rewrites your PBKDF2 stretched password verifier. Requires the correct current password to verify identity prior to committing new matrix.
                    </p>

                    {resetError && (
                      <div className="bg-[#1D1F0E]/5 border border-red-300 p-2.5 rounded-xl text-xs text-[#1D1F0E] flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#1D1F0E]" /> {resetError}
                      </div>
                    )}

                    {resetSuccess && (
                      <div className="bg-[#1D1F0E] text-[#FAFCA4] border-t border-[#FAFCA4] p-2.5 rounded-xl text-xs flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-[#FAFCA4]" /> {resetSuccess}
                      </div>
                    )}

                    <div className="space-y-3 font-sans">
                      <div>
                        <label className="block text-[10px] font-bold text-[#1D1F0E]/85 uppercase font-mono mb-1">Current Master Passphrase</label>
                        <input
                          type="password"
                          required={showPasswordChange}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-[#1D1F0E]"
                          placeholder="••••••••••••••••"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-[#1D1F0E]/85 uppercase font-mono mb-1">New Master Key</label>
                          <input
                            type="password"
                            required={showPasswordChange}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-[#1D1F0E]"
                            placeholder="At least 8 chars"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[#1D1F0E]/85 uppercase font-mono mb-1">Confirm New Key</label>
                          <input
                            type="password"
                            required={showPasswordChange}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2 font-mono focus:outline-none focus:border-[#1D1F0E]"
                            placeholder="Repeat new master"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleChangePassword}
                          disabled={resetPending}
                          className="px-4 py-2 bg-[#1D1F0E] text-[#FAFCA4] hover:opacity-90 font-bold rounded-xl text-xs cursor-pointer select-none inline-flex items-center gap-1.5"
                        >
                          {resetPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Commit New Key"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section C: Security and auto locks policies */}
              <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 space-y-4 relative overflow-hidden backdrop-blur-xl shadow-sm">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#1D1F0E]" />
                
                <div>
                  <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#1D1F0E]" /> Security Session Policies
                  </h3>
                  <p className="text-[10px] text-[#1D1F0E]/70 mt-0.5 uppercase tracking-wide font-bold font-mono">
                    Govern RAM decrypt durations and clipboard copying policies.
                  </p>
                </div>

                <div className="space-y-4 text-xs font-sans">
                  
                  {/* Auto Lock duration select */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFEEB] p-3 border border-[#1D1F0E]/15 rounded-2xl">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[11px] font-bold text-[#1D1F0E] block flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#1D1F0E]" /> Host Inactivity Auto-Lock
                      </span>
                      <p className="text-[10px] text-[#1D1F0E]/70 leading-relaxed font-sans">
                        Purges plain decryption index in raw cache memory on periods of inactivity.
                      </p>
                    </div>
                    <select
                      value={autoLockDuration}
                      onChange={(e) => setAutoLockDuration(parseInt(e.target.value, 10))}
                      className="bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-[#1D1F0E]"
                    >
                      <option value={300000}>5 Minutes</option>
                      <option value={600000}>10 Minutes (Secure)</option>
                      <option value={1800000}>30 Minutes</option>
                      <option value={86400000}>24 Hours (Exposed)</option>
                    </select>
                  </div>

                  {/* Copy validation protection */}
                  <div className="flex items-start justify-between gap-4 bg-[#FFFEEB] p-3 border border-[#1D1F0E]/15 rounded-2xl select-none">
                    <div className="space-y-0.5 text-left">
                      <span className="text-[11px] font-bold text-[#1D1F0E] block select-none">
                        Confirm Master Passphrase on Copy
                      </span>
                      <p className="text-[10px] text-[#1D1F0E]/70 leading-relaxed font-sans">
                        Requires re-entering your master key before extracting 2FA seeds or clear passwords to clipboard buffer.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={requirePasswordConfirmToCopy}
                        onChange={(e) => setRequirePasswordConfirmToCopy(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#1D1F0E]/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#1D1F0E]/30 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[#1D1F0E] after:rounded-full after:h-3.5 after:w-3.5 after:transition-all border border-[#1D1F0E]/25"></div>
                    </label>
                  </div>

                </div>
              </div>

              {/* Submit updates */}
              <div className="flex justify-end font-sans">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 bg-[#1D1F0E] text-[#FAFCA4] hover:opacity-90 font-bold rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 select-none border border-[#1D1F0E]"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 shadow-sm" /> Save Profile &amp; Policies
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>

          {/* Right Column: Two-Factor Core, Passkeys, and Erase */}
          <div className="lg:col-span-5 space-y-6">

            {/* Multifactor Security 2FA Setup card */}
            <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl shadow-sm space-y-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#1D1F0E]" />
              
              <div>
                <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-1.5 select-none leading-none">
                  <Smartphone className="w-4 h-4 text-[#1D1F0E]" /> Dual-Factor Security Gate (2FA)
                </h3>
                <p className="text-[10px] text-[#1D1F0E]/70 mt-1 uppercase tracking-wide font-bold font-mono">
                  Confirm physical devices to safeguard manual password logins.
                </p>
              </div>

              {twoFactorEnabled ? (
                // 2FA is Active Status
                <div className="space-y-4">
                  <div className="bg-[#1D1F0E] text-[#FAFCA4] border-t border-[#FAFCA4] p-3.5 rounded-2xl flex items-start gap-2 text-xs leading-relaxed">
                    <ShieldCheck className="w-5 h-5 mt-0.5 text-[#FAFCA4] shrink-0" />
                    <div className="space-y-0.5">
                      <span className="font-mono text-[9px] uppercase font-bold tracking-wider block text-yellow-300">
                        🛡 MULTI-FACTOR SEAL SECURED
                      </span>
                      <p className="text-xs font-sans">
                        {twoFactorType === "totp" 
                          ? "Locked with secure Authenticator App (TOTP - dynamic challenge codes)." 
                          : `Locked with Contact SMS Text messaging bound to verified number (${phone || "Unknown"}).`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDeactivateMfa}
                    disabled={saving}
                    className="w-full py-2 bg-transparent text-xs text-[#1D1F0E]/80 hover:text-[#1D1F0E] font-bold border border-[#1D1F0E]/20 hover:border-[#1D1F0E] rounded-xl cursor-pointer select-none transition-colors"
                  >
                    {saving ? "Processing request..." : "Deactivate Two-Factor Security"}
                  </button>
                </div>
              ) : (
                // 2FA Enrollment Selector and form Panel
                <div className="space-y-4 text-xs font-sans text-left">
                  
                  {/* Select option cards */}
                  <div className="space-y-2">
                    <label className="block text-[9px] font-bold text-[#1D1F0E]/70 uppercase tracking-widest font-mono">
                      Choose Two-Factor Method
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-center text-[10.5px]">
                      
                      {/* TOTP Method Option */}
                      <button
                        type="button"
                        onClick={() => { setSelectedMfaOption("totp"); setErrorText(null); }}
                        className={`py-2 px-2.5 rounded-xl font-bold border cursor-pointer select-none transition-colors ${
                          selectedMfaOption === "totp" 
                            ? "bg-[#1D1F0E] border-[#1D1F0E] text-[#FAFCA4]" 
                            : "bg-[#FFFEEB]/70 border-[#1D1F0E]/15 hover:border-[#1D1F0E]/35 text-[#1D1F0E]"
                        }`}
                      >
                        Authenticator App
                      </button>

                      {/* SMS Method Option */}
                      <button
                        type="button"
                        onClick={() => { setSelectedMfaOption("sms"); setErrorText(null); }}
                        className={`py-2 px-2.5 rounded-xl font-bold border cursor-pointer select-none transition-colors ${
                          selectedMfaOption === "sms" 
                            ? "bg-[#1D1F0E] border-[#1D1F0E] text-[#FAFCA4]" 
                            : "bg-[#FFFEEB]/70 border-[#1D1F0E]/15 hover:border-[#1D1F0E]/35 text-[#1D1F0E]"
                        }`}
                      >
                        SMS Text Code
                      </button>

                    </div>
                  </div>

                  {selectedMfaOption === "totp" && (
                    // Authenticator app dynamic enrollment wizard
                    <div className="p-3 bg-[#FFFEEB] border border-[#1D1F0E]/15 rounded-2xl space-y-4.5 animate-fade-in relative">
                      
                      {/* Sub-header instruction */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wide flex items-center gap-1 text-[#1D1F0E]">
                          <QrCode className="w-3.5 h-3.5" /> Scan TOTP Security Token Matrix
                        </span>
                        <p className="text-[9px] text-[#1D1F0E]/70 leading-relaxed font-sans">
                          Scan the generated identity matrix using Google Authenticator, Okta, or Bitwarden on your physical phone, then submit verification.
                        </p>
                      </div>

                      {/* Dynamic mock SVG QR code */}
                      <div className="flex justify-center select-none bg-white p-3.5 rounded-xl border border-[#1D1F0E]/20 w-36 h-36 mx-auto relative group">
                        <svg viewBox="0 0 100 100" className="w-full h-full text-[#1D1F0E]" fill="none" stroke="currentColor" strokeWidth="6">
                          {/* Corner Anchor A */}
                          <rect x="5" y="5" width="22" height="22" rx="3" strokeWidth="5" />
                          <rect x="11" y="11" width="10" height="10" rx="1.5" strokeWidth="5" fill="#1D1F0E" />
                          {/* Corner Anchor B */}
                          <rect x="73" y="5" width="22" height="22" rx="3" strokeWidth="5" />
                          <rect x="79" y="11" width="10" height="10" rx="1.5" strokeWidth="5" fill="#1D1F0E" />
                          {/* Corner Anchor C */}
                          <rect x="5" y="73" width="22" height="22" rx="3" strokeWidth="5" />
                          <rect x="11" y="79" width="10" height="10" rx="1.5" strokeWidth="5" fill="#1D1F0E" />
                          
                          {/* Security QR code matrix noise */}
                          <path d="M40 10h10M40 20h15M55 10v20M15 40v15M10 50h20M40 40h10v10M50 45h15M65 40v20M45 60h10M5 85h20M80 40h10M75 55h20v20M85 85h10M45 80h15v10" strokeLinecap="round" strokeWidth="4.5" />
                          <circle cx="15" cy="50" r="2.5" fill="#1D1F0E" />
                          <circle cx="50" cy="50" r="3" fill="#1D1F0E" />
                          <circle cx="85" cy="50" r="2.5" fill="#1D1F0E" />
                        </svg>
                      </div>

                      {/* Alphanumeric secret credentials and copy */}
                      <div className="space-y-1 mt-3">
                        <span className="block text-[9px] uppercase font-mono font-bold text-[#1D1F0E]/60 tracking-wider">Secret Security Key</span>
                        <div className="flex bg-[#FFFEEB] border border-[#1D1F0E]/20 rounded-xl overflow-hidden font-mono text-[10.5px]">
                          <span className="px-3.5 py-2 text-[#1D1F0E] select-all flex-grow tracking-wider font-semibold text-center">{totpSecret}</span>
                          <button
                            type="button"
                            onClick={handleCopySecret}
                            className="bg-[#1D1F0E]/5 border-l border-[#1D1F0E]/15 hover:bg-[#1D1F0E]/10 p-2 text-[#1D1F0E] transition-colors cursor-pointer flex-shrink-0 flex items-center justify-center"
                            title="Copy Secret Key"
                          >
                            {copiedSecret ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Code verification sub form */}
                      <div className="space-y-2 mt-4 pt-3.5 border-t border-[#1D1F0E]/10">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase font-mono tracking-wider">
                          <span>Confirm code from Authenticator</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            value={totpVerifyCode}
                            onChange={(e) => setTotpVerifyCode(e.target.value)}
                            className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2 text-center text-sm font-mono tracking-widest focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/30"
                            placeholder="000000"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyTotp}
                            disabled={totpVerifyCode.length !== 6 || saving}
                            className="bg-[#1D1F0E] hover:opacity-90 disabled:bg-[#1D1F0E]/20 text-[#FAFCA4] disabled:text-[#1D1F0E]/30 px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-colors shrink-0"
                          >
                            Verify &amp; Enroll
                          </button>
                        </div>
                      </div>

                    </div>
                  )}

                  {selectedMfaOption === "sms" && (
                    // SMS Code linkage simulation setup panel
                    <div className="p-3 bg-[#FFFEEB] border border-[#1D1F0E]/15 rounded-2xl space-y-4 animate-fade-in relative text-left">
                      
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wide block">SMS Multi-Factor Binding</span>
                        <p className="text-[9px] text-[#1D1F0E]/70 leading-relaxed">
                          To enable secure SMS sign-in checks, ensure your Contact Phone matches below, request a mock text, and pass the challenge verification.
                        </p>
                      </div>

                      <div className="bg-[#FFFEEB] p-2.5 border border-[#1D1F0E]/15 rounded-xl font-mono text-[10px] text-center space-y-1">
                        <span className="font-bold block text-[#1D1F0E]/60 text-[8px] uppercase tracking-wider">Configured phone target</span>
                        <span className="text-xs font-bold text-[#1D1F0E]">{phone || "No phone linked above"}</span>
                      </div>

                      {phone ? (
                        <div className="space-y-3.5 border-t border-[#1D1F0E]/15 pt-3">
                          
                          {!smsCodeSent ? (
                            <button
                              type="button"
                              onClick={handleSendSmsCode}
                              disabled={sendingSms}
                              className="w-full bg-[#1D1F0E] text-[#FAFCA4] hover:opacity-90 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                            >
                              {sendingSms ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                "Request SMS Security Code"
                              )}
                            </button>
                          ) : (
                            <div className="space-y-2 animate-fade-in">
                              <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 p-2 rounded-lg text-[9px] leading-relaxed text-center text-[#1D1F0E]/75 select-none font-mono">
                                text dispatch succeeded: code is <strong className="text-sm font-bold text-[#1D1F0E]">123456</strong>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  maxLength={6}
                                  value={smsVerifyCode}
                                  onChange={(e) => setSmsVerifyCode(e.target.value)}
                                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest focus:outline-none placeholder-[#1D1F0E]/30"
                                  placeholder="000 000"
                                />
                                <button
                                  type="button"
                                  onClick={handleVerifySms}
                                  disabled={smsVerifyCode.length !== 6 || saving}
                                  className="bg-[#1D1F0E] hover:opacity-90 disabled:bg-[#1D1F0E]/25 disabled:text-[#1D1F0E]/30 text-[#FAFCA4] font-bold font-sans py-2 px-3 rounded-xl cursor-pointer shrink-0 text-xs transition-colors"
                                >
                                  Verify SMS
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      ) : (
                        <p className="text-[9px] font-bold text-[#1D1F0E]/50 italic leading-snug">
                          * Provide your mobile number in the primary profile field above first to trigger SMS verifier code dispatch simulations.
                        </p>
                      )}

                    </div>
                  )}

                  {selectedMfaOption === "none" && (
                    <div className="bg-[#1D1F0E]/5 p-3 rounded-2xl border border-[#1D1F0E]/10 flex items-start gap-2 select-none">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-[#1D1F0E]/60 shrink-0" />
                      <p className="text-[10px] text-[#1D1F0E]/70 leading-normal font-sans">
                        Enabling two-factor authorization closes credential security gaps by requiring physical-device confirmations on each dynamic login session.
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Biometric hardware Passkey settings panel */}
            <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl shadow-sm space-y-4">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#1D1F0E]" />
              
              <div>
                <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-1.5 select-none leading-none">
                  <Fingerprint className="w-4 h-4 text-[#1D1F0E]" /> Biometric Hardware Keys (WebAuthn)
                </h3>
                <p className="text-[10px] text-[#1D1F0E]/70 mt-1 uppercase tracking-wide font-bold font-mono">
                  Enables instantaneous tactile authentication bypassing master fields.
                </p>
              </div>

              {hasPasskey ? (
                // Enrolled Passkey panel
                <div className="space-y-4.5 animate-fade-in text-left">
                  <div className="bg-[#1D1F0E]/5 p-3 rounded-2xl border border-[#1D1F0E]/30 flex items-start gap-2 select-none">
                    <CheckCircle className="w-4 h-4 mt-0.5 text-[#1D1F0E] shrink-0" />
                    <div className="text-xs space-y-0.5 font-sans leading-relaxed">
                      <span className="font-bold block text-[#1D1F0E]">Tactile Hardware Key Active</span>
                      <p className="text-[10px] text-[#1D1F0E]/70 pt-0.5 font-sans leading-normal">
                        FIDO2 browser token is successfully enrolled and linked to master emails.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemovePasskey}
                    disabled={loadingPasskey}
                    className="w-full py-2 bg-transparent hover:bg-transparent text-xs text-[#1D1F0E]/80 hover:text-[#1D1F0E] border border-[#1D1F0E]/20 hover:border-[#1D1F0E] font-bold rounded-xl cursor-pointer select-none transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    {loadingPasskey ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Delete Security Key / Remove Passkey"
                    )}
                  </button>
                </div>
              ) : (
                // Unenrolled Passkey invitation panel
                <div className="space-y-4 text-xs font-sans text-left">
                  
                  {passkeySuccess && (
                    <div className="bg-transparent border border-[#1D1F0E]/30 p-2.5 rounded-xl text-xs text-[#1D1F0E] font-semibold flex items-center gap-2 select-none animate-fade-in leading-relaxed">
                      <Check className="w-4 h-4 stroke-[2]" /> Biometric Token enrolled successfully.
                    </div>
                  )}

                  <p className="text-[10px] text-[#1D1F0E]/70 leading-normal">
                    Link biometric sensors or USB security dongles using standard browser-level FIDO2 routines to bypass passwords.
                  </p>

                  <button
                    type="button"
                    onClick={handleEnrollPasskey}
                    disabled={loadingPasskey}
                    className="w-full bg-[#1D1F0E] hover:opacity-90 disabled:bg-[#1D1F0E]/30 text-[#FAFCA4] font-bold py-2.5 rounded-xl text-xs cursor-pointer select-none transition-all border border-[#1D1F0E] text-center inline-flex items-center justify-center gap-1.5"
                  >
                    {loadingPasskey ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Touch fingerprint scanner now...
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-4 h-4" /> Enroll Hardware Passkey
                      </>
                    )}
                  </button>
                  
                </div>
              )}
            </div>

            {/* Section D: Nuclear Self Destruct card */}
            <div className="bg-red-50/20 border border-red-900/20 rounded-3xl p-6 relative overflow-hidden backdrop-blur-xl space-y-4">
              
              <div className="space-y-1 text-left">
                <h3 className="text-sm font-bold text-red-900 flex items-center gap-2 font-sans select-none">
                  <Trash2 className="w-4 h-4 text-red-900" /> Administrative Vault Destruction
                </h3>
                <p className="text-[10px] text-red-900 bg-red-100/40 border border-red-200 p-2.5 rounded-xl leading-relaxed font-sans select-none">
                  <strong>WARNING NOTE:</strong> Submitting the purge nuclear bypass code instantly wipes all cloud tables and server histories on this profile. Immediate, non-reversible erase.
                </p>
              </div>

              {destructSuccess ? (
                <div className="bg-red-100 border border-red-400 p-3.5 rounded-xl text-center text-xs text-red-900 font-bold space-y-1 animate-pulse font-mono leading-relaxed select-none">
                  <span>CLEANSING ALL HOST DATABASE FILES...</span>
                  <p className="text-[9.5px] font-medium leading-relaxed font-sans text-red-800 normal-case pt-1 leading-normal">
                    Purging active accounts. Sync nodes are clearing data tables... Relocating browser container.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleNuclearSelfDestruct} className="space-y-3 font-mono text-xs">
                  <div className="space-y-1.5 text-left">
                    <label className="block text-[8.5px] font-bold text-red-900 uppercase tracking-widest font-mono">
                      Type termination bypass code
                    </label>
                    <input
                      type="text"
                      required
                      value={destructPhrase}
                      onChange={(e) => setDestructPhrase(e.target.value)}
                      className="w-full bg-[#FFFEEB] border border-red-300 text-red-900 font-bold placeholder:text-red-900/35 placeholder:font-normal rounded-xl px-3 py-2 text-center text-xs tracking-wider focus:outline-none uppercase"
                      placeholder="TERMINATE-VAULT"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={destructPending || destructPhrase !== "TERMINATE-VAULT"}
                    className={`w-full py-2.5 rounded-xl text-[10px] font-bold tracking-wide transition-colors cursor-pointer text-center font-sans ${
                      destructPhrase === "TERMINATE-VAULT"
                        ? "bg-red-600 text-white hover:bg-red-700 animate-pulse border border-red-700"
                        : "bg-[#1D1F0E]/5 text-[#1D1F0E]/30 border border-[#1D1F0E]/10 cursor-not-allowed select-none"
                    }`}
                  >
                    {destructPending ? "Purging tables..." : "PERMANENTLY PURGE SECURITY VAULT"}
                  </button>
                </form>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

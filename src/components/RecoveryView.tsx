/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Download, Fingerprint, ShieldAlert, KeyRound, Check, RefreshCw, AlertCircle, Sparkles, Settings, HelpCircle, Key, Cpu } from "lucide-react";
import { generateRandomMnemonic, safeCopyToClipboard } from "../utils/crypto";

interface RecoveryViewProps {
  onRefreshLogs: () => void;
}

export default function RecoveryView({ onRefreshLogs }: RecoveryViewProps) {
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingPasskey, setLoadingPasskey] = useState(false);
  
  // Recovery key generation mock state
  const [mnemonicPhrase, setMnemonicPhrase] = useState<string | null>(null);
  const [mnemonicId, setMnemonicId] = useState("");
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);

  // Status alerts
  const [passkeySuccess, setPasskeySuccess] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Export encrypted JSON vault file from Express backend API
  const handleExportVault = async () => {
    setLoadingExport(true);
    setErrorText(null);
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/recovery/export", {
        headers: { "Authorization": `Bearer ${authHeader}` }
      });
      if (!res.ok) {
        throw new Error("Could not construct recovery export bundle: unauthorized.");
      }
      const data = await res.json();
      
      // Dynamic client download compilation
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `operava_encrypted_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      onRefreshLogs();
    } catch (err: any) {
      setErrorText(err.message || "Failed to trigger JSON export file compilation.");
    } finally {
      setLoadingExport(false);
    }
  };

  // Setup Simulated physical biometric passkey registration
  const handleRegisterPasskey = async () => {
    setLoadingPasskey(true);
    setErrorText(null);
    setPasskeySuccess(false);

    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      
      // Simulate physical WebAuthn enrollment delay
      await new Promise(r => setTimeout(r, 1200));

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
        throw new Error("Local WebAuthn setup rejected by browser environment.");
      }

      setPasskeySuccess(true);
      onRefreshLogs();
    } catch (err: any) {
      setErrorText(err.message || "Passkey registration failed.");
    } finally {
      setLoadingPasskey(false);
    }
  };

  // Generate emergency recovery phrase
  const handleGenerateRecoveryMnemonic = () => {
    const mn = generateRandomMnemonic();
    setMnemonicPhrase(mn.phrase);
    setMnemonicId(mn.keyId);
    setCopiedMnemonic(false);
  };

  const handleCopyMnemonic = () => {
    if (!mnemonicPhrase) return;
    safeCopyToClipboard(mnemonicPhrase);
    setCopiedMnemonic(true);
    setTimeout(() => setCopiedMnemonic(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-[#1D1F0E] text-left">
      
      <div className="border-b border-[#1D1F0E]/15 pb-5 select-none">
        <h2 className="text-xl font-bold text-[#1D1F0E] flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#1D1F0E]" /> Vault Backup &amp; Sync Maintenance
        </h2>
        <p className="text-xs text-[#1D1F0E]/70 mt-1 leading-relaxed font-sans">
          Synchronize data nodes with security headers, export local encryption tables, or bind physical biometric keys.
        </p>
      </div>

      {errorText && (
        <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-[#1D1F0E] font-sans leading-relaxed">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1D1F0E]" />
          <div className="space-y-0.5 font-sans">
            <span className="font-semibold block uppercase text-[10px] tracking-wider font-mono">Operations Error</span>
            <span>{errorText}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Archival backup card */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6.5 space-y-4 flex flex-col justify-between shadow-sm">
          <div className="space-y-2">
            <div className="w-10 h-10 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 rounded-xl flex items-center justify-center text-[#1D1F0E]">
              <Download className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="font-bold text-[#1D1F0E] text-base leading-snug">Export Decrypted Backup (JSON Archive)</h3>
            <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans">
              Download your complete 2FA vault table as an offline JSON configuration. 
              All accounts and annotations remain encrypted with your master key inside the file.
            </p>
          </div>
          <button
            onClick={handleExportVault}
            disabled={loadingExport}
            className="w-full bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all border border-[#1D1F0E] select-none text-center inline-flex items-center justify-center gap-1.5"
          >
            {loadingExport ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#FAFCA4]" />
            ) : (
              "Download Cipher Backup"
            )}
          </button>
        </div>

        {/* Biometrics Setup */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6.5 space-y-4 flex flex-col justify-between shadow-sm">
          <div className="space-y-2">
            <div className="w-10 h-10 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 rounded-xl flex items-center justify-center text-[#1D1F0E]">
              <Fingerprint className="w-5 h-5 stroke-[1.5]" />
            </div>
            <h3 className="font-bold text-[#1D1F0E] text-base leading-snug">Register Hardware Passkey</h3>
            <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans">
              Configure secondary browser biometrics or Google Account security key bonds. 
              Enables local fingerprint/face login credentials, instantly bypassing password fields.
            </p>
          </div>
          
          {passkeySuccess && (
            <div className="bg-transparent border border-[#1D1F0E]/30 p-2.5 rounded-xl text-xs text-[#1D1F0E] font-medium flex items-center gap-2 mb-2 select-none">
              <Check className="w-4 h-4 stroke-[2]" /> Biometric Token enrolled successfully.
            </div>
          )}

          <button
            onClick={handleRegisterPasskey}
            disabled={loadingPasskey}
            className="w-full bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-all border border-[#1D1F0E] select-none text-center inline-flex items-center justify-center gap-1.5"
          >
            {loadingPasskey ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#FAFCA4]" />
            ) : (
              "Bind Hardware Passkey"
            )}
          </button>
        </div>

      </div>

      {/* Emergency mnemonic recovery phrase */}
      <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 text-left space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-2 font-sans select-none tracking-tight">
            <ShieldAlert className="w-4 h-4 text-[#1D1F0E]" /> Administrative Emergency Recovery System
          </h3>
          <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans max-w-2xl select-none">
            Provision an offline 12-word cryptographic recovery phrase. If your master password is lost, you can supply this mnemonic to reconstruct authorization structures. Save securely in a password manager or physical vault.
          </p>
        </div>

        <div className="flex gap-4 items-start flex-col">
          <button
            onClick={handleGenerateRecoveryMnemonic}
            className="bg-[#1D1F0E] text-[#FAFCA4] hover:opacity-90 py-2.5 px-4 rounded-xl text-xs font-bold cursor-pointer select-none flex-shrink-0"
          >
            Derive Sovereign Recovery Key
          </button>

          {mnemonicPhrase && (
            <div className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/15 rounded-2xl p-4.5 space-y-3">
              <div className="flex justify-between items-center select-none border-b border-[#1D1F0E]/10 pb-2">
                <span className="text-[10px] font-mono font-bold text-[#1D1F0E] bg-[#1D1F0E]/5 px-2 py-0.5 rounded border border-[#1D1F0E]/15">
                  {mnemonicId} EMERGENCY SEED
                </span>
                <span className="text-[9px] font-mono font-bold text-[#1D1F0E]/60">AES-256 Key Material</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs text-[#1D1F0E]">
                {mnemonicPhrase.split("-").map((word, index) => (
                  <div key={index} className="bg-[#FFFEEB] p-2 rounded-xl text-center border border-[#1D1F0E]/15">
                    <span className="text-[#1D1F0E]/50 text-[10px] select-none mr-2">{index + 1}.</span>{word}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleCopyMnemonic}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors ${
                    copiedMnemonic 
                      ? "bg-[#1D1F0E] border border-[#1D1F0E] text-[#FAFCA4]" 
                      : "bg-[#FFFEEB] hover:border-[#1D1F0E]/55 border border-[#1D1F0E]/20 text-[#1D1F0E]"
                  }`}
                >
                  {copiedMnemonic ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Copied Securely
                    </>
                  ) : (
                    "Copy Emergency Key"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

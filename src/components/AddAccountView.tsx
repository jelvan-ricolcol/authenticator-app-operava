/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Camera, Clipboard, KeyRound, Check, FileText, ArrowLeft, RefreshCw, AlertCircle, Sparkles, Plus, CheckCircle } from "lucide-react";
import { encryptData } from "../utils/crypto";
import { isValidBase32, parseOtpauthURI } from "../utils/totp";

interface AddAccountViewProps {
  masterKey: CryptoKey | null;
  onRefresh: () => void;
  onNavigateToVault: () => void;
}

export default function AddAccountView({ masterKey, onRefresh, onNavigateToVault }: AddAccountViewProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "camera">("manual");
  
  // Manual States
  const [issuer, setIssuer] = useState("");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");
  const [group, setGroup] = useState("Personal");
  const [notes, setNotes] = useState("");
  const [period, setPeriod] = useState(30);

  // Import URI State
  const [importUri, setImportUri] = useState("");

  // Status logs
  const [isPending, setIsPending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Camera mock scan states
  const [cameraScanning, setCameraScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Ready for scan interface");

  // Validate and submit the credentials to the backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey) {
      setErrorText("The secure cryptographic key is unavailable. Unlock vault.");
      return;
    }
    setErrorText(null);
    setSuccessText(null);

    // Sanitize and validate secret
    const cleanSecret = secret.replace(/[\s-]/g, "").toUpperCase();
    if (!cleanSecret) {
      setErrorText("The Base32 secret key cannot be empty.");
      return;
    }
    if (!isValidBase32(cleanSecret)) {
      setErrorText("The format of the Base32 secret key is invalid. Keys must only contain characters A-Z and digits 2-7.");
      return;
    }

    setIsPending(true);
    try {
      // 1. Structure the raw decrypted metadata and key details
      const rawPayload = {
        label: label.trim() || "OTP Account",
        issuer: issuer.trim() || "Authenticator",
        secret: cleanSecret,
        notes: notes.trim(),
        group: group.trim() || "Personal",
        tags: [],
        favorite: false
      };

      // 2. Encrypt clientside into cipher using AES-256-GCM
      const stringified = JSON.stringify(rawPayload);
      const encrypted = await encryptData(stringified, masterKey);

      // 3. Dispatch encrypted blob to the sync backend API
      const res = await fetch("/api/vault/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("opv_session_id")}`
        },
        body: JSON.stringify({
          encryptedBlob: encrypted.ciphertext,
          iv: encrypted.iv
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit credential to distributed backup nodes.");
      }

      setSuccessText(`Successfully encrypted and synced "${issuer}" to the server database!`);
      
      // Clear forms
      setIssuer("");
      setLabel("");
      setSecret("");
      setNotes("");

      // Refresh list and navigate back
      onRefresh();
      setTimeout(() => {
        onNavigateToVault();
      }, 1500);

    } catch (err: any) {
      setErrorText(err.message || "Cryptographic commit pipeline error.");
    } finally {
      setIsPending(false);
    }
  };

  // Handle parsing a pasted otpauth URI
  const handleImportUriSubmit = () => {
    setErrorText(null);
    if (!importUri) return;
    const parsed = parseOtpauthURI(importUri);
    if (!parsed) {
      setErrorText("Invalid format. URI must match 'otpauth://totp/...' standard specifications.");
      return;
    }

    setIssuer(parsed.issuer);
    setLabel(parsed.label);
    setSecret(parsed.secret);
    setPeriod(parsed.period);
    
    setSuccessText("Parsed standard otpauth URI parameters successfully.");
    setImportUri("");
    setActiveTab("manual");
    setTimeout(() => setSuccessText(null), 3000);
  };

  // Simulate an interactive QR camera camera feed scan!
  const triggerSimulatedScan = async (presetNum: number) => {
    setErrorText(null);
    setCameraScanning(true);
    setScanStatus("Initializing virtual optical feed lens...");

    await new Promise(r => setTimeout(r, 800));
    setScanStatus("Searching focal area for 2FA Matrix block...");
    await new Promise(r => setTimeout(r, 1200));
    setScanStatus("Decoding QR density structures...");
    await new Promise(r => setTimeout(r, 600));

    // Preset configurations to simulate actual 2FA registrations
    const mockURIs = [
      "otpauth://totp/GitHub:jelvan-dev?secret=NBSWY3DPEB3W64TBNQ&issuer=GitHub&period=30",
      "otpauth://totp/Google:coor-access@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=Google&period=30",
      "otpauth://totp/AmazonWebServices:AdminProd?secret=KVKVEV2JK5HECSKT&issuer=AWS&period=30",
      "otpauth://totp/Slack:EngineeringTeam?secret=MZZG63TTNRSXG5A&issuer=Slack&period=30"
    ];

    const targetUri = mockURIs[presetNum % mockURIs.length];
    const parsed = parseOtpauthURI(targetUri);
    if (parsed) {
      setIssuer(parsed.issuer);
      setLabel(parsed.label);
      setSecret(parsed.secret);
      setPeriod(parsed.period);
      setScanStatus("Success! Detected 2FA payload.");
      
      // Simulate optic validation sound or flash
      if (typeof window !== "undefined" && window.navigator) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime); // C6 Note beep!
          gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
          osc.start();
          setTimeout(() => {
            osc.stop();
            audioCtx.close();
          }, 120);
        } catch {
          // Fallback silently if audio context is blocked
        }
      }

      setSuccessText(`Biometric Optical Scanner decoded parameters for ${parsed.issuer}!`);
      setTimeout(() => {
        setCameraScanning(false);
        setActiveTab("manual");
        setSuccessText(null);
      }, 1000);
    } else {
      setErrorText("Simulated scan did not produce parsable material.");
      setCameraScanning(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 text-[#1D1F0E] text-left">
      
      {/* Return button */}
      <button 
        onClick={onNavigateToVault}
        className="inline-flex items-center gap-1.5 text-xs text-[#1D1F0E]/70 hover:text-[#1D1F0E] cursor-pointer select-none font-semibold font-mono"
      >
        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" /> Return to Vault list
      </button>

      <div className="bg-[#FFFEEB]/90 border border-[#1D1F0E]/20 rounded-3xl p-6.5 sm:p-8 shadow-xl relative overflow-hidden backdrop-blur-xl">
        
        {/* Modern decorative visual line */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E]" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1D1F0E]/10 pb-5 mb-5 select-none">
          <div>
            <h2 className="text-xl font-bold text-[#1D1F0E] tracking-tight flex items-center gap-2 font-sans">
              <KeyRound className="w-5 h-5 text-[#1D1F0E]" /> Commit New Account
            </h2>
            <p className="text-xs text-[#1D1F0E]/70 mt-0.5 leading-relaxed font-sans">
              Input Base32 seeds manually or scan optical targets to sync credentials securely.
            </p>
          </div>
        </div>

        {/* Tab configuration switcher */}
        <div className="grid grid-cols-2 bg-[#1D1F0E]/5 p-1 rounded-xl border border-[#1D1F0E]/10 text-xs mb-6 font-sans">
          <button
            onClick={() => setActiveTab("manual")}
            className={`py-2 rounded-lg font-medium cursor-pointer transition-all ${
              activeTab === "manual" ? "bg-[#FFFEEB] text-[#1D1F0E] border border-[#1D1F0E]/15 shadow-sm" : "text-[#1D1F0E]/60 hover:text-[#1D1F0E]"
            }`}
          >
            Manual Seed Profile
          </button>
          <button
            onClick={() => setActiveTab("camera")}
            className={`py-2 rounded-lg font-medium cursor-pointer transition-all ${
              activeTab === "camera" ? "bg-[#FFFEEB] text-[#1D1F0E] border border-[#1D1F0E]/15 shadow-sm" : "text-[#1D1F0E]/60 hover:text-[#1D1F0E]"
            }`}
          >
            Import Standard URI / QR Scan
          </button>
        </div>

        {/* Error / Success logs */}
        {errorText && (
          <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-[#1D1F0E] mb-6 font-sans">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1D1F0E]" />
            <div className="space-y-0.5">
              <span className="font-semibold block uppercase text-[10px] tracking-wider font-mono">Input Verification Error</span>
              <span>{errorText}</span>
            </div>
          </div>
        )}

        {successText && (
          <div className="bg-[#1D1F0E] text-[#FAFCA4] border-t border-[#FAFCA4] p-4 rounded-xl flex items-start gap-2.5 text-xs mb-6 font-sans">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block uppercase text-[10px] tracking-wider font-mono text-[#FAFCA4]">Cryptographic Pipeline Pass</span>
              <span>{successText}</span>
            </div>
          </div>
        )}

        {/* Tab content manually */}
        {activeTab === "manual" && (
          <form onSubmit={handleSubmit} className="space-y-5 font-sans">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Service Issuer */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-[#1D1F0E]/80">Service Issuer</label>
                <input
                  type="text"
                  required
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/35"
                  placeholder="e.g. Google, GitHub, Slack"
                />
              </div>

              {/* Service custom label */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-[#1D1F0E]/80">Account Reference (Email/ID)</label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/35"
                  placeholder="e.g. user@gmail.com"
                />
              </div>
            </div>

            {/* Secret Key Base32 */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#1D1F0E]/80">Secret Key (Base32 format only)</label>
                <span className="text-[9px] font-mono text-[#1D1F0E]/60 uppercase font-bold">Format check: A-Z, 2-7</span>
              </div>
              <input
                type="text"
                required
                value={secret}
                onChange={(e) => setSecret(e.target.value.replace(/[^A-Za-z2-7\s-]/g, ""))}
                className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider focus:outline-none focus:border-[#1D1F0E] placeholder-[#1D1F0E]/35"
                placeholder="e.g. JBSW Y3DP EHPK 3PXP"
              />
            </div>

            {/* Sync folder folder/group selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-[#1D1F0E]/80">Group Folder Tag</label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#1D1F0E] font-medium"
                >
                  <option value="Personal">Personal Folder</option>
                  <option value="Work">Corporate/Work</option>
                  <option value="Financial">Financial Accs</option>
                  <option value="Gaming">Gaming / Social</option>
                </select>
              </div>

              {/* Time period step limit */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-[#1D1F0E]/80">Token Lifespan (Period)</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#1D1F0E] font-mono font-medium"
                >
                  <option value={30}>30 Secs step (Standard)</option>
                  <option value={60}>60 Secs step (Extended)</option>
                </select>
              </div>
            </div>

            {/* Custom Notes */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-[#1D1F0E]/80">Notes / Remarks (encrypted)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#1D1F0E] h-16 resize-none placeholder-[#1D1F0E]/35"
                placeholder="Optional backup details or emergency codes..."
              />
            </div>

            {/* Submit fields */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] font-bold py-3 rounded-xl text-xs cursor-pointer transition-all flex items-center justify-center gap-1 mt-4 select-none border border-[#1D1F0E]"
            >
              {isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.2]" /> Encrypt and Sync Account
                </>
              )}
            </button>

          </form>
        )}

        {/* Tab content IMPORT QR / URI */}
        {activeTab === "camera" && (
          <div className="space-y-6">
            
            {/* Direct code paste */}
            <div className="space-y-2 bg-[#1D1F0E]/5 p-4 border border-[#1D1F0E]/10 rounded-2xl">
              <div>
                <h4 className="font-bold text-[#1D1F0E] text-xs flex items-center gap-1.5 mb-1 select-none uppercase tracking-wide">
                  <Clipboard className="w-3.5 h-3.5 text-[#1D1F0E]" /> Direct Standard URI Paste
                </h4>
                <p className="text-[10px] text-[#1D1F0E]/70 select-none font-sans">
                  Import parameters directly by parsing standard authenticator links.
                </p>
              </div>
              <div className="flex gap-2.5 pt-1.5 font-sans">
                <input
                  type="text"
                  value={importUri}
                  onChange={(e) => setImportUri(e.target.value)}
                  className="flex-1 bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#1D1F0E] font-mono placeholder-[#1D1F0E]/35"
                  placeholder="otpauth://totp/Issuer:Label?secret=..."
                />
                <button
                  onClick={handleImportUriSubmit}
                  className="px-4 py-2 bg-[#1D1F0E] text-[#FAFCA4] rounded-xl text-xs font-bold cursor-pointer select-none"
                >
                  Parse URI
                </button>
              </div>
            </div>

            {/* Optical QR Camera Scanner mock viewport */}
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-[#1D1F0E] text-xs flex items-center gap-1.5 select-none uppercase tracking-wide">
                  <Camera className="w-3.5 h-3.5 text-[#1D1F0E]" /> Virtual QR Scanner Viewport
                </h4>
                <p className="text-[10px] text-[#1D1F0E]/70 mt-0.5 select-none font-sans">
                  Trigger device cameras to simulate actual 2FA optic matrix scan registration responses.
                </p>
              </div>

              {/* Viewport simulation */}
              <div 
                id="camera-viewport" 
                className="h-64 rounded-2xl border border-[#1D1F0E]/15 bg-[#FFFEEB] relative overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none font-mono"
              >
                {cameraScanning ? (
                  <>
                    {/* Animated grid line sliding down */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E] opacity-60 animate-[bounce_3s_infinite]" />
                    
                    {/* Pulsing Visual Guide Target Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {/* Pulsing circular outer targeting ring */}
                      <div className="w-56 h-56 border border-[#1D1F0E]/5 rounded-full flex items-center justify-center animate-pulse duration-1000">
                        {/* Inner dashed ring */}
                        <div className="w-48 h-48 border border-dashed border-[#1D1F0E]/10 rounded-full flex items-center justify-center">
                          {/* Crosshair target indicator */}
                          <div className="w-4 h-4 relative opacity-35">
                            <span className="absolute inset-x-0 top-1/2 h-0.5 bg-[#1D1F0E]" />
                            <span className="absolute inset-y-0 left-1/2 w-0.5 bg-[#1D1F0E]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* QR alignment frame - pulses to highlight the targeted read region */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 border border-dashed border-[#1D1F0E]/30 rounded-lg flex items-center justify-center animate-pulse">
                      <div className="w-36 h-36 border border-[#1D1F0E]/25 rounded relative">
                        {/* Glow indicator on corner brackets */}
                        <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#1D1F0E] shadow-[0_0_8px_rgba(29,31,14,0.3)]" />
                        <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#1D1F0E] shadow-[0_0_8px_rgba(29,31,14,0.3)]" />
                        <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#1D1F0E] shadow-[0_0_8px_rgba(29,31,14,0.3)]" />
                        <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#1D1F0E] shadow-[0_0_8px_rgba(29,31,14,0.3)]" />
                      </div>
                    </div>

                    {/* Alignment Assistant Badge */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-[#1D1F0E] text-[#FAFCA4] text-[8px] font-mono tracking-wider px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
                      <span>ALIGN QR CODE WITHIN TARGET</span>
                    </div>

                    <div className="space-y-1 mt-8 text-[10px] text-[#1D1F0E] z-10 bg-[#FFFEEB] border border-[#1D1F0E]/20 px-3 py-1.5 rounded-lg max-w-[85%]">
                      <span className="text-[#1D1F0E] text-[9px] uppercase font-bold inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-[#1D1F0E] rounded-full animate-ping" /> Optical scanning active
                      </span>
                      <p className="font-sans leading-relaxed text-[#1D1F0E]/90">{scanStatus}</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3.5 max-w-xs flex flex-col items-center text-[#1D1F0E]">
                    <div className="w-11 h-11 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 rounded-xl flex items-center justify-center text-[#1D1F0E]/85">
                      <Camera className="w-5 h-5 stroke-[1.5]" />
                    </div>
                    <div>
                      <p className="text-[11px] text-[#1D1F0E]/70 leading-relaxed font-sans">
                        Request virtual visual sensors to inspect hardware QR codes.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* simulated buttons */}
              {!cameraScanning ? (
                <div className="grid grid-cols-2 gap-3 font-sans">
                  <button
                    onClick={() => triggerSimulatedScan(0)}
                    className="py-2.5 bg-[#FFFEEB]/60 hover:bg-[#FFFEEB] text-[#1D1F0E] border border-[#1D1F0E]/20 rounded-xl text-xs font-bold cursor-pointer text-center flex items-center justify-center gap-1.5 select-none"
                  >
                    Preset: GitHub QR
                  </button>
                  <button
                    onClick={() => triggerSimulatedScan(1)}
                    className="py-2.5 bg-[#FFFEEB]/60 hover:bg-[#FFFEEB] text-[#1D1F0E] border border-[#1D1F0E]/20 rounded-xl text-xs font-bold cursor-pointer text-center flex items-center justify-center gap-1.5 select-none"
                  >
                    Preset: Google QR
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCameraScanning(false)}
                  className="w-full py-2.5 bg-transparent hover:bg-[#1D1F0E]/5 border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl text-xs font-bold cursor-pointer text-center select-none"
                >
                  Cancel Optical Feed
                </button>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

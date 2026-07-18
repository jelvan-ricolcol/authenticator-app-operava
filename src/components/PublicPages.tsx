/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Shield, Lock, Cpu, Cloud, KeyRound, Sparkles, Check, ArrowRight, BookOpen, Terminal, CheckCircle2, ChevronRight, RefreshCw, Layers } from "lucide-react";
import CryptoJS from "crypto-js";

interface PublicPagesProps {
  onStartAuth: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export default function PublicPages({ onStartAuth, currentPage, setCurrentPage }: PublicPagesProps) {
  // States for the interactive Encrypted Sandbox Widget on the landing page
  const [sandboxPlain, setSandboxPlain] = useState("my-super-secret-totp-key-1234");
  const [sandboxPass, setSandboxPass] = useState("CorrectHorseBatteryStaple");
  const [sandboxSalt, setSandboxSalt] = useState("opv-72901-salt");
  const [sandboxStretched, setSandboxStretched] = useState("");
  const [sandboxCipher, setSandboxCipher] = useState("");
  const [sandboxIV, setSandboxIV] = useState("");
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);

  // Run a real client-side PBKDF2 + AES-GCM encryption demonstration on input change!
  useEffect(() => {
    async function runDemo() {
      if (!sandboxPlain || !sandboxPass) return;
      setIsSandboxRunning(true);
      try {
        if (!window.crypto || !window.crypto.subtle) {
          throw new Error("WebCrypto Subtle is not available in this window context.");
        }
        const textEncoder = new TextEncoder();
        const pwBuffer = textEncoder.encode(sandboxPass);
        const saltBuffer = textEncoder.encode(sandboxSalt);
        
        // 1. Import raw material
        const baseKey = await window.crypto.subtle.importKey(
          "raw", pwBuffer, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]
        );
        
        // 2. Derive key
        const key = await window.crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: saltBuffer, iterations: 1000, hash: "SHA-256" },
          baseKey,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt"]
        );

        // Derive bits to display stretched Master Key representation
        const bits = await window.crypto.subtle.deriveBits(
          { name: "PBKDF2", salt: saltBuffer, iterations: 1000, hash: "SHA-256" },
          baseKey,
          256
        );
        const hex = Array.from(new Uint8Array(bits))
          .map(b => b.toString(16).padStart(2, "0"))
          .join("")
          .substring(0, 32) + "... (AES-256 Key)";
        setSandboxStretched(hex);

        // 3. Encrypt data
        const iv = new Uint8Array(12);
        window.crypto.getRandomValues(iv);
        const dataBuffer = textEncoder.encode(sandboxPlain);
        const encrypted = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          dataBuffer
        );

        // Convert base64 representation
        let binary = "";
        const bytes = new Uint8Array(encrypted);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        setSandboxCipher(window.btoa(binary));

        let ivStr = "";
        for (let i = 0; i < iv.byteLength; i++) {
          ivStr += String.fromCharCode(iv[i]);
        }
        setSandboxIV(window.btoa(ivStr));
      } catch (err) {
        console.warn("Secure WebCrypto sandbox demo failed, falling back to pure CryptoJS engine:", err);
        
        try {
          // PBKDF2 with CryptoJS (1000 cycles, SHA256)
          const saltHex = CryptoJS.enc.Utf8.parse(sandboxSalt);
          const derivedWordArray = CryptoJS.PBKDF2(sandboxPass, saltHex, {
            keySize: 256 / 32,
            iterations: 1000,
            hasher: CryptoJS.algo.SHA256
          });
          const derivedHex = CryptoJS.enc.Hex.stringify(derivedWordArray);
          setSandboxStretched(derivedHex.substring(0, 32) + "... (AES-256 Key)");

          // Encrypt with AES (CBC/Pkcs7 in CryptoJS fallback)
          const keyHex = CryptoJS.enc.Hex.parse(derivedHex);
          const iv = new Uint8Array(12);
          for (let i = 0; i < iv.length; i++) {
            iv[i] = Math.floor(Math.random() * 256);
          }
          const ivHex = CryptoJS.enc.Hex.parse(
            Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("")
          );

          const encrypted = CryptoJS.AES.encrypt(sandboxPlain, keyHex, {
            iv: ivHex,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          });

          setSandboxCipher(encrypted.toString());
          
          let ivStr = "";
          for (let i = 0; i < iv.byteLength; i++) {
            ivStr += String.fromCharCode(iv[i]);
          }
          setSandboxIV(window.btoa(ivStr));
        } catch (fallbackError) {
          console.error("CryptoJS fallback demo failed:", fallbackError);
        }
      } finally {
        setIsSandboxRunning(false);
      }
    }
    const timer = setTimeout(() => {
      runDemo();
    }, 300);
    return () => clearTimeout(timer);
  }, [sandboxPlain, sandboxPass, sandboxSalt]);

  const renderLanding = () => (
    <div className="space-y-24 pb-16 text-[#1D1F0E]">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto pt-8 space-y-8 px-4 select-none">
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 rounded-full text-[#1D1F0E] text-xs font-mono font-bold tracking-wide">
          <Layers className="w-3.5 h-3.5 text-[#1D1F0E]" /> MULTI-DEVICE ZERO-KNOWLEDGE PROTOCOL
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#1D1F0E] leading-tight font-sans">
          Decentralized 2FA <br />
          <span className="underline decoration-[#1D1F0E]/30 underline-offset-8">
            TOTP Authenticator Console
          </span>
        </h1>

        <p className="text-[#1D1F0E]/75 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-sans">
          Client-secured multi-device storage built using WebCrypto standard key stretching workflows. 
          Envelope your credentials locally with PBKDF2 &amp; AES-256-GCM configurations prior to edge-worker sync.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-4 font-sans">
          <button
            onClick={onStartAuth}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] font-bold rounded-xl transition-all shadow-md group cursor-pointer"
          >
            Launch Identity Vault <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={() => setCurrentPage("security_spec")}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#FFFEEB]/80 border border-[#1D1F0E]/20 hover:border-[#1D1F0E]/40 text-[#1D1F0E] font-bold rounded-xl transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4 text-[#1D1F0E]" /> View Cryptography Spec
          </button>
        </div>

        {/* Visual Simulated Output Console on Landing */}
        <div className="pt-8 text-left max-w-3xl mx-auto">
          <div className="border border-[#1D1F0E]/15 bg-[#FFFEEB]/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#1D1F0E]/10 pb-2 mb-3">
              <div className="flex items-center gap-1.5 font-sans font-bold text-xs">
                <span className="w-2.5 h-2.5 bg-[#1D1F0E] rounded-full" />
                <span className="w-2.5 h-2.5 bg-[#1D1F0E]/50 rounded-full" />
                <span className="w-2.5 h-2.5 bg-[#1D1F0E]/20 rounded-full" />
                <span className="text-[#1D1F0E]/60 font-mono ml-1.5 text-[10px]">active-channel://operava.sh</span>
              </div>
              <span className="text-[10px] text-[#1D1F0E] font-mono font-bold uppercase bg-[#1D1F0E]/5 px-2 py-0.5 rounded border border-[#1D1F0E]/15">
                SECURE END-TO-END Active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-[#1D1F0E]/80">
              <div className="space-y-1.5 bg-[#FFFEEB]/90 p-3 rounded-xl border border-[#1D1F0E]/10">
                <div className="text-[#1D1F0E]/50">// Vault Memory (Hardware Sandbox)</div>
                <div>MASTER KEY: <span className="font-bold">"CorrectHorse..."</span></div>
                <div>TOTP SECRET: <span className="font-bold">"JBSWY3DPEHPK3P..."</span></div>
                <div>HMAC SHA: <span className="text-[#1D1F0E]/60 text-[10px]">Processing client-side</span></div>
              </div>
              <div className="space-y-1.5 bg-[#FFFEEB]/90 p-3 rounded-xl border border-[#1D1F0E]/10">
                <div className="text-[#1D1F0E]/50">// Transmitted Network Segment</div>
                <div className="overflow-hidden truncate text-[10px] font-bold">
                  CIPHER: "eyJpdiI6IlpXUm1iM0p..."
                </div>
                <div className="text-[10px]">SALT-BYTES: "b3B2LTcyOTAxLX..."</div>
                <div className="text-[#1D1F0E]/50 border-t border-[#1D1F0E]/10 pt-1 mt-1 text-[10px]">
                  Server Key Awareness: <span className="font-bold bg-[#1D1F0E] text-[#FAFCA4] px-1 rounded uppercase tracking-wider text-[9px]">ZERO KNOWLEDGE (0%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4 py-4 font-sans select-none">
        
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-2xl p-6.5 space-y-4 hover:border-[#1D1F0E]/30 transition-colors text-left shadow-sm">
          <div className="w-10 h-10 border border-[#1D1F0E]/15 rounded-xl flex items-center justify-center text-[#1D1F0E] bg-[#FFFEEB]">
            <Lock className="w-5 h-5 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-[#1D1F0E] uppercase tracking-wide font-sans">01. Pure Zero-Knowledge</h3>
          <p className="text-[#1D1F0E]/75 text-xs leading-relaxed">
            Your master credentials never travel down the wire in plaintext form. Stored credentials are symmetrically sealed using local RAM key derivation before syncing.
          </p>
        </div>

        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-2xl p-6.5 space-y-4 hover:border-[#1D1F0E]/30 transition-colors text-left shadow-sm">
          <div className="w-10 h-10 border border-[#1D1F0E]/15 rounded-xl flex items-center justify-center text-[#1D1F0E] bg-[#FFFEEB]">
            <Cpu className="w-5 h-5 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-[#1D1F0E] uppercase tracking-wide font-sans">02. Native WebCrypto</h3>
          <p className="text-[#1D1F0E]/75 text-xs leading-relaxed">
            Harnesses native in-browser cryptographic APIs conforming to military-grade AES-256 standard suites, shielding private tokens from intrusive DOM monitoring.
          </p>
        </div>

        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-2xl p-6.5 space-y-4 hover:border-[#1D1F0E]/30 transition-colors text-left shadow-sm">
          <div className="w-10 h-10 border border-[#1D1F0E]/15 rounded-xl flex items-center justify-center text-[#1D1F0E] bg-[#FFFEEB]">
            <Cloud className="w-5 h-5 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-[#1D1F0E] uppercase tracking-wide font-sans">03. High-Performance Edge</h3>
          <p className="text-[#1D1F0E]/75 text-xs leading-relaxed">
            Orchestrates immediate backups via high-availability distributed tables, achieving robust data redundancy with minimal global synchronization latency.
          </p>
        </div>

      </section>

      {/* Interactive Cryptographic Sandbox Sandbox */}
      <section className="bg-[#FFFEEB]/85 border border-[#1D1F0E]/15 rounded-3xl p-6 sm:p-8 relative overflow-hidden max-w-4xl mx-auto px-6 text-left">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E]" />
        
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#1D1F0E] flex items-center gap-2 font-sans">
                <Shield className="w-5 h-5 text-[#1D1F0E]" /> Hardware-Level Cryptography Sandbox
              </h2>
              <p className="text-[#1D1F0E]/70 text-xs mt-1 leading-relaxed">
                Interactively examine standard PBKDF2 key stretching and AES-GCM encryption algorithms happening inside your local browser.
              </p>
            </div>
            {isSandboxRunning && (
              <span className="text-[10px] text-[#1D1F0E] font-mono font-bold flex items-center gap-1 bg-[#1D1F0E]/5 px-2 py-1 rounded border border-[#1D1F0E]/10 select-none">
                <RefreshCw className="w-3 h-3 animate-spin text-[#1D1F0E]" /> Deriving bits...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Input fields */}
            <div className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#1D1F0E]/70 mb-1.5 font-bold tracking-wider">1. Master TOTP Seed Value</label>
                <input
                  type="text"
                  value={sandboxPlain}
                  onChange={(e) => setSandboxPlain(e.target.value)}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#1D1F0E] transition-all"
                  placeholder="Key seed values"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#1D1F0E]/70 mb-1.5 font-bold tracking-wider">2. Passphrase to Stretch</label>
                <input
                  type="password"
                  value={sandboxPass}
                  onChange={(e) => setSandboxPass(e.target.value)}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#1D1F0E] transition-all"
                  placeholder="Secret password string"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase text-[#1D1F0E]/70 mb-1.5 font-bold tracking-wider">3. Cryptographic Salt string</label>
                <input
                  type="text"
                  value={sandboxSalt}
                  onChange={(e) => setSandboxSalt(e.target.value)}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3.5 py-2.5 font-mono text-xs focus:outline-none focus:border-[#1D1F0E]"
                />
              </div>
            </div>

            {/* Simulated Live Outputs */}
            <div className="bg-[#FFFEEB] border border-[#1D1F0E]/20 rounded-xl p-5 space-y-4 font-mono text-xs text-[#1D1F0E]/90 relative">
              <div className="absolute top-3 right-3 text-[9px] text-[#1D1F0E]/60 font-bold py-0.5 px-1.5 bg-[#1D1F0E]/5 rounded border border-[#1D1F0E]/10 select-none">
                LOCAL WEBCRYPTO
              </div>
              
              <div className="space-y-1 text-left">
                <div className="text-[#1D1F0E]/75 uppercase text-[9px] tracking-wider font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#1D1F0E]" /> Stretched Key Derivative
                </div>
                <p className="bg-[#1D1F0E]/5 p-2 rounded text-xs select-all break-all border border-[#1D1F0E]/10 max-h-12 overflow-y-auto">
                  {sandboxStretched || "Stretching entropy key..."}
                </p>
              </div>

              <div className="space-y-1 text-left">
                <div className="text-[#1D1F0E]/75 uppercase text-[9px] tracking-wider font-bold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#1D1F0E]" /> Encrypted Cipher block (AES-256-GCM)
                </div>
                <div className="bg-[#1D1F0E]/5 p-2.5 rounded border border-[#1D1F0E]/10 space-y-1.5">
                  <div className="break-all max-h-12 overflow-y-auto">
                    <span className="text-[#1D1F0E]/50 text-[10px]">CIPHERTEXT:</span> "{sandboxCipher || "Sync pending..."}"
                  </div>
                  <div className="break-all text-[10px]">
                    <span className="text-[#1D1F0E]/50">IV:</span> "{sandboxIV || "Sync pending..."}"
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[#1D1F0E]/60 leading-relaxed font-sans border-t border-[#1D1F0E]/10 pt-2 text-left italic select-none">
                Notice: Decryption remains mathematically impossible without the master password string, which never transits the secure network socket connection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-3xl mx-auto space-y-8 px-4 text-left">
        <h2 className="text-2xl font-bold text-[#1D1F0E] text-center font-sans tracking-tight">Zero-Knowledge Verification Q&amp;A</h2>
        
        <div className="space-y-4 font-sans">
          
          <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 p-6 rounded-2xl space-y-2 shadow-sm">
            <h4 className="font-bold text-sm text-[#1D1F0E] uppercase tracking-wide font-mono">1. How does Operava secure multi-device parameters?</h4>
            <p className="text-xs text-[#1D1F0E]/75 leading-relaxed">
              We never store your master plain password anywhere. Key-stretching routines execute inside your private device memory blocks to isolate unencrypted tokens completely from malicious third-party scripts.
            </p>
          </div>

          <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 p-6 rounded-2xl space-y-2 shadow-sm">
            <h4 className="font-bold text-sm text-[#1D1F0E] uppercase tracking-wide font-mono">2. Can database administrative nodes access my 2FA secrets?</h4>
            <p className="text-xs text-[#1D1F0E]/75 leading-relaxed">
              No. Because the cryptographic keys crucial for decryption belong strictly to your physical device state, any database operator can only inspect opaque ciphers, preserving absolute privacy control.
            </p>
          </div>

          <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 p-6 rounded-2xl space-y-2 shadow-sm">
            <h4 className="font-bold text-sm text-[#1D1F0E] uppercase tracking-wide font-mono">3. What is the emergency procedure if I forget my master key?</h4>
            <p className="text-xs text-[#1D1F0E]/75 leading-relaxed">
              During initial deployment, Operava builds a personalized 12-word recovery passphrase backup. If core passwords are lost, you can supply this offline recovery list to decrypt the zero-knowledge database.
            </p>
          </div>

        </div>
      </section>
    </div>
  );

  const renderPricing = () => (
    <div className="space-y-16 py-4 max-w-5xl mx-auto px-4 select-none text-[#1D1F0E]">
      <div className="text-center space-y-4">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-[#1D1F0E] tracking-tight">Accessible Pricing</h2>
        <p className="text-[#1D1F0E]/75 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Robust, zero-knowledge sync capabilities for security advocates, engineers, and self-hosted automated servers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 font-sans text-left">
        
        {/* Personal Free Card */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-2xl p-6.5 flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold uppercase tracking-wider font-mono text-[#1D1F0E]">Personal Vault</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#1D1F0E]/50">Standalone Single Device</p>
            </div>
            <div className="text-3xl font-extrabold text-[#1D1F0E]">$0 <span className="text-xs font-normal text-[#1D1F0E]/60">/ lifetime</span></div>
            <p className="text-xs text-[#1D1F0E]/75 leading-relaxed">
              For security advocates desiring local hardware-level 2FA credentials stored safely in active device RAM buffers.
            </p>
            <div className="border-t border-[#1D1F0E]/10 pt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#1D1F0E]/80">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> Unlimited TOTP tokens
              </div>
              <div className="flex items-center gap-2 text-[#1D1F0E]/80">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> Local WebCrypto storage
              </div>
              <div className="flex items-center gap-2 text-[#1D1F0E]/80">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> 12-word emergency recovery seed
              </div>
            </div>
          </div>
          <button onClick={onStartAuth} className="w-full bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer mt-6 select-none">
            Get Started Free
          </button>
        </div>

        {/* Premium multi-sync card */}
        <div className="bg-[#FFFEEB] border-2 border-[#1D1F0E] rounded-3xl p-6.5 relative flex flex-col justify-between shadow-md">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 uppercase text-[9px] tracking-widest text-[#FAFCA4] bg-[#1D1F0E] rounded-full py-0.5 px-3 font-mono font-bold select-none">
            ACTIVE CLOUD SYNC
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold uppercase tracking-wider font-mono text-[#1D1F0E]">Operava Sync</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#1D1F0E]/60">Total cross-device active sync</p>
            </div>
            <div className="text-3xl font-extrabold text-[#1D1F0E]">$2 <span className="text-xs font-normal text-[#1D1F0E]/60">/ month / user</span></div>
            <p className="text-xs text-[#1D1F0E]/80 leading-relaxed">
              Provides encrypted distributed synchronization across individual personal laptops, physical screens, and mobile spaces.
            </p>
            <div className="border-t border-[#1D1F0E]/15 pt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#1D1F0E]/90 font-medium">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> Distributed D1 Edge Sync
              </div>
              <div className="flex items-center gap-2 text-[#1D1F0E]/90 font-medium">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> WebAuthn Passkey integrations
              </div>
              <div className="flex items-center gap-2 text-[#1D1F0E]/90 font-medium">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> Remote encrypted JSON archiving
              </div>
            </div>
          </div>
          <button onClick={onStartAuth} className="w-full bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] text-xs font-bold py-3 rounded-lg transition-colors cursor-pointer mt-6 shadow select-none">
            Choose Cloud Sync
          </button>
        </div>

        {/* Enterprise deploy */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-2xl p-6.5 flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold uppercase tracking-wider font-mono text-[#1D1F0E]">Sovereign Open Source</h3>
              <p className="text-[10px] uppercase font-bold tracking-wider text-[#1D1F0E]/50">Autonomous corporate deployment</p>
            </div>
            <div className="text-3xl font-extrabold text-[#1D1F0E]">Free <span className="text-xs font-normal text-[#1D1F0E]/60">/ MIT Codebase</span></div>
            <p className="text-xs text-[#1D1F0E]/75 leading-relaxed">
              Compile and deploy Operava on your own self-hosted Node.js infrastructure directly using continuous pipelines.
            </p>
            <div className="border-t border-[#1D1F0E]/10 pt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#1D1F0E]/80">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> Sovereign MIT licensed repos
              </div>
              <div className="flex items-center gap-2 text-[#1D1F0E]/80">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> Node.js & Express server support
              </div>
              <div className="flex items-center gap-2 text-[#1D1F0E]/80">
                <Check className="w-3.5 h-3.5 text-[#1D1F0E] flex-shrink-0" /> Complete secure SQL schematics
              </div>
            </div>
          </div>
          <button onClick={() => setCurrentPage("docs")} className="w-full bg-[#FFFEEB] hover:border-[#1D1F0E]/40 text-[#1D1F0E] border border-[#1D1F0E]/20 text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer mt-6 select-none">
            View Deployment Manual
          </button>
        </div>

      </div>
    </div>
  );

  const renderSecuritySpec = () => (
    <div className="max-w-4xl mx-auto space-y-10 py-6 px-4 font-sans text-left text-[#1D1F0E]">
      <div className="space-y-3 border-b border-[#1D1F0E]/15 pb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1D1F0E] flex items-center gap-2 tracking-tight">
          <Shield className="w-6 h-6 text-[#1D1F0E]" /> Operava Architectural Protocol
        </h2>
        <p className="text-[#1D1F0E]/70 text-sm">
          A definitive outline of our decentralised mathematical zero-knowledge procedures.
        </p>
      </div>

      <div className="space-y-8 text-xs sm:text-sm">
        
        <div className="p-6 bg-[#FFFEEB]/85 border border-[#1D1F0E]/10 rounded-2xl space-y-3">
          <h3 className="font-extrabold uppercase tracking-wider font-mono text-[#1D1F0E] text-xs">
            1. Key Derivation Scheme (PBKDF2-HMAC-SHA256)
          </h3>
          <p className="leading-relaxed text-[#1D1F0E]/80">
            Rather than transmitting plain user secrets, we compute cryptographically stretched AES-256 keys locally. The browser executes a key stretch loop set to 50,000 computation cycles, salted with 16 random initialization bytes.
          </p>
          <div className="bg-[#FFFEEB] p-3 border border-[#1D1F0E]/15 rounded-xl text-xs font-mono text-[#1D1F0E]/70 space-y-1">
            <div>const salt = crypto.getRandomValues(new Uint8Array(16));</div>
            <div>const derivedKey = await crypto.subtle.deriveKey(&#123; name: "PBKDF2", salt, iterations, hash: "SHA-256" ... &#125;)</div>
          </div>
        </div>

        <div className="p-6 bg-[#FFFEEB]/85 border border-[#1D1F0E]/10 rounded-2xl space-y-3">
          <h3 className="font-extrabold uppercase tracking-wider font-mono text-[#1D1F0E] text-xs">
            2. Symmetric Seal Envelope (AES-256-GCM)
          </h3>
          <p className="leading-relaxed text-[#1D1F0E]/80">
            Decrypted secret credentials are isolated inside non-exportable RAM objects. Any shared storage units are locked in an AES-GCM envelope using distinct 12-byte initialization vectors to secure absolute cryptographic containment.
          </p>
        </div>

        <div className="p-6 bg-[#FFFEEB]/85 border border-[#1D1F0E]/10 rounded-2xl space-y-3">
          <h3 className="font-extrabold uppercase tracking-wider font-mono text-[#1D1F0E] text-xs">
            3. WebAuthn Passkeys Core Integration
          </h3>
          <p className="leading-relaxed text-[#1D1F0E]/80">
            Supports standardized physical hardware signatures. When triggered, credentials are validated by requesting cryptographically certified signature confirmation directly on device level.
          </p>
        </div>

      </div>
    </div>
  );

  const renderDocs = () => (
    <div className="max-w-4xl mx-auto space-y-10 py-6 px-4 font-mono text-xs text-[#1D1F0E] text-left">
      <div className="space-y-3 border-b border-[#1D1F0E]/15 pb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#1D1F0E] flex items-center gap-2 font-sans tracking-tight">
          <BookOpen className="w-5 h-5 text-[#1D1F0E]" /> Sovereign Edge Deployment
        </h2>
        <p className="text-[#1D1F0E]/60 font-sans text-xs">
          Deploy and run your premium sovereign authenticator vault on private standard Node.js platforms.
        </p>
      </div>

      <div className="space-y-6 bg-[#FFFEEB]/85 border border-[#1D1F0E]/15 rounded-2xl p-6">
        <div className="space-y-2">
          <div className="text-[#1D1F0E] font-bold font-sans text-xs">// CLI deployment guide</div>
          <pre className="bg-[#FFFEEB] p-4 rounded-xl border border-[#1D1F0E]/15 leading-relaxed text-[#1D1F0E]/80 overflow-x-auto text-[11px]">
{`# 1. Clone open source codebase repositories
git clone https://github.com/operava/authenticator-vault.git
cd authenticator-vault

# 2. Configure server environments
npm install
npm run build

# 3. Publish Server worker engines
wrangler publish server.ts`}
          </pre>
        </div>

        <div className="space-y-2 font-sans text-[#1D1F0E]/80 text-xs leading-relaxed">
          <h3 className="font-bold text-[#1D1F0E]">Relational Tables Integration</h3>
          <p>
            The server runs a local JSON database by default, extensible to distributed SQLite instances. Data remains completely encrypted with user-derived keys, securing transactions, backdoors, and credential registries cleanly against exposure.
          </p>
        </div>
      </div>
    </div>
  );

  const renderPrivacyTerms = () => (
    <div className="max-w-3xl mx-auto py-6 px-4 font-sans text-[#1D1F0E] text-left space-y-10 leading-relaxed">
      <div className="space-y-3 border-b border-[#1D1F0E]/15 pb-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1D1F0E] tracking-tight">Privacy, Cryptography &amp; MIT License Rules</h2>
        <p className="text-[#1D1F0E]/60 text-xs">Revised: May 2026. Zero-data collecting protocol guidelines.</p>
      </div>

      <div className="space-y-6 text-xs sm:text-sm">
        
        <div className="space-y-1">
          <h4 className="font-bold uppercase tracking-wider font-mono text-xs text-[#1D1F0E]">1. Zero analytical trackers</h4>
          <p className="text-[#1D1F0E]/75 leading-relaxed">
            Our identity vault is fully self-contained. We do not incorporate analytical tracking tags, marketing scrapers or geographic logs. Your passwords remain fully anonymous.
          </p>
        </div>

        <div className="space-y-1">
          <h4 className="font-bold uppercase tracking-wider font-mono text-xs text-[#1D1F0E]">2. Sovereign Device Mandate</h4>
          <p className="text-[#1D1F0E]/75 leading-relaxed">
            Decryption key authorities are stored exclusively in temporary sandboxed device memory. Because administrative operations are zero-knowledge, data cannot be decoded or exported by any external organization.
          </p>
        </div>

        <div className="space-y-1">
          <h4 className="font-bold uppercase tracking-wider font-mono text-xs text-[#1D1F0E]">3. MIT Standard Licensing</h4>
          <p className="text-[#1D1F0E]/60 italic bg-[#FFFEEB]/85 border border-[#1D1F0E]/10 p-4 rounded-xl">
            "The Software is provided 'as is', without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability..."
          </p>
        </div>

      </div>
    </div>
  );

  return (
    <div className="w-full">
      {/* Dynamic subpage router */}
      {currentPage === "landing" && renderLanding()}
      {currentPage === "pricing" && renderPricing()}
      {currentPage === "security_spec" && renderSecuritySpec()}
      {currentPage === "docs" && renderDocs()}
      {currentPage === "privacy" && renderPrivacyTerms()}
    </div>
  );
}

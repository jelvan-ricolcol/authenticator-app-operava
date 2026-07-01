/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ShieldCheck, Lock, Unlock, Wifi, Cloud, AlertCircle, RefreshCw, XCircle, Moon, Sun, LockKeyhole } from "lucide-react";
import Navigation from "./components/Navigation";
import PublicPages from "./components/PublicPages";
import AuthView from "./components/AuthView";
import VaultView from "./components/VaultView";
import AddAccountView from "./components/AddAccountView";
import SecurityView from "./components/SecurityView";
import RecoveryView from "./components/RecoveryView";
import SettingsView from "./components/SettingsView";
import SecurityLiveBackground from "./components/SecurityLiveBackground";
import { deriveKeyFromPassword, generateSalt } from "./utils/crypto";
import { VaultEntry } from "./types";

export default function App() {
  // Authentication & session variables (kept in short-lived memory)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  
  // Navigation
  const [currentPage, setCurrentPage] = useState<string>("landing");
  const [showAuthGate, setShowAuthGate] = useState(false);

  // Syncing and Vault lists
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Auto-lock & Security parameters
  const [isVaultLocked, setIsVaultLocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockPending, setUnlockPending] = useState(false);
  const [autoLockDuration, setAutoLockDuration] = useState<number>(600000); // default 10 minutes
  const [requirePasswordConfirmToCopy, setRequirePasswordConfirmToCopy] = useState<boolean>(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Load dynamic lock variables on auth or settings refresh
  useEffect(() => {
    if (isAuthenticated) {
      const loadLockSettings = async () => {
        try {
          const sesId = sessionStorage.getItem("opv_session_id") || "";
          if (!sesId) return;
          const res = await fetch("/api/user/settings", {
            headers: { "Authorization": `Bearer ${sesId}` }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.autoLockDuration !== undefined) {
              setAutoLockDuration(data.autoLockDuration);
            }
            if (data.requirePasswordConfirmToCopy !== undefined) {
              setRequirePasswordConfirmToCopy(data.requirePasswordConfirmToCopy);
            }
          }
        } catch (e) {
          console.warn("Could not pre-load dynamic settings:", e);
        }
      };
      loadLockSettings();
    }
  }, [isAuthenticated]);

  // Check sessionStorage for rehydration on mount
  useEffect(() => {
    const sesId = sessionStorage.getItem("opv_session_id");
    const email = sessionStorage.getItem("opv_email");
    if (sesId && email) {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      setCurrentPage("vault");
      
      // Since window crypto key material is not persistent, the vault starts "Locked" (non-extractable)
      // until the user enters their passphrase once more to derive the RAM key.
      setIsVaultLocked(true);
      fetchVaultEntries(sesId);
    }
  }, []);

  // Fetch encrypted vault from backend API
  const fetchVaultEntries = async (sessionId = sessionStorage.getItem("opv_session_id")) => {
    if (!sessionId) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/vault/list", {
        headers: {
          "Authorization": `Bearer ${sessionId}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setVaultEntries(data.entries || []);
      } else {
        throw new Error(data.error || "Sync channels reported non-authorized access.");
      }
    } catch (err: any) {
      setSyncError(err.message || "Failed to download vault entries.");
      showToast(err.message || "Cloud Sync channels disconnected.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Standard toast notification helper
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Trigger login state
  const handleLoginSuccess = (
    sessionId: string,
    user: { id: string; email: string; salt: string; createdAt: string },
    derivedMasterKey: CryptoKey
  ) => {
    sessionStorage.setItem("opv_session_id", sessionId);
    sessionStorage.setItem("opv_email", user.email);
    
    setIsAuthenticated(true);
    setCurrentUserEmail(user.email);
    setMasterKey(derivedMasterKey);
    setIsVaultLocked(false);
    setShowAuthGate(false);
    setCurrentPage("vault");
    
    // Fetch accounts
    fetchVaultEntries(sessionId);
    showToast("Zero-knowledge security session created successfully!", "success");
  };

  // Immediate Lockout triggers - clears active RAM keys instantly
  const handleLockVault = () => {
    setMasterKey(null); // Clear cryptographic key references from heap
    setIsVaultLocked(true);
    showToast("Cryptographic keys cleared from RAM. Vault locked.", "success");
  };

  // Unlock Vault - Derives key inside browser again
  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    setUnlockPending(true);

    try {
      const email = sessionStorage.getItem("opv_email") || "";
      if (!email) throw new Error("No authenticated email detected.");

      // Fetch master salt
      const saltRes = await fetch("/api/auth/profile-salt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const saltData = await saltRes.json();
      if (!saltRes.ok) throw new Error(saltData.error);

      const userSaltBase64 = saltData.salt;
      const userSaltBytes = new Uint8Array(
        window.atob(userSaltBase64).split("").map(c => c.charCodeAt(0))
      );

      // Re-derive key locally
      const recreatedKey = await deriveKeyFromPassword(unlockPassword, userSaltBytes);
      setMasterKey(recreatedKey);
      setIsVaultLocked(false);
      setUnlockPassword("");
      setShowUnlockModal(false);
      showToast("Vault derived and unlocked successfully!", "success");
    } catch (err: any) {
      setUnlockError(err.message || "Failed to derive key. Incorrect master password.");
    } finally {
      setUnlockPending(false);
    }
  };

  // Core logout cleanup
  const handleLogout = async () => {
    try {
      const session = sessionStorage.getItem("opv_session_id");
      if (session) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Authorization": `Bearer ${session}` }
        });
      }
    } catch (err) {
      console.warn("Logout request did not bypass clean API closure.", err);
    }
    
    // Clear storage keys
    sessionStorage.clear();
    setIsAuthenticated(false);
    setCurrentUserEmail(null);
    setMasterKey(null);
    setIsVaultLocked(false);
    setVaultEntries([]);
    setCurrentPage("landing");
    showToast("Session audit trails closed. Secure clean exit completed.", "success");
  };

  // Background activity tracker for automatic auto-lock (dynamic timeout delay)
  useEffect(() => {
    if (!isAuthenticated || isVaultLocked) return;
    let autoLockTimer: any;

    const resetTimer = () => {
      clearTimeout(autoLockTimer);
      autoLockTimer = setTimeout(() => {
        handleLockVault();
      }, autoLockDuration); // dynamic session life
    };

    // Listen events
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(autoLockTimer);
    };
  }, [isAuthenticated, isVaultLocked, autoLockDuration]);

  return (
    <div className="min-h-screen bg-[#FAFCA4] font-sans text-[#1D1F0E] flex flex-col justify-between selection:bg-[#1D1F0E]/10 selection:text-[#1D1F0E] relative overflow-x-hidden">
      
      {/* Security particle constellation live background */}
      {!isAuthenticated && <SecurityLiveBackground />}
      
      {/* Toast Notification HUD */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up select-none font-sans">
          <div className={`p-4 rounded-2xl shadow-2xl border-2 flex items-center gap-3 max-w-sm ${
            toast.type === "success" 
              ? "bg-[#FFFEEB] border-[#1D1F0E] text-[#1D1F0E]" 
              : "bg-[#FFFEEB] border-[#1D1F0E] text-[#1D1F0E]"
          }`}>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-[#1D1F0E]" />
            <div className="text-xs font-semibold text-[#1D1F0E] leading-relaxed text-left font-sans">
              <span className="block font-mono uppercase text-[9px] text-[#1D1F0E]/60 font-bold tracking-wider mb-0.5">SECURITY SYSTEM TRACE</span>
              {toast.message}
            </div>
          </div>
        </div>
      )}

      {/* Unlock Password Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-[#1D1F0E]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFEEB] border-2 border-[#1D1F0E] p-6.5 rounded-3xl w-full max-w-sm text-left space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E]" />
            
            <div className="flex items-center gap-2.5 select-none text-[#1D1F0E] font-bold text-sm">
              <LockKeyhole className="w-5 h-5 text-[#1D1F0E]" />
              Unlock Client Cipher Keystore
            </div>
            
            <p className="text-xs text-[#1D1F0E]/85 leading-relaxed font-sans">
              Enter your master validation passphrase to load local RAM decryptor keys. 
              The system processes this in memory to unlock coordinates.
            </p>

            {unlockError && (
              <div className="p-3 bg-transparent border-t border-b border-[#1D1F0E]/30 text-[#1D1F0E] rounded-xl text-xs flex items-center gap-2 leading-snug">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#1D1F0E]" /> {unlockError}
              </div>
            )}

            <form onSubmit={handleUnlockSubmit} className="space-y-4 font-sans">
              <input
                type="password"
                required
                autoFocus
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] font-mono text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#1D1F0E]"
                placeholder="Enter master password..."
              />
              <div className="flex gap-2 text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-transparent hover:bg-[#1D1F0E]/5 text-[#1D1F0E] border border-[#1D1F0E]/20 font-bold cursor-pointer transition-all select-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlockPending}
                  className="flex-1 py-2.5 rounded-xl bg-[#1D1F0E] text-[#FAFCA4] font-bold cursor-pointer transition-all hover:opacity-90 select-none border border-[#1D1F0E]"
                >
                  {unlockPending ? "Stretching Key..." : "Unlock Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {/* Navigation bar */}
        <Navigation
          isAuthenticated={isAuthenticated}
          currentUserEmail={currentUserEmail}
          isVaultLocked={isVaultLocked}
          isSyncing={isSyncing}
          currentPage={currentPage}
          setCurrentPage={(p) => {
            setCurrentPage(p);
            setShowAuthGate(false);
          }}
          onLockVault={handleLockVault}
          onUnlockVault={() => setShowUnlockModal(true)}
          onLogout={handleLogout}
          onStartAuth={() => setShowAuthGate(true)}
        />

        {/* Content routing pane */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 flex flex-col justify-center items-center w-full relative">
          
          {/* Conditional authentication wall overlay */}
          {showAuthGate ? (
            <div className="w-full max-w-5xl animate-fade-in">
              <div className="text-left mb-4 px-4">
                <button 
                  onClick={() => setShowAuthGate(false)}
                  className="text-[#1D1F0E]/70 hover:text-[#1D1F0E] text-xs inline-flex items-center gap-1.5 cursor-pointer font-bold font-mono select-none transition-colors"
                >
                  ← Return to Front Page
                </button>
              </div>
              <AuthView onLoginSuccess={handleLoginSuccess} />
            </div>
          ) : (
            // Page Routing Engine
            <div className="w-full">
              {!isAuthenticated ? (
                // Public views
                <PublicPages
                  onStartAuth={() => setShowAuthGate(true)}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                />
              ) : (
                // Authenticated dashboard views
                <div className="w-full h-full">
                  {currentPage === "vault" && (
                    <VaultView
                      entries={vaultEntries}
                      masterKey={masterKey}
                      isVaultLocked={isVaultLocked}
                      onRefresh={() => fetchVaultEntries()}
                      onUnlock={() => setShowUnlockModal(true)}
                      onStartCreate={() => setCurrentPage("add_account")}
                      requirePasswordConfirmToCopy={requirePasswordConfirmToCopy}
                      onDeleteEntry={async (id) => {
                        if (!window.confirm("Confirm permanent removal. This 2FA credential cannot be recovered from distributed sync backup nodes.")) return;
                        setIsSyncing(true);
                        try {
                          const res = await fetch("/api/vault/delete", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "Authorization": `Bearer ${sessionStorage.getItem("opv_session_id")}`
                            },
                            body: JSON.stringify({ id })
                          });
                          if (res.ok) {
                            fetchVaultEntries();
                            showToast("Zero-knowledge record deleted from Backup tables.");
                          } else {
                            throw new Error("Could not erase database elements: unauthorized.");
                          }
                        } catch (err: any) {
                          showToast(err.message, "error");
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                      onToggleFavorite={async (id, curFav) => {
                        // Find entry & decrypt content, flip fav, encrypt back
                        setIsSyncing(true);
                        try {
                          const target = vaultEntries.find(v => v.id === id);
                          if (!target || !masterKey) return;
                          
                          const decryptedJSON = await import("./utils/crypto").then(c => c.decryptData(target.encryptedBlob, target.iv, masterKey));
                          const parsed = JSON.parse(decryptedJSON);
                          parsed.favorite = !curFav;

                          const encrypted = await import("./utils/crypto").then(c => c.encryptData(JSON.stringify(parsed), masterKey));
                          
                          const res = await fetch("/api/vault/update", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "Authorization": `Bearer ${sessionStorage.getItem("opv_session_id")}`
                            },
                            body: JSON.stringify({
                              id,
                              encryptedBlob: encrypted.ciphertext,
                              iv: encrypted.iv
                            })
                          });
                          if (res.ok) {
                            fetchVaultEntries();
                            showToast(parsed.favorite ? "Added to secure favorites." : "Removed from favorites.");
                          } else {
                            throw new Error("Synchronization parameters rejected.");
                          }
                        } catch (err: any) {
                          showToast(err.message, "error");
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                    />
                  )}

                  {currentPage === "add_account" && (
                    <AddAccountView
                      masterKey={masterKey}
                      onRefresh={() => fetchVaultEntries()}
                      onNavigateToVault={() => setCurrentPage("vault")}
                    />
                  )}

                  {currentPage === "security_center" && (
                    <SecurityView onRefreshLogs={() => fetchVaultEntries()} />
                  )}

                  {currentPage === "recovery" && (
                    <RecoveryView onRefreshLogs={() => fetchVaultEntries()} />
                  )}

                  {currentPage === "settings" && (
                    <SettingsView 
                      onRefreshLogs={() => fetchVaultEntries()}
                      onNavigateToVault={() => setCurrentPage("vault")}
                      onChangeAutoLock={(duration) => {
                        setAutoLockDuration(duration);
                        // Force dynamic reload of key settings if altered
                        const sesId = sessionStorage.getItem("opv_session_id") || "";
                        if (sesId) {
                          fetch("/api/user/settings", {
                            headers: { "Authorization": `Bearer ${sesId}` }
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data.requirePasswordConfirmToCopy !== undefined) {
                              setRequirePasswordConfirmToCopy(data.requirePasswordConfirmToCopy);
                            }
                          })
                          .catch(err => console.error(err));
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Modern, security-appropriate minimalistic footer */}
      <footer className="border-t border-[#1D1F0E]/15 bg-[#FFFEEB]/55 py-6 text-center select-none font-sans">
        <div className="max-w-7xl mx-auto px-4 text-xs font-mono text-[#1D1F0E] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 font-sans font-bold text-[#1D1F0E]">
            <span className="w-1.5 h-1.5 bg-[#1D1F0E] rounded-full animate-pulse" /> TLS Secure Node Connect
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[#1D1F0E]/70 font-semibold text-[10px]">
            <span onClick={() => { setCurrentPage("landing"); setShowAuthGate(false); }} className="cursor-pointer hover:text-[#1D1F0E] transition-colors">Features</span>
            <span onClick={() => { setCurrentPage("security_spec"); setShowAuthGate(false); }} className="cursor-pointer hover:text-[#1D1F0E] transition-colors">Security Spec</span>
            <span onClick={() => { setCurrentPage("docs"); setShowAuthGate(false); }} className="cursor-pointer hover:text-[#1D1F0E] transition-colors">Cloud Worker Quick-Start</span>
            <span onClick={() => { setCurrentPage("privacy"); setShowAuthGate(false); }} className="cursor-pointer hover:text-[#1D1F0E] transition-colors">Regulatory Privacy Rules</span>
          </div>
          <div className="flex flex-col items-center sm:items-end text-center sm:text-right gap-1.5">
            <p className="text-[10px] text-[#1D1F0E]/70 font-semibold">
              Operava Authenticator v1.7 • Encrypted End-to-End
            </p>
            <p className="text-[9px] text-[#1D1F0E]/50 font-mono">
              Showcase / Portfolio / Client Project Sample • MIT License
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}

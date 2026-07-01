/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Search, Star, Copy, Check, Trash2, Filter, Lock, Eye, EyeOff, Sparkles, Tag, Folder, Plus, ArrowUpRight, ShieldCheck, AlertCircle, RefreshCw, Edit3, FileText } from "lucide-react";
import { decryptData, generatePassword, encryptData, deriveKeyFromPassword, safeCopyToClipboard } from "../utils/crypto";
import { generateTOTP } from "../utils/totp";
import { VaultEntry, DecryptedVaultEntry } from "../types";

interface VaultViewProps {
  entries: VaultEntry[];
  masterKey: CryptoKey | null;
  isVaultLocked: boolean;
  onRefresh: () => void;
  onUnlock: () => void;
  onDeleteEntry: (id: string) => Promise<void>;
  onToggleFavorite: (id: string, currentlyFav: boolean) => Promise<void>;
  onStartCreate: () => void;
  requirePasswordConfirmToCopy?: boolean;
}

export default function VaultView({
  entries,
  masterKey,
  isVaultLocked,
  onRefresh,
  onUnlock,
  onDeleteEntry,
  onToggleFavorite,
  onStartCreate,
  requirePasswordConfirmToCopy = false
}: VaultViewProps) {
  const [decryptedList, setDecryptedList] = useState<DecryptedVaultEntry[]>([]);
  const [loadingDecryption, setLoadingDecryption] = useState(false);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("All");
  const [viewFavoritesOnly, setViewFavoritesOnly] = useState(false);

  // Token cache representation
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(30);

  // Copy success indicator cache
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Password Generator states
  const [genLength, setGenLength] = useState(16);
  const [genSyms, setGenSyms] = useState(true);
  const [generatedPass, setGeneratedPass] = useState("");
  const [copiedGen, setCopiedGen] = useState(false);

  // Edit / Modify states
  const [editingEntry, setEditingEntry] = useState<DecryptedVaultEntry | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingError, setEditingError] = useState<string | null>(null);

  // Long press timer tracking for notes
  const [longPressTimeout, setLongPressTimeout] = useState<any>(null);
  const [selectedNotesItem, setSelectedNotesItem] = useState<DecryptedVaultEntry | null>(null);
  const [pressInterrupted, setPressInterrupted] = useState(false);

  // Decrypt vault entries client-side on mount or key changes
  useEffect(() => {
    async function decryptAll() {
      if (isVaultLocked || !masterKey || entries.length === 0) {
        setDecryptedList([]);
        return;
      }
      setLoadingDecryption(true);
      setDecryptionError(null);
      try {
        const decrypted: DecryptedVaultEntry[] = [];
        for (const entry of entries) {
          try {
            // Decrypt raw ciphertext blob using browser RAM keys
            const rawJSON = await decryptData(entry.encryptedBlob, entry.iv, masterKey);
            const rawData = JSON.parse(rawJSON);

            decrypted.push({
              id: entry.id,
              label: rawData.label || "OTP Account",
              issuer: rawData.issuer || "Authenticator",
              secret: rawData.secret || "",
              notes: rawData.notes || "",
              group: rawData.group || "Personal",
              tags: rawData.tags || [],
              favorite: !!rawData.favorite,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt
            });
          } catch (decryptErr) {
            console.error(`Skip corrupted item ID: ${entry.id}`, decryptErr);
          }
        }
        setDecryptedList(decrypted);
      } catch (err: any) {
        setDecryptionError("Failed to decrypt vault entries. Master key is likely out of alignment.");
      } finally {
        setLoadingDecryption(false);
      }
    }
    decryptAll();
  }, [entries, masterKey, isVaultLocked]);

  // Recalculate 2FA tokens and standard timer countdown targets
  useEffect(() => {
    let active = true;

    async function updateTokens() {
      if (decryptedList.length === 0 || !active) return;
      const now = Math.floor(Date.now() / 1000);
      const rem = 30 - (now % 30);
      setTimeLeft(rem);

      const codes: Record<string, string> = {};
      for (const item of decryptedList) {
        codes[item.id] = await generateTOTP(item.secret, now);
      }
      
      if (active) {
        setTotpCodes(codes);
      }
    }

    updateTokens();
    const interval = setInterval(() => {
      updateTokens();
    }, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [decryptedList]);

  // Long press events helper functions
  const startPress = (item: DecryptedVaultEntry) => {
    setPressInterrupted(false);
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
    }
    const timer = setTimeout(() => {
      setSelectedNotesItem(item);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(60); } catch (e) {}
      }
    }, 550); // 550ms triggers standard long-pressing gesture smoothly
    setLongPressTimeout(timer);
  };

  const endPress = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      setLongPressTimeout(null);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !masterKey) return;
    setIsUpdating(true);
    setEditingError(null);

    // Validate secret key formatting
    const cleanSecret = editingEntry.secret.replace(/[\s-]/g, "").toUpperCase();
    if (!cleanSecret) {
      setEditingError("Secret key (Base32) must be supplied.");
      setIsUpdating(false);
      return;
    }

    try {
      // 1. Package updated details safely
      const rawPayload = {
        label: editingEntry.label.trim() || "OTP Account",
        issuer: editingEntry.issuer.trim() || "Authenticator",
        secret: cleanSecret,
        notes: editingEntry.notes.trim(),
        group: editingEntry.group || "Personal",
        tags: editingEntry.tags || [],
        favorite: !!editingEntry.favorite
      };

      // 2. Encrypt parameters Client-Side
      const stringified = JSON.stringify(rawPayload);
      const encrypted = await encryptData(stringified, masterKey);

      // 3. Sync update ciphertext to SQL database API
      const res = await fetch("/api/vault/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("opv_session_id")}`
        },
        body: JSON.stringify({
          id: editingEntry.id,
          encryptedBlob: encrypted.ciphertext,
          iv: encrypted.iv
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Master Sync nodes rejected the parameters.");
      }

      setEditingEntry(null);
      onRefresh(); // Trigger vault list decryption reload
    } catch (err: any) {
      setEditingError(err.message || "Decryption signature check mismatch during update.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Copy Verification Dialog states
  const [copyVerificationItem, setCopyVerificationItem] = useState<{ id: string; label: string; code: string } | null>(null);
  const [verifyPasswordText, setVerifyPasswordText] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyingCopy, setVerifyingCopy] = useState(false);

  // Handle account copy code flow
  const handleCopyCode = (id: string, code: string, label: string) => {
    if (requirePasswordConfirmToCopy) {
      setCopyVerificationItem({ id, label, code });
      setVerifyPasswordText("");
      setVerifyError(null);
      return;
    }
    const numericCode = code.replace(/\s/g, "");
    safeCopyToClipboard(numericCode);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleVerifyAndCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyVerificationItem || !masterKey) return;
    setVerifyError(null);
    setVerifyingCopy(true);

    try {
      const email = sessionStorage.getItem("opv_email") || "";
      if (!email) throw new Error("No secure session identity found.");

      const saltRes = await fetch("/api/auth/profile-salt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const saltData = await saltRes.json();
      if (!saltRes.ok) throw new Error(saltData.error || "Profile validation offline.");

      const userSaltBase64 = saltData.salt;
      const userSaltBytes = new Uint8Array(
        window.atob(userSaltBase64).split("").map(c => c.charCodeAt(0))
      );

      const testPlaintext = "OPV-CIPHER-CHECK";
      const encryptedCheck = await encryptData(testPlaintext, masterKey);
      
      const tempKey = await deriveKeyFromPassword(verifyPasswordText, userSaltBytes);
      const decryptedCheck = await decryptData(encryptedCheck.ciphertext, encryptedCheck.iv, tempKey);

      if (decryptedCheck === testPlaintext) {
        const numericCode = copyVerificationItem.code.replace(/\s/g, "");
        safeCopyToClipboard(numericCode);
        const id = copyVerificationItem.id;
        
        setCopiedStates(prev => ({ ...prev, [id]: true }));
        setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [id]: false }));
        }, 2000);

        setCopyVerificationItem(null);
        setVerifyPasswordText("");
      } else {
        throw new Error("Incorrect master password verifier.");
      }
    } catch (err: any) {
      setVerifyError(err.message || "Cryptographic check mismatched.");
    } finally {
      setVerifyingCopy(false);
    }
  };

  // Generate dynamic seed password
  const handleGeneratePassword = () => {
    const pw = generatePassword(genLength, genSyms);
    setGeneratedPass(pw);
    setCopiedGen(false);
  };

  const handleCopyGen = () => {
    if (!generatedPass) return;
    safeCopyToClipboard(generatedPass);
    setCopiedGen(true);
    setTimeout(() => setCopiedGen(false), 2000);
  };

  // Filter lists based on widgets selected
  const filteredList = decryptedList.filter(item => {
    const matchesSearch = 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.group && item.group.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGroup = 
      selectedGroup === "All" || 
      item.group === selectedGroup;

    const matchesFav = !viewFavoritesOnly || item.favorite;

    return matchesSearch && matchesGroup && matchesFav;
  });

  // Extract unique group options for filters
  const groupsSet = new Set<string>();
  decryptedList.forEach(item => {
    if (item.group) groupsSet.add(item.group);
  });
  const groupFilters = ["All", ...Array.from(groupsSet)];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-[#1D1F0E]">
      
      {/* Search columns & List of Decrypted items */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 font-sans">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 rounded-xl pl-9.5 pr-4 py-2.5 text-xs text-[#1D1F0E] placeholder-[#1D1F0E]/40 focus:outline-none focus:border-[#1D1F0E]"
              placeholder="Search services, emails, tags..."
            />
            <Search className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-[#1D1F0E]/50" />
          </div>

          <div className="flex gap-2 font-mono text-[10px]">
            {/* Toggle show favorites */}
            <button
              onClick={() => setViewFavoritesOnly(!viewFavoritesOnly)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer font-sans font-semibold transition-all ${
                viewFavoritesOnly 
                  ? "bg-[#1D1F0E] text-[#FAFCA4] border-[#1D1F0E]" 
                  : "bg-[#FFFEEB]/60 border-[#1D1F0E]/20 text-[#1D1F0E] hover:border-[#1D1F0E]/40"
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${viewFavoritesOnly ? "fill-[#FAFCA4] stroke-[#FAFCA4]" : "text-[#1D1F0E]"}`} /> Favorites
            </button>
            
            <button
              onClick={onStartCreate}
              className="px-4 py-1.5 bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] font-bold font-sans rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" /> Add Credential
            </button>
          </div>
        </div>

        {/* Grouping Filters */}
        {decryptedList.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#1D1F0E]/10 select-none">
            <span className="text-[10px] text-[#1D1F0E]/60 font-mono tracking-wider font-bold uppercase mr-1.5 flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-[#1D1F0E]/80" /> FOLDERS:
            </span>
            {groupFilters.map(grp => (
              <button
                key={grp}
                onClick={() => setSelectedGroup(grp)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all ${
                  selectedGroup === grp 
                    ? "bg-[#1D1F0E] text-[#FAFCA4] border border-[#1D1F0E]" 
                    : "bg-[#FFFEEB]/50 text-[#1D1F0E]/70 border border-[#1D1F0E]/15 hover:text-[#1D1F0E] hover:border-[#1D1F0E]/30"
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        )}

        {/* Locked Vault Cover layout */}
        {isVaultLocked && (
          <div className="bg-[#FFFEEB]/90 border border-[#1D1F0E]/20 p-12 text-center rounded-3xl select-none flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15 text-[#1D1F0E] rounded-full flex items-center justify-center">
              <Lock className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h3 className="text-[#1D1F0E] font-bold text-lg">Identity Vault Closed</h3>
              <p className="text-xs text-[#1D1F0E]/75 leading-relaxed font-sans">
                Local memory decryption matrices are currently suspended. Supply master confirmation to access security credentials.
              </p>
            </div>
            <button
              onClick={onUnlock}
              className="bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer transition-all border border-[#1D1F0E]"
            >
              Unlock Terminal
            </button>
          </div>
        )}

        {/* Loading Decryption Placeholder */}
        {loadingDecryption && (
          <div className="space-y-4 select-none pr-2">
            {[1, 2].map(n => (
              <div key={n} className="bg-[#FFFEEB]/65 p-5 rounded-2xl border border-[#1D1F0E]/15 space-y-2 animate-pulse">
                <div className="flex justify-between">
                  <div className="w-24 h-4 bg-[#1D1F0E]/10 rounded" />
                  <div className="w-8 h-8 rounded-full bg-[#1D1F0E]/10" />
                </div>
                <div className="w-full h-8 bg-[#1D1F0E]/10 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Decryption Errors */}
        {decryptionError && (
          <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-[#1D1F0E] leading-relaxed">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1D1F0E]" />
            <div className="space-y-0.5 font-sans">
              <span className="font-semibold block uppercase text-[10px] tracking-wider font-mono">Decryption Integrity Mismatch</span>
              <span>{decryptionError}</span>
            </div>
          </div>
        )}

        {/* Empty States */}
        {!isVaultLocked && !loadingDecryption && filteredList.length === 0 && (
          <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 border-dashed p-16 rounded-3xl text-center flex flex-col items-center justify-center space-y-4 select-none">
            <div className="w-12 h-12 bg-[#FFFEEB] flex items-center justify-center rounded-xl text-[#1D1F0E]/75 border border-[#1D1F0E]/15">
              <Folder className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div className="space-y-1.5 max-w-sm font-sans text-left sm:text-center">
              <h3 className="text-[#1D1F0E] font-bold text-sm">No Credentials Discovered</h3>
              <p className="text-xs text-[#1D1F0E]/70 leading-relaxed">
                {searchQuery 
                  ? "We couldn't locate any accounts matching that query string." 
                  : "Begin generating encryption records by clicking 'Add Credential' to write zero-knowledge accounts."}
              </p>
            </div>
            {searchQuery ? (
              <button onClick={() => setSearchQuery("")} className="text-xs text-[#1D1F0E] font-mono font-bold hover:underline select-none">
                Clear Filters
              </button>
            ) : (
              <button onClick={onStartCreate} className="px-4 py-2 bg-[#1D1F0E] text-[#FAFCA4] rounded-xl text-xs font-bold cursor-pointer">
                Create 2FA Key
              </button>
            )}
          </div>
        )}

        {/* Account Lists */}
        {!isVaultLocked && !loadingDecryption && filteredList.length > 0 && (
          <div className="space-y-4">
            {filteredList.map(item => {
              const code = totpCodes[item.id] || "000000";
              const isCopied = copiedStates[item.id] || false;
              const formattedCode = code.substring(0, 3) + " " + code.substring(3);
              const fallbackLetter = item.issuer ? item.issuer.substring(0, 2).toUpperCase() : "OP";

              return (
                <div 
                  key={item.id}
                  onMouseDown={() => startPress(item)}
                  onMouseUp={endPress}
                  onMouseLeave={endPress}
                  onTouchStart={() => startPress(item)}
                  onTouchEnd={endPress}
                  onTouchCancel={endPress}
                  onTouchMove={endPress}
                  className="bg-[#FFFEEB]/85 hover:bg-[#FFFEEB] border border-[#1D1F0E]/15 rounded-2xl p-5 hover:border-[#1D1F0E]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-sm text-[#1D1F0E] select-none cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-center gap-4 min-w-0 max-w-full sm:max-w-[55%]">
                    {/* Issuer graphical block */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#1D1F0E] border border-[#1D1F0E] flex-shrink-0 select-none">
                      <span className="font-mono text-xs font-extrabold text-[#FAFCA4]">
                        {fallbackLetter}
                      </span>
                    </div>

                    {/* Account labels */}
                    <div className="min-w-0 flex flex-col text-left">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-sm text-[#1D1F0E] truncate">{item.issuer}</span>
                        {item.favorite && (
                          <Star className="w-3.5 h-3.5 text-[#1D1F0E] fill-[#1D1F0E]" />
                        )}
                        {item.group && (
                          <span className="text-[9px] font-mono border border-[#1D1F0E]/20 bg-[#1D1F0E]/5 text-[#1D1F0E] px-1 py-0.5 rounded font-bold uppercase tracking-wide">
                            {item.group}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#1D1F0E]/75 truncate">{item.label}</span>
                      {item.notes ? (
                        <div className="flex items-center gap-1 mt-1 text-[#1D1F0E]/60">
                          <FileText className="w-3 h-3 text-[#1D1F0E]/50 animate-pulse" />
                          <span className="text-[10px] italic truncate max-w-[200px]" title="Hold card to inspect secure notes">
                            Hold card to inspect secure notes
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-[#1D1F0E]/40 italic mt-0.5">No supplementary notes</span>
                      )}
                    </div>
                  </div>

                  {/* Rotating code, timer countdown & copying */}
                  <div 
                    className="flex items-center justify-between sm:justify-end gap-4 border-t border-[#1D1F0E]/5 sm:border-0 pt-3 sm:pt-0"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    
                    {/* Dynamic OTP Value */}
                    <div className="flex flex-col text-left select-all font-mono">
                      <span className="text-2xl sm:text-3xl font-black text-[#1D1F0E] tracking-wider">
                        {formattedCode}
                      </span>
                    </div>

                    {/* Dynamic Countdown Dial SVG */}
                    <div className="relative w-8 h-8 flex-shrink-0 select-none">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="16"
                          cy="16"
                          r="13"
                          className="stroke-[#1D1F0E]/10 stroke-[2] fill-transparent"
                        />
                        <circle
                          cx="16"
                          cy="16"
                          r="13"
                          className="stroke-[2.5] fill-transparent transition-all duration-1000 stroke-[#1D1F0E]"
                          strokeDasharray={2 * Math.PI * 13}
                          strokeDashoffset={2 * Math.PI * 13 * (1 - timeLeft / 30)}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-[#1D1F0E]">
                        {timeLeft}
                      </span>
                    </div>

                    {/* Fast copy & delete tools */}
                    <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyCode(item.id, code, item.label);
                        }}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isCopied 
                            ? "text-[#FAFCA4] border-[#1D1F0E] bg-[#1D1F0E]" 
                            : "text-[#1D1F0E] border-[#1D1F0E]/20 hover:border-[#1D1F0E] bg-[#FFFEEB]"
                        }`}
                        title="Copy authorization token"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEntry({ ...item });
                          setEditingError(null);
                        }}
                        className="p-2 rounded-lg border border-[#1D1F0E]/20 text-[#1D1F0E]/60 hover:text-[#1D1F0E] hover:border-[#1D1F0E] bg-[#FFFEEB] hover:bg-[#FFFEEB]/55 transition-colors cursor-pointer"
                        title="Edit and modify key parameters"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEntry(item.id);
                        }}
                        className="p-2 rounded-lg border border-[#1D1F0E]/20 text-[#1D1F0E]/60 hover:text-[#1D1F0E] hover:border-[#1D1F0E] bg-[#FFFEEB] hover:bg-[#FFFEEB]/55 transition-colors cursor-pointer"
                        title="Delete key permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Sidebar Utilities: Password Generator & Security Checklist */}
      <div className="space-y-6">
        
        {/* Secure Password Generator Tool */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 text-left space-y-4 shadow-sm">
          <div className="flex items-center gap-2 select-none">
            <Sparkles className="w-4 h-4 text-[#1D1F0E]" />
            <h3 className="font-bold text-[#1D1F0E] text-sm">Secure Password Generator</h3>
          </div>
          <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans">
            Instantly create cryptographically solid system credentials completely offline in hardware RAM.
          </p>

          <div className="space-y-3.5 font-sans">
            <div>
              <div className="flex justify-between text-[11px] font-mono font-bold text-[#1D1F0E] mb-1">
                <span>Passphrase length:</span>
                <span>{genLength} chars</span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                value={genLength}
                onChange={(e) => setGenLength(parseInt(e.target.value, 10))}
                className="w-full accent-[#1D1F0E] cursor-ew-resize bg-[#1D1F0E]/15 py-1 rounded"
              />
            </div>

            <div className="flex items-center justify-between bg-[#FFFEEB] p-2.5 rounded-xl border border-[#1D1F0E]/15 leading-none select-none">
              <span className="text-[11px] font-mono font-bold text-[#1D1F0E]/70">Include Special Symbols</span>
              <input
                type="checkbox"
                checked={genSyms}
                onChange={(e) => setGenSyms(e.target.checked)}
                className="accent-[#1D1F0E] w-4 h-4 cursor-pointer"
              />
            </div>

            <button
              onClick={handleGeneratePassword}
              className="w-full bg-[#1D1F0E] text-[#FAFCA4] text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors border border-[#1D1F0E] select-none"
            >
              Generate Password
            </button>

            {generatedPass && (
              <div className="bg-[#FFFEEB] border border-[#1D1F0E]/20 rounded-xl p-3 flex items-center justify-between gap-1.5 mt-2.5">
                <span className="font-mono text-xs text-[#1D1F0E] break-all select-all font-bold max-w-[80%]">
                  {generatedPass}
                </span>
                <button
                  onClick={handleCopyGen}
                  className={`p-1.5 rounded-lg flex-shrink-0 cursor-pointer ${
                    copiedGen ? "text-[#FAFCA4] bg-[#1D1F0E]" : "text-[#1D1F0E]/60 hover:text-[#1D1F0E]"
                  }`}
                >
                  {copiedGen ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Zero-knowledge status scorecard */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 text-left space-y-4 select-none font-sans shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1D1F0E]" />
            <h3 className="font-bold text-[#1D1F0E] text-sm font-sans">Security Health Matrix</h3>
          </div>
          <div className="space-y-3 text-xs leading-relaxed text-[#1D1F0E]/85">
            <div className="flex justify-between items-center pb-2 border-b border-[#1D1F0E]/10 text-[11px] font-mono font-bold">
              <span>Sync Channel state:</span>
              <span className="text-[#1D1F0E] font-bold bg-[#1D1F0E]/5 border border-[#1D1F0E]/20 py-0.5 px-2 rounded">SOVEREIGN SEALED</span>
            </div>
            
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px]">
                <span>RAM Cache Decrypted:</span>
                <span className="font-mono font-bold">{decryptedList.length} Accounts Active</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Cryptographic API:</span>
                <span>WebCrypto Subtle v2</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>AES cipher standard:</span>
                <span>GCM 128-bit authentication</span>
              </div>
            </div>
            
            <p className="text-[10px] text-[#1D1F0E]/60 italic mt-3 bg-[#FFFEEB] p-2.5 rounded-xl border border-[#1D1F0E]/15 font-mono leading-relaxed">
              Alert: Decryption keys reside exclusively in sandboxed DOM RAM buffers. Signing out or closing this tab instantly wipes memory buffers.
            </p>
          </div>
        </div>

      </div>

      {/* Security Copy Authorization modal */}
      {copyVerificationItem && (
        <div className="fixed inset-0 z-50 bg-[#1D1F0E]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFEEB] border-2 border-[#1D1F0E] p-6.5 rounded-3xl w-full max-w-sm text-left space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E]" />
            
            <div className="flex items-center gap-2 select-none text-[#1D1F0E] font-bold text-sm">
              <Lock className="w-5 h-5 text-[#1D1F0E]" />
              Authorize Clipboard Clearance
            </div>
            
            <div className="text-xs text-[#1D1F0E]/80 space-y-1 font-sans">
              <p className="leading-relaxed font-sans">
                A security policy is enforced. Provide master credentials to confirm clipboard access for target:
              </p>
              <p className="font-mono text-[10px] text-[#FAFCA4] bg-[#1D1F0E] py-1 px-2 rounded mt-1 border border-[#1D1F0E] truncate select-none font-bold">
                {copyVerificationItem.label}
              </p>
            </div>

            {verifyError && (
              <div className="p-2.5 bg-[#1D1F0E]/5 border border-[#1D1F0E]/30 text-[#1D1F0E] rounded-xl text-xs flex items-center gap-1.5 font-sans leading-relaxed">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#1D1F0E]" /> {verifyError}
              </div>
            )}

            <form onSubmit={handleVerifyAndCopy} className="space-y-4.5 font-sans">
              <input
                type="password"
                required
                autoFocus
                value={verifyPasswordText}
                onChange={(e) => setVerifyPasswordText(e.target.value)}
                className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] font-mono text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#1D1F0E]"
                placeholder="Confirm Master Password..."
              />
              <div className="flex gap-2 text-xs pt-1 font-sans">
                <button
                  type="button"
                  onClick={() => setCopyVerificationItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-transparent hover:bg-[#1D1F0E]/5 text-[#1D1F0E] cursor-pointer select-none border border-[#1D1F0E]/20 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingCopy}
                  className="flex-1 py-2.5 rounded-xl bg-[#1D1F0E] text-[#FAFCA4] font-bold cursor-pointer hover:opacity-90 transition-all flex items-center justify-center gap-1 shrink-0 select-none"
                >
                  {verifyingCopy ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Confirm Sync"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Long Pressed Notes details view modal */}
      {selectedNotesItem && (
        <div className="fixed inset-0 z-50 bg-[#1D1F0E]/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFEEB] border-2 border-[#1D1F0E] p-6 rounded-3xl w-full max-w-md text-left space-y-4 shadow-2xl relative overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E]" />
            
            <div className="flex items-center justify-between border-b border-[#1D1F0E]/10 pb-3">
              <div className="flex items-center gap-2 text-[#1D1F0E] font-bold text-sm">
                <FileText className="w-5 h-5 text-[#1D1F0E]" />
                <span>Secure Note Decrypted</span>
              </div>
              <button 
                onClick={() => setSelectedNotesItem(null)}
                className="text-xs font-mono font-bold bg-[#1D1F0E]/10 hover:bg-[#1D1F0E]/20 text-[#1D1F0E] px-2 py-1 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <div className="space-y-3 mt-1.5 font-sans">
              <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/10 rounded-xl p-3">
                <div className="text-[10px] font-mono font-bold text-[#1D1F0E]/60 uppercase">Service Provider</div>
                <div className="text-sm font-bold text-[#1D1F0E]">{selectedNotesItem.issuer}</div>
              </div>

              <div className="bg-[#1D1F0E]/5 border border-[#1D1F0E]/10 rounded-xl p-3">
                <div className="text-[10px] font-mono font-bold text-[#1D1F0E]/60 uppercase">User Identification</div>
                <div className="text-xs text-[#1D1F0E] break-all font-semibold">{selectedNotesItem.label}</div>
              </div>

              <div>
                <div className="text-[10px] font-mono font-bold text-[#1D1F0E]/60 uppercase mb-1">Encrypted Supplementary Note Content</div>
                <div className="bg-[#1D1F0E] text-[#FAFCA4] font-mono text-xs p-4 rounded-xl border border-[#1D1F0E] whitespace-pre-wrap leading-relaxed shadow-sm min-h-[90px] select-text">
                  {selectedNotesItem.notes || "No secret note content was assigned."}
                </div>
              </div>
            </div>

            <div className="flex gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  safeCopyToClipboard(selectedNotesItem.notes || "");
                  try {
                    alert("Decrypted notes copied to system clipboard!");
                  } catch (e) {
                    console.info("Clipboard copy alert bypassed.");
                  }
                }}
                disabled={!selectedNotesItem.notes}
                className="flex-1 py-2.5 rounded-xl bg-[#1D1F0E] text-[#FAFCA4] font-bold cursor-pointer hover:opacity-90 transition-all flex items-center justify-center gap-1 select-none disabled:opacity-50"
              >
                Copy Notes Text
              </button>
              <button
                type="button"
                onClick={() => setSelectedNotesItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-transparent hover:bg-[#1D1F0E]/5 text-[#1D1F0E] border border-[#1D1F0E]/20 font-bold text-center cursor-pointer select-none"
              >
                Dismiss Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account credentials parameters editor/modification modal */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-[#1D1F0E]/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFEEB] border-2 border-[#1D1F0E] p-6.5 rounded-3xl w-full max-w-md text-left space-y-4 shadow-2xl relative overflow-hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#1D1F0E]" />

            <div className="flex items-center justify-between border-b border-[#1D1F0E]/10 pb-3">
              <div className="flex items-center gap-2 select-none text-[#1D1F0E] font-bold text-sm">
                <Edit3 className="w-5 h-5 text-[#1D1F0E]" />
                <span>Modify Authenticator Elements</span>
              </div>
              <button 
                onClick={() => setEditingEntry(null)}
                className="text-xs font-mono font-bold bg-[#1D1F0E]/10 hover:bg-[#1D1F0E]/20 text-[#1D1F0E] px-2 py-1 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            {editingError && (
              <div className="p-3 bg-[#1D1F0E]/5 border border-[#1D1F0E]/30 text-[#1D1F0E] rounded-xl text-xs flex items-center gap-1.5 font-sans leading-relaxed">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#1D1F0E]" /> {editingError}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-4 font-sans">
              
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-[#1D1F0E]/60 uppercase font-mono">Service Issuer</label>
                  <input
                    type="text"
                    required
                    value={editingEntry.issuer}
                    onChange={(e) => setEditingEntry({ ...editingEntry, issuer: e.target.value })}
                    className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] px-3.5 py-2 rounded-xl focus:outline-none focus:border-[#1D1F0E] text-xs"
                    placeholder="e.g. Google, GitHub"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-[#1D1F0E]/60 uppercase font-mono">Account (Email/ID)</label>
                  <input
                    type="text"
                    required
                    value={editingEntry.label}
                    onChange={(e) => setEditingEntry({ ...editingEntry, label: e.target.value })}
                    className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] px-3.5 py-2 rounded-xl focus:outline-none focus:border-[#1D1F0E] text-xs"
                    placeholder="e.g. user@gmail.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#1D1F0E]/60 uppercase font-mono">Secret Seed (Base32 format only)</label>
                <input
                  type="text"
                  required
                  value={editingEntry.secret}
                  onChange={(e) => setEditingEntry({ ...editingEntry, secret: e.target.value.replace(/[^A-Za-z2-7\s-]/g, "") })}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#1D1F0E] font-mono text-xs tracking-wider uppercase"
                  placeholder="e.g. JBSWY3DPEHPK3PXP"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#1D1F0E]/60 uppercase font-mono">Group Folder Tag</label>
                <select
                  value={editingEntry.group || "Personal"}
                  onChange={(e) => setEditingEntry({ ...editingEntry, group: e.target.value })}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] px-3 py-2 rounded-xl focus:outline-none focus:border-[#1D1F0E] text-xs"
                >
                  <option value="Personal">Personal Folder</option>
                  <option value="Work">Corporate/Work</option>
                  <option value="Financial">Financial Accs</option>
                  <option value="Gaming">Gaming / Social</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-[#1D1F0E]/60 uppercase font-mono font-semibold">Notes / Remarks (encrypted)</label>
                <textarea
                  value={editingEntry.notes || ""}
                  onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-[#1D1F0E] h-16 resize-none text-xs placeholder-[#1D1F0E]/35"
                  placeholder="Supplementary emergency codes or notes..."
                />
              </div>

              <div className="flex gap-2 text-xs pt-1 font-sans">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="flex-1 py-2.5 rounded-xl bg-transparent hover:bg-[#1D1F0E]/5 text-[#1D1F0E] cursor-pointer select-none border border-[#1D1F0E]/20 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 py-2.5 rounded-xl bg-[#1D1F0E] text-[#FAFCA4] font-bold cursor-pointer hover:opacity-90 transition-all flex items-center justify-center gap-1 shrink-0 select-none"
                >
                  {isUpdating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save Alterations"
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

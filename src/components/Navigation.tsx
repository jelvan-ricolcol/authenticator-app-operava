/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ShieldCheck, Lock, Unlock, RefreshCw, LogOut, User, Plus, History, Settings, Laptop, FileText, Smartphone, Menu, X } from "lucide-react";

interface NavigationProps {
  isAuthenticated: boolean;
  currentUserEmail: string | null;
  isVaultLocked: boolean;
  isSyncing: boolean;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  onLockVault: () => void;
  onUnlockVault: () => void;
  onLogout: () => void;
  onStartAuth: () => void;
}

export default function Navigation({
  isAuthenticated,
  currentUserEmail,
  isVaultLocked,
  isSyncing,
  currentPage,
  setCurrentPage,
  onLockVault,
  onUnlockVault,
  onLogout,
  onStartAuth
}: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateTo = (page: string) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="border-b border-[#1D1F0E]/10 bg-[#FAFCA4]/85 backdrop-blur-xl sticky top-0 z-50 text-[#1D1F0E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* Logo & Platform header */}
          <div className="flex items-center gap-2.5 select-none">
            <div 
              onClick={() => navigateTo(isAuthenticated ? "vault" : "landing")}
              className="w-9 h-9 bg-[#1D1F0E] rounded-lg flex items-center justify-center cursor-pointer shadow-sm active:scale-95 transition-transform"
            >
              <ShieldCheck className="w-5 h-5 text-[#FAFCA4] stroke-[2.2]" />
            </div>
            <div className="flex flex-col text-left">
              <span 
                onClick={() => navigateTo(isAuthenticated ? "vault" : "landing")}
                className="font-bold text-sm tracking-tight text-[#1D1F0E] cursor-pointer hover:opacity-80 transition-opacity"
              >
                OPERAVA
              </span>
              <span className="text-[9px] font-mono font-bold text-[#1D1F0E]/60 tracking-wider">
                AUTHENTICATOR
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1.5">
            {!isAuthenticated ? (
              // Public Navigation Items
              <>
                <button
                  onClick={() => navigateTo("landing")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    currentPage === "landing" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  Features
                </button>
                <button
                  onClick={() => navigateTo("security_spec")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    currentPage === "security_spec" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  Security Spec
                </button>
                <button
                  onClick={() => navigateTo("pricing")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    currentPage === "pricing" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  Pricing
                </button>
                <button
                  onClick={() => navigateTo("docs")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    currentPage === "docs" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  Developer Docs
                </button>
              </>
            ) : (
              // Authenticated Dashboard Navigation
              <>
                <button
                  onClick={() => navigateTo("vault")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    currentPage === "vault" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" /> Secure Vault
                </button>
                <button
                  onClick={() => navigateTo("add_account")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    currentPage === "add_account" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Credentials
                </button>
                <button
                  onClick={() => navigateTo("security_center")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    currentPage === "security_center" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  <History className="w-3.5 h-3.5" /> Security Center
                </button>
                <button
                  onClick={() => navigateTo("recovery")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    currentPage === "recovery" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Backup & Sync
                </button>
                <button
                  onClick={() => navigateTo("settings")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                    currentPage === "settings" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:text-[#1D1F0E]"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </button>
              </>
            )}
          </div>

          {/* Action Hub / Indicators */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              // Actions when logged in
              <div className="flex items-center gap-2">
                {/* Sync badge */}
                <div className="flex items-center gap-1.5 px-2 ml-1 sm:px-2.5 py-1.5 bg-[#FFFEEB]/60 border border-[#1D1F0E]/15 rounded-lg select-none text-[10px] font-mono font-semibold text-[#1D1F0E]">
                  <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "bg-[#1D1F0E] animate-ping" : "bg-[#1D1F0E]"}`} />
                  <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "E2E Backup Synced"}</span>
                  <RefreshCw className={`w-3 h-3 text-[#1D1F0E]/65 ml-0.5 ${isSyncing ? "animate-spin" : ""}`} />
                </div>

                {/* Secure lockout toggle */}
                {isVaultLocked ? (
                  <button
                    onClick={onUnlockVault}
                    className="flex items-center gap-1 bg-[#1D1F0E] text-[#FAFCA4] hover:bg-[#1D1F0E]/90 px-2 sm:px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all font-mono font-semibold"
                    title="Vault is closed. Decryption suspended."
                  >
                    <Lock className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Unlock</span>
                  </button>
                ) : (
                  <button
                    onClick={onLockVault}
                    className="flex items-center gap-1 bg-[#1D1F0E]/5 hover:bg-[#1D1F0E]/10 text-[#1D1F0E] px-2 sm:px-3 py-1.5 rounded-lg text-xs cursor-pointer border border-[#1D1F0E]/20 transition-all font-mono font-semibold"
                    title="Lock vault: decodes will close"
                  >
                    <Unlock className="w-3.5 h-3.5 text-[#1D1F0E]" /> <span className="hidden xs:inline">Lock</span>
                  </button>
                )}

                {/* Profile panel */}
                <div className="hidden xl:flex flex-col text-right text-[10px] font-mono pr-1 select-none text-[#1D1F0E]">
                  <span className="text-[#1D1F0E] truncate max-w-[120px] font-bold">{currentUserEmail}</span>
                  <span className="text-[#1D1F0E]/60 text-[9px]">AES-256 Active</span>
                </div>

                {/* Logout trigger - visible on desktop */}
                <button
                  onClick={onLogout}
                  className="hidden md:block p-1.5 text-[#1D1F0E]/60 hover:text-[#1D1F0E] hover:bg-[#1D1F0E]/5 rounded-lg transition-all cursor-pointer"
                  title="Logout session"
                >
                  <LogOut className="w-4 h-4 stroke-[2]" />
                </button>
              </div>
            ) : (
              // Button to trigger authentication flow
              <div className="flex items-center gap-2">
                <button
                  onClick={onStartAuth}
                  className="bg-[#1D1F0E] hover:bg-[#1D1F0E]/90 text-[#FAFCA4] font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer select-none"
                >
                  Access Vault
                </button>
              </div>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-[#1D1F0E]/70 hover:text-[#1D1F0E] hover:bg-[#1D1F0E]/5 rounded-lg transition-all cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 stroke-[2.2]" /> : <Menu className="w-5 h-5 stroke-[2.2]" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer (Drop-down list) */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-[#1D1F0E]/10 bg-[#FFFEEB] py-3.5 px-4 shadow-xl flex flex-col gap-1.5 animate-slide-down">
          {!isAuthenticated ? (
            <>
              <button
                onClick={() => navigateTo("landing")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  currentPage === "landing" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                Features
              </button>
              <button
                onClick={() => navigateTo("security_spec")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  currentPage === "security_spec" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                Security Spec
              </button>
              <button
                onClick={() => navigateTo("pricing")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  currentPage === "pricing" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                Pricing
              </button>
              <button
                onClick={() => navigateTo("docs")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  currentPage === "docs" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                Developer Docs
              </button>
            </>
          ) : (
            <>
              <div className="px-3.5 py-1 text-[10px] font-mono text-[#1D1F0E]/40 uppercase tracking-widest font-semibold">
                Device Coordinates
              </div>
              <button
                onClick={() => navigateTo("vault")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
                  currentPage === "vault" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                <Laptop className="w-4 h-4" /> Secure Vault
              </button>
              <button
                onClick={() => navigateTo("add_account")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
                  currentPage === "add_account" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                <Plus className="w-4 h-4" /> Add Credentials
              </button>
              <button
                onClick={() => navigateTo("security_center")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
                  currentPage === "security_center" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                <History className="w-4 h-4" /> Security Center
              </button>
              <button
                onClick={() => navigateTo("recovery")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
                  currentPage === "recovery" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                <RefreshCw className="w-4 h-4" /> Backup & Sync
              </button>
              <button
                onClick={() => navigateTo("settings")}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2.5 ${
                  currentPage === "settings" ? "bg-[#1D1F0E] text-[#FAFCA4]" : "text-[#1D1F0E]/70 hover:bg-[#1D1F0E]/5"
                }`}
              >
                <Settings className="w-4 h-4" /> Settings
              </button>

              <div className="border-t border-[#1D1F0E]/10 my-1 pt-1.5">
                <button
                  onClick={onLogout}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-650 hover:bg-[#1D1F0E]/5 transition-all flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4 stroke-[2]" /> End Active Session
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

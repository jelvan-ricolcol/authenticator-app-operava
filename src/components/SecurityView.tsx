/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { History, Shield, Smartphone, AlertTriangle, Key, Terminal, Globe, Trash2, CheckCircle, RefreshCw, XCircle, ChevronDown, Check } from "lucide-react";
import { ActiveSession, AuditLog } from "../types";
import { generateSalt, deriveKeyFromPassword, arrayBufferToBase64, calculateVerifierHash } from "../utils/crypto";

interface SecurityViewProps {
  onRefreshLogs: () => void;
}

export default function SecurityView({ onRefreshLogs }: SecurityViewProps) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Password reset state variables
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Fetch security audit states from the backend
  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      
      // Fetch concurrent sessions
      const sessionsRes = await fetch("/api/security/sessions", {
        headers: { "Authorization": `Bearer ${authHeader}` }
      });
      const sessionsData = await sessionsRes.json();
      if (sessionsRes.ok) {
        setSessions(sessionsData.sessions || []);
      }

      // Fetch audit logs
      const logsRes = await fetch("/api/security/logs", {
        headers: { "Authorization": `Bearer ${authHeader}` }
      });
      const logsData = await logsRes.json();
      if (logsRes.ok) {
        setAuditLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error("Failed to query security telemetry channels", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  // Handle active session revocation
  const handleRevokeSession = async (id: string) => {
    if (!window.confirm("Are you sure you want to revoke this session? The targeted device will be logged out instantly.")) return;
    try {
      const authHeader = sessionStorage.getItem("opv_session_id") || "";
      const res = await fetch("/api/security/sessions/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchSecurityData();
        onRefreshLogs();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to terminate session.");
      }
    } catch {
      alert("Failed to connect to backend api.");
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
      // 1. We derive old verifier hash to prove current password ownership
      const userEmail = sessionStorage.getItem("opv_email") || "";
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

      // 2. Derive new password salt + verifier
      const newSaltBytes = generateSalt();
      const newSaltBase64 = arrayBufferToBase64(newSaltBytes.buffer);
      const newVerifierHash = await calculateVerifierHash(newPassword, newSaltBytes);

      // 3. Dispatch to API
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

      setResetSuccess("Master password verifier reset! Please reauthenticate with your new credentials shortly.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      fetchSecurityData();
      onRefreshLogs();
    } catch (err: any) {
      setResetError(err.message || "Failed to update security verifiers.");
    } finally {
      setResetPending(false);
    }
  };

  // Determine overall audit rating score
  const hasBruteForceProtection = true;
  const healthScore = Math.max(
    50,
    100 - (sessions.length > 2 ? 10 : 0) - (auditLogs.some(l => l.severity === "critical") ? 25 : 0)
  );

  return (
    <div className="space-y-8 text-[#1D1F0E]">
      
      {/* Security Health Index Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Core index */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 p-6 rounded-3xl md:col-span-1 text-left space-y-3 relative overflow-hidden select-none shadow-sm">
          <span className="text-[10px] font-mono text-[#1D1F0E]/60 uppercase tracking-wide block font-bold">OPERAVA SECURITY SCORE</span>
          <div className="flex items-baseline gap-1.5 pt-1">
            <span className="text-4xl font-extrabold text-[#1D1F0E]">{healthScore}</span>
            <span className="text-sm font-mono text-[#1D1F0E]/50">/ 100</span>
          </div>
          <div className="text-xs text-[#1D1F0E]/70 font-sans leading-relaxed">
            Sovereign vault health index. Strong PBKDF2 stretching algorithms and active API route limitation layers are enabled.
          </div>
          <div className="w-full h-1.5 bg-[#1D1F0E]/10 rounded-full overflow-hidden mt-1 select-none">
            <div 
              className="h-full transition-all duration-500 bg-[#1D1F0E]"
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Dynamic status widgets */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 p-6 rounded-3xl md:col-span-2 text-left space-y-4 shadow-sm">
          <span className="text-[10px] font-mono text-[#1D1F0E]/60 uppercase tracking-wide block font-bold">OPERATIONAL AUDIT METRICS</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="flex items-start gap-2.5 bg-[#FFFEEB] p-3 rounded-xl border border-[#1D1F0E]/15">
              <CheckCircle className="w-4 h-4 text-[#1D1F0E] mt-0.5 flex-shrink-0" />
              <div className="text-xs leading-relaxed text-[#1D1F0E]/80 font-sans">
                <span className="text-[#1D1F0E] font-bold block">IP Rate-Limit Guard</span>
                Automatically blocks source IPs exhibiting aggressive auth errors.
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-[#FFFEEB] p-3 rounded-xl border border-[#1D1F0E]/15">
              <CheckCircle className="w-4 h-4 text-[#1D1F0E] mt-0.5 flex-shrink-0" />
              <div className="text-xs leading-relaxed text-[#1D1F0E]/80 font-sans">
                <span className="text-[#1D1F0E] font-bold block">FIDO2 Passkey Modules</span>
                Passkey standard tokens are available for hardware integration logins.
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Concurrent sessions management */}
      <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 text-left space-y-4 shadow-sm">
        <div className="flex justify-between items-center select-none font-sans">
          <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-[#1D1F0E] stroke-[2]" /> Connected Devices &amp; Browser Sessions
          </h3>
          <button 
            onClick={fetchSecurityData}
            className="p-1 px-3 bg-[#FFFEEB] border border-[#1D1F0E]/15 hover:border-[#1D1F0E]/30 text-[#1D1F0E] rounded-lg text-[10px] font-bold transition-colors cursor-pointer select-none"
          >
            Refresh List
          </button>
        </div>

        <div className="overflow-x-auto border border-[#1D1F0E]/15 rounded-2xl bg-[#FFFEEB]">
          <table className="w-full text-xs font-sans text-[#1D1F0E] text-left border-collapse">
            <thead>
              <tr className="bg-[#1D1F0E] text-[#FAFCA4] font-mono text-[9px] uppercase tracking-wide border-b border-[#1D1F0E] select-none">
                <th className="py-3 px-4 font-bold">Device Profile</th>
                <th className="py-3 px-4 font-bold">IP Address</th>
                <th className="py-3 px-4 font-bold">Estimated Location</th>
                <th className="py-3 px-4 font-bold">Last Active</th>
                <th className="py-3 px-4 font-bold text-right">Sec Controls</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(ses => (
                <tr key={ses.id} className="border-b border-[#1D1F0E]/10 hover:bg-[#FFFEEB]/55 font-sans">
                  <td className="py-3 px-4 font-bold text-[#1D1F0E] flex items-center gap-2">
                    {ses.device}
                    {ses.isCurrent && (
                      <span className="text-[9px] font-mono text-[#FAFCA4] bg-[#1D1F0E] border border-[#1D1F0E] px-1.5 py-0.2 rounded font-bold uppercase select-none">
                        Active Now
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#1D1F0E]/60 text-[10px]">{ses.ipAddress}</td>
                  <td className="py-3 px-4 flex items-center gap-1.5 text-[#1D1F0E]/80">
                    <Globe className="w-4 h-4 text-[#1D1F0E]/70" /> {ses.location}
                  </td>
                  <td className="py-3 px-4 text-[#1D1F0E]/60 text-[10px] font-mono">
                    {new Date(ses.lastActive).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!ses.isCurrent ? (
                      <button
                        onClick={() => handleRevokeSession(ses.id)}
                        className="text-[10px] font-bold text-[#1D1F0E] underline cursor-pointer hover:opacity-80"
                      >
                        Revoke Access
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-[#1D1F0E]/40 italic select-none">Current</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity telemetry terminal */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 text-left space-y-4 lg:col-span-2 flex flex-col justify-between shadow-sm">
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-1.5 select-none font-sans">
              <Terminal className="w-4 h-4 text-[#1D1F0E]" /> Security Telemetry Event Trails
            </h3>
            
            <div className="bg-[#FFFEEB] border border-[#1D1F0E]/15 rounded-2xl p-4 font-mono text-[10px] text-[#1D1F0E]/90 space-y-2 max-h-[310px] overflow-y-auto leading-relaxed divide-y divide-[#1D1F0E]/5">
              {auditLogs.length === 0 ? (
                <div className="text-center text-[#1D1F0E]/40 py-6 select-none font-sans">Connecting encrypted node logs...</div>
              ) : (
                auditLogs.map(log => {
                  const devStamp = new Date(log.timestamp).toISOString().split("T")[1].substring(0, 8);
                  
                  // Style based on levels
                  let badge = "text-[#1D1F0E]/70 bg-[#1D1F0E]/5 border border-[#1D1F0E]/15";
                  if (log.severity === "warning") badge = "text-[#1D1F0E] bg-[#FFFEEB] border border-[#1D1F0E]/30 font-bold";
                  if (log.severity === "critical") badge = "text-white bg-red-600 border border-red-700 font-bold uppercase select-none";

                  return (
                    <div key={log.id} className="pt-2 flex items-start justify-between gap-4 font-mono text-[10px]">
                      <div className="space-y-0.5">
                        <span className="text-[#1D1F0E]/40 mr-1.5 font-bold">[{devStamp}]</span>
                        <span className="text-[#1D1F0E] font-sans font-medium">{log.action}</span>
                        <div className="text-[9px] text-[#1D1F0E]/40 font-mono">IP: {log.ipAddress}</div>
                      </div>
                      <span className={`px-1.5 rounded text-[8px] uppercase font-bold ${badge}`}>
                        {log.severity}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Master password change */}
        <div className="bg-[#FFFEEB]/65 border border-[#1D1F0E]/15 rounded-3xl p-6 text-left space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#1D1F0E] flex items-center gap-1.5 select-none font-sans">
            <Key className="w-4 h-4 text-[#1D1F0E]" /> Change Master Password
          </h3>
          <p className="text-xs text-[#1D1F0E]/70 leading-relaxed font-sans pb-1 select-none">
            Updates your master security verifier. Current encryption keys are derived with new user salts instantly.
          </p>

          {resetError && (
            <div className="bg-[#1D1F0E]/5 border border-red-400 p-2.5 rounded-xl text-[11px] text-[#1D1F0E] font-sans flex items-start gap-1 leading-normal">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#1D1F0E]" />
              <span>{resetError}</span>
            </div>
          )}

          {resetSuccess && (
            <div className="bg-[#1D1F0E] border-t border-[#FAFCA4] p-2.5 rounded-xl text-[11px] text-[#FAFCA4] font-sans flex items-start gap-1 leading-normal">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{resetSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3 font-sans text-xs">
            
            <div className="space-y-1">
              <label className="block text-[#1D1F0E]/80 font-semibold">Current Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:border-[#1D1F0E] text-xs placeholder-[#1D1F0E]/30"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[#1D1F0E]/80 font-semibold">New Master Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:border-[#1D1F0E] text-xs placeholder-[#1D1F0E]/30"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[#1D1F0E]/80 font-semibold">Confirm Password Address</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#FFFEEB] border border-[#1D1F0E]/20 text-[#1D1F0E] rounded-xl px-3 py-2.5 font-mono focus:outline-none focus:border-[#1D1F0E] text-xs placeholder-[#1D1F0E]/30"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={resetPending}
              className="w-full bg-[#1D1F0E] hover:opacity-90 text-[#FAFCA4] font-bold py-2.5 rounded-xl cursor-pointer transition-colors text-xs select-none border border-[#1D1F0E]"
            >
              {resetPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Commit New Key"}
            </button>

          </form>
        </div>

      </div>

    </div>
  );
}

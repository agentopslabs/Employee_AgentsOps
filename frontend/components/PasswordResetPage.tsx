import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  ChevronsRight, 
  ArrowLeft 
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import Logo from "./Logo";

interface PasswordResetPageProps {
  token: string;
  email: string;
  onClose: () => void;
}

export default function PasswordResetPage({ token, email, onClose }: PasswordResetPageProps) {
  const { isDark } = useTheme();

  // Verification states
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState(email);
  const [verificationError, setVerificationError] = useState("");

  // Form states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Verify the secure token with backend on mount
  useEffect(() => {
    let active = true;
    async function verifyToken() {
      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        
        if (!active) return;

        if (res.ok && data.valid) {
          setTokenValid(true);
          if (data.email) {
            setVerifiedEmail(data.email);
          }
        } else {
          setTokenValid(false);
          setVerificationError(data.detail || data.error || "The reset token is invalid or has expired.");
        }
      } catch (e) {
        if (!active) return;
        setTokenValid(false);
        setVerificationError("Failed to communicate with authentication server.");
      } finally {
        if (active) {
          setVerifying(false);
        }
      }
    }

    verifyToken();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!password.trim()) {
      setErrorMsg("Please specify a new password.");
      return;
    }

    if (password.trim().length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      setErrorMsg("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          newPassword: password.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Your security passcode has been successfully updated!");
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setErrorMsg(data.detail || data.error || "Failed to update security credentials.");
      }
    } catch {
      setErrorMsg("Server is unreachable. Please verify connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Visual top border styling */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600" />

      {/* Main Form Box */}
      <div className="w-full max-w-[420px] space-y-6 z-10 text-center">
        <div className="space-y-2">
          <Logo className="h-9 text-slate-900 mx-auto scale-100" />
          <p className="text-xs text-slate-500 font-medium">Onboarding & Security Verification System</p>
        </div>

        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-md space-y-5 text-left">
          {verifying ? (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-600">Verifying secure token credibility...</p>
            </div>
          ) : !tokenValid ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
                <h2 className="text-sm font-bold text-slate-900">Verification Failure</h2>
              </div>
              <p className="text-xs text-slate-650 leading-relaxed">
                {verificationError}
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] leading-normal text-slate-505 text-slate-500">
                For security reasons, password reset tokens are single-use and expire exactly 15 minutes after issuance. Please request a new link.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Go Back to Access Portal
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="h-4.5 w-4.5 text-indigo-600" /> Define Secure Passcode
                </h2>
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                  Account: <strong className="text-slate-600">{verifiedEmail}</strong>
                </span>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 font-semibold rounded-xl text-xs leading-normal">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-55 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-xs leading-normal flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-500 font-semibold block text-xs">New Workspace Password</label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500 font-semibold block text-xs">Confirm New Password</label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={loading || !!successMsg}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving secure passcode...
                    </>
                  ) : (
                    <>
                      Re-define Password <ChevronsRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold py-2 px-4 rounded-xl text-xs transition text-center cursor-pointer block"
                >
                  Cancel and Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-[10px] text-slate-400 font-mono tracking-widest leading-none text-center">
          SECURE PROTOCOL ENVIRONMENT • SYSTEM V1.0
        </p>
      </div>
    </div>
  );
}

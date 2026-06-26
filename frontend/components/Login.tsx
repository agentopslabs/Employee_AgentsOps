import React, { useState } from "react";
import { 
  Lock, 
  Mail, 
  HelpCircle, 
  Fingerprint, 
  ChevronsRight,
  UserCheck
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import Logo from "./Logo";

interface LoginProps {
  onLoginSuccess: (user: any, token: string) => void;
  initialError?: string | null;
}

export default function Login({ onLoginSuccess, initialError }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Feedback States
  const [errorStatus, setErrorStatus] = useState(initialError || "");

  React.useEffect(() => {
    if (initialError) {
      setErrorStatus(initialError);
    }
  }, [initialError]);
  const [loading, setLoading] = useState(false);

  // Password Reset/Change States
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1 = Enter Email, 2 = Email Sent / Simulated Inbox
  const [receivedResetToken, setReceivedResetToken] = useState("");
  const [emailWasSentForReal, setEmailWasSentForReal] = useState(false);

  async function handleFormLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorStatus("");
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setErrorStatus("Kindly fill in your registered credentials.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      if (res.ok) {
        const payload = await res.json();
        onLoginSuccess(payload.user, payload.token);
      } else {
        const err = await res.json();
        setErrorStatus(err.detail || err.error || "Incorrect email or session password.");
      }
    } catch (e) {
      setErrorStatus("Auth authentication server unavailable. Ensure Express server is active.");
    } finally {
      setLoading(false);
    }
  }

  // Phase 1 Request Email
  async function handleRequestResetLink(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);

    if (!resetEmail.trim()) {
      setResetError("Please provide your registered account email first.");
      setResetLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        setReceivedResetToken(data.resetToken || "");
        setEmailWasSentForReal(data.emailSent === true);
        setResetStep(2);
      } else {
        const err = await res.json();
        setResetError(err.detail || err.error || "No account found with this email.");
      }
    } catch (e) {
      setResetError("Auth database is currently unreachable.");
    } finally {
      setResetLoading(false);
    }
  }

  // Phase 3 Save password after clicking simulation
  async function handlePasswordResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);

    if (!newPassword.trim()) {
      setResetError("Target password is required.");
      setResetLoading(false);
      return;
    }

    if (newPassword.trim().length < 6) {
      setResetError("Your passcode must be at least 6 characters long.");
      setResetLoading(false);
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setResetError("Passwords do not match. Please verify.");
      setResetLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim(), newPassword: newPassword.trim() })
      });

      if (res.ok) {
        setResetSuccess("Password altered successfully!");
        
        // Auto populate standard login fields for quick entry
        setEmail(resetEmail.trim());
        setPassword(newPassword.trim());

        setTimeout(() => {
          setIsResetMode(false);
          setResetStep(1);
          setNewPassword("");
          setConfirmPassword("");
        }, 1500);
      } else {
        const err = await res.json();
        setResetError(err.detail || err.error || "Failed to alter password.");
      }
    } catch (e) {
      setResetError("Auth database is currently unreachable.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 relative overflow-hidden select-none font-sans">
      
      {/* Subtle brand graphic elements */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900" />
      
      {/* Main Container */}
      <div className="w-full max-w-[400px] space-y-6 z-10 text-center">
        
        {/* Header Branding */}
        <div className="space-y-2">
          <Logo className="h-9 text-slate-900 mx-auto scale-100" />
          <p className="text-xs text-slate-500 font-medium">Employee Onboarding & Assessment Management Portal</p>
        </div>
 
        {/* Core Profile Credentials Card */}
        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-md space-y-5">
          {!isResetMode ? (
            <>
              <div className="text-left border-b border-slate-100 pb-3 mb-1">
                <h2 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                  <Fingerprint className="h-4.5 w-4.5 text-slate-800" /> Authorized Access Portal
                </h2>
              </div>
 
              <form onSubmit={handleFormLogin} className="space-y-4 text-xs text-left">
                {errorStatus && (
                  <div className="p-3 bg-rose-50 border border-rose-250 border-rose-200 text-rose-805 text-rose-700 font-semibold rounded-xl leading-snug">
                    {errorStatus}
                  </div>
                )}
 
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium block">Corporate Access Email</label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs transition"
                    />
                  </div>
                </div>
 
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium block">Security Password</label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs transition"
                    />
                  </div>
                </div>
 
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-850 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loading ? "Authorizing session..." : "Sign In Account"} <ChevronsRight className="h-4 w-4" />
                </button>
              </form>
 
              <div className="pt-2 text-center">
                <button 
                  type="button"
                  onClick={() => {
                    setIsResetMode(true);
                    setResetStep(1);
                    setResetError("");
                    setResetSuccess("");
                  }}
                  className="text-[11px] text-slate-500 hover:text-indigo-650 hover:text-indigo-600 hover:underline transition font-semibold cursor-pointer"
                >
                  Forgot password? Reset or Change here
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-left border-b border-slate-100 pb-3 mb-1">
                <h2 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                  <Fingerprint className="h-4.5 w-4.5 text-slate-800" /> Password Management
                </h2>
              </div>
 
              {resetStep === 1 && (
                <>
                  <p className="text-[11px] text-slate-500 mb-4 leading-normal text-left font-medium">
                    Enter your registered email address. We will send a secure password reset link directly to your inbox.
                  </p>
 
                  <form onSubmit={handleRequestResetLink} className="space-y-4 text-xs text-left">
                    {resetError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 font-semibold rounded-xl leading-normal">
                        {resetError}
                      </div>
                    )}
 
                    <div className="space-y-1.5">
                      <label className="text-slate-500 font-medium block">Registered Account Email</label>
                      <div className="relative">
                        <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 text-xs transition animate-fade-in"
                        />
                      </div>
                    </div>
 
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {resetLoading ? "Despatching link..." : "Send Reset Link Email"} <ChevronsRight className="h-4 w-4" />
                    </button>
                  </form>
                </>
              )}

              {resetStep === 2 && (
                <div className="space-y-4 text-left animate-fade-in">
                  {emailWasSentForReal ? (
                    // ─── REAL EMAIL SENT ───
                    <>
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                        <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                          ✅ Email Sent Successfully!
                        </p>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                          A password reset link has been sent to <strong>{resetEmail}</strong>.
                          Please check your inbox (and spam folder) and click the <strong>"Reset My Password"</strong> button in the email.
                        </p>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-500 leading-relaxed">
                        📌 The reset link opens this app and lets you set a new password. It expires in <strong>15 minutes</strong>.
                      </div>
                    </>
                  ) : (
                    // ─── SIMULATED (Gmail not configured) ───
                    <>
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[10px] leading-relaxed">
                        📬 <strong>Preview Mode:</strong> Real email sending is not configured yet. Use the button below to simulate clicking the reset link from your email.
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 p-4 space-y-3 shadow-inner border-dashed">
                        <div className="text-[9.5px] text-slate-400 border-b border-slate-200 pb-2 space-y-0.5">
                          <p><strong>From:</strong> AgentOps Labs &lt;no-reply@agentops.com&gt;</p>
                          <p><strong>To:</strong> {resetEmail}</p>
                          <p><strong>Subject:</strong> 🔐 AgentOps Labs — Reset Your Password</p>
                        </div>

                        <div className="p-4 bg-white rounded-xl border border-slate-200 text-slate-700 space-y-3">
                          <p className="text-[11px] text-slate-650 leading-relaxed font-sans">
                            Hello,<br/><br/>
                            We received a request to reset your password. Click the button below:
                          </p>

                          <div className="text-center pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                window.location.hash = `reset-token=${receivedResetToken}&email=${encodeURIComponent(resetEmail)}`;
                              }}
                              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-lg transition shadow-md cursor-pointer inline-flex items-center gap-1"
                            >
                              🔑 Reset My Password
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {resetStep === 3 && (
                <>
                  <p className="text-[11px] text-slate-505 text-slate-500 mb-4 leading-normal text-left font-bold text-indigo-600">
                    Step 3: Define your new security password
                  </p>
 
                  <form onSubmit={handlePasswordResetSubmit} className="space-y-4 text-xs text-left">
                    {resetError && (
                      <div className="p-3 bg-rose-50 border border-rose-205 text-rose-800 font-semibold rounded-xl leading-normal">
                        {resetError}
                      </div>
                    )}
                    
                    {resetSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-850 font-bold rounded-xl leading-normal">
                        {resetSuccess}
                      </div>
                    )}
 
                    <div className="space-y-1.5">
                      <label className="text-slate-500 font-semibold block">Target New Password (min 6 chars)</label>
                      <div className="relative">
                        <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-500 font-semibold block">Confirm New Password</label>
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
 
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {resetLoading ? "Saving passcode..." : "Save New Password"} <ChevronsRight className="h-4 w-4" />
                    </button>
                  </form>
                </>
              )}
 
              <div className="pt-2 text-center">
                <button 
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setResetStep(1);
                    setResetEmail("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="text-[11px] text-slate-655 text-slate-600 hover:text-slate-900 font-bold hover:underline transition uppercase cursor-pointer"
                >
                  &larr; Go Back to Sign In
                </button>
              </div>
            </>
          )}
 
          {/* Secure Protocol Notice info */}
        </div>
 
        {/* Info label credentials notice */}
        <p className="text-[10px] text-slate-400 font-mono tracking-widest leading-none">
          SECURE PROTOCOL ENVIRONMENT • SYSTEM V1.0
        </p>
 
      </div>
    </div>
  );
}

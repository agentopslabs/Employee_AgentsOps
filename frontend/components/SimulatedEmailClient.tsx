import React, { useState, useEffect } from "react";
import { Mail, Check, AlertCircle, Trash2, ChevronRight, Inbox, Clock, Send } from "lucide-react";
import { EmailRecord } from "../types";
import { useTheme } from "./ThemeContext";

interface SimulatedEmailClientProps {
  userId?: string;
  userEmail?: string;
  triggerRefresh?: number;
}

export default function SimulatedEmailClient({ userId, userEmail, triggerRefresh = 0 }: SimulatedEmailClientProps) {
  const { cardBg, textPrimary, textSecondary, isDark } = useTheme();
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchEmails() {
    setLoading(true);
    try {
      const res = await fetch("/api/emails");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && !contentType.includes("application/json")) {
          setLoading(false);
          return;
        }
        const text = await res.text();
        if (!text || text.trim().startsWith("<") || text.trim().startsWith("<!")) {
          setLoading(false);
          return;
        }
        const data = JSON.parse(text);
        // Filter if requested
        if (userEmail) {
          setEmails(data.filter((e: EmailRecord) => e.to.toLowerCase() === userEmail.toLowerCase() || e.to === "admin@agentops.com"));
        } else {
          setEmails(data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmails();
  }, [userEmail, triggerRefresh]);

  function getBadgeColor(type: string) {
    switch (type) {
      case "welcome": return "bg-blue-500/15 text-blue-400 border border-blue-500/25";
      case "password_reset": return "bg-red-500/15 text-red-400 border border-red-500/25";
      case "app_submitted": return "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25";
      case "test_assigned": return "bg-purple-500/15 text-purple-400 border border-purple-500/25";
      case "test_completed":
      case "pass": return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25";
      case "fail": return "bg-rose-500/15 text-rose-400 border border-rose-500/25";
      case "doc_approved": return "bg-green-500/15 text-green-400 border border-green-500/25";
      case "doc_rejected": return "bg-pink-500/15 text-pink-400 border border-pink-500/25";
      default: return "bg-slate-500/15 text-slate-400 border border-slate-500/25";
    }
  }

  return (
    <div className={`rounded-xl ${cardBg} border border-slate-800/80 overflow-hidden shadow-2xl`}>
      <div className="bg-slate-950/40 p-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-purple-500/20 p-1.5 rounded-lg text-purple-400">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-200">System Notification Mail Server</h4>
            <p className="text-xs text-slate-400">Simulating outbound automated communications</p>
          </div>
        </div>
        <button 
          onClick={fetchEmails}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-1 px-2.5 rounded-md transition-all"
        >
          Refresh Server
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 h-[340px]">
        {/* Email Inbox List */}
        <div className="md:col-span-2 border-r border-slate-800/80 overflow-y-auto h-full scrollbar-thin">
          {emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <Inbox className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">No SMTP messages dispatched yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-3 text-left cursor-pointer transition-all hover:bg-slate-800/40 ${selectedEmail?.id === email.id ? 'bg-slate-800/60 border-l-2 border-cyan-500' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                      To: {email.to}
                    </span>
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full font-bold ${getBadgeColor(email.type)}`}>
                      {email.type}
                    </span>
                  </div>
                  <h5 className="text-[12px] font-bold text-slate-200 truncate">{email.subject}</h5>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(email.sentAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Message Reader */}
        <div className="md:col-span-3 bg-slate-950/20 p-4 overflow-y-auto h-full scrollbar-thin">
          {selectedEmail ? (
            <div className="h-full flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-850 pb-3 mb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="text-xs">
                      <span className="text-slate-500 font-semibold">From: </span>
                      <span className="text-cyan-400 font-mono">noreply@agentops.com</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500 font-semibold">Date: </span>
                      <span className="text-slate-400">{new Date(selectedEmail.sentAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="text-xs mb-1">
                    <span className="text-slate-500 font-semibold">To: </span>
                    <span className="text-purple-400 font-mono">{selectedEmail.to}</span>
                  </div>
                  <h4 className="text-sm font-black text-slate-100">{selectedEmail.subject}</h4>
                </div>
                {selectedEmail.body.trim().startsWith("<") ? (
                  <div 
                    className="text-xs p-5 rounded-xl border border-slate-600 bg-white text-slate-950 font-sans shadow-inner overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                  />
                ) : (
                  <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-900">
                    {selectedEmail.body}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-500 text-center mt-4">
                🔒 In-memory simulation mail client. Authenticated as production standard.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Mail className="h-10 w-10 text-slate-700 animate-bounce mb-2" />
              <p className="text-xs text-slate-400 font-semibold">Message Viewer</p>
              <p className="text-[11px] text-slate-500 max-w-[200px] mt-1">Select an outbound automated email from the inbox list to read the simulated body</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

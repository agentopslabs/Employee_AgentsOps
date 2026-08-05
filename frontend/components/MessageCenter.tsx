import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  User, 
  AlertCircle, 
  Gift, 
  Calendar, 
  Check, 
  Inbox, 
  RefreshCw,
  Search,
  CheckCheck,
  MessageSquare
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { User as EmployeeUser, Message } from "../types";

interface MessageCenterProps {
  currentUser: EmployeeUser;
  employees: EmployeeUser[]; // populated for admin
  onRefreshAll?: () => void;
}

export default function MessageCenter({
  currentUser,
  employees = [],
  onRefreshAll
}: MessageCenterProps) {
  const { isDark, cardBg, textPrimary, textSecondary } = useTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "chat" | "birthday">("all");
  
  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  const [sendMode, setSendMode] = useState<"separate" | "all">("separate");
  const [compReceiverId, setCompReceiverId] = useState("");
  const [compSubject, setCompSubject] = useState("");
  const [compBody, setCompBody] = useState("");
  const [compError, setCompError] = useState("");
  const [compSuccess, setCompSuccess] = useState("");
  const [sending, setSending] = useState(false);

  // Selected message state
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const isAdmin = currentUser.role === "admin";
  const employeeList = employees.filter(e => e.role === "employee");

  async function fetchMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages?userId=${currentUser.id}&role=${currentUser.role}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        
        // Auto-select first message if none selected
        if (data.length > 0 && !selectedMessage) {
          setSelectedMessage(data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch messages pool", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMessages();
  }, [currentUser.id]);

  // Mark message as read
  async function markAsRead(msgId: string) {
    try {
      const res = await fetch(`/api/messages/${msgId}/read`, {
        method: "PUT"
      });
      if (res.ok) {
        // Update local state
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isRead: true } : m));
        if (selectedMessage && selectedMessage.id === msgId) {
          setSelectedMessage(prev => prev ? { ...prev, isRead: true } : null);
        }
        if (onRefreshAll) onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Handle compose submit
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    setCompError("");
    setCompSuccess("");

    if (!compReceiverId) {
      setCompError("Please specify a valid recipient.");
      return;
    }
    if (!compSubject.trim() || !compBody.trim()) {
      setCompError("Subject and Message body properties are mandatory.");
      return;
    }

    setSending(true);
    try {
      const payload = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        receiverId: compReceiverId,
        subject: compSubject,
        body: compBody,
        type: "user_msg"
      };

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const newMsg = await res.json();
        setCompSuccess("Message sent successfully and logged in database dispatch!");
        setCompSubject("");
        setCompBody("");
        
        // Refresh inbox list
        fetchMessages();
        setSelectedMessage(newMsg);
        
        setTimeout(() => {
          setComposerOpen(false);
          setCompSuccess("");
        }, 1500);
      } else {
        const err = await res.json();
        setCompError(err.detail || err.error || "Broadcast delivery rejected.");
      }
    } catch (err) {
      setCompError("Failure connecting with message service.");
    } finally {
      setSending(false);
    }
  }

  // Select a message and read it
  function handleSelectMessage(msg: Message) {
    setSelectedMessage(msg);
    if (!msg.isRead) {
      markAsRead(msg.id);
    }
  }

  // Filter messages
  const filteredMessages = messages.filter(m => {
    // Search filter
    const matchesSearch = 
      m.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.senderName.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category type filter
    if (filterType === "birthday") {
      return matchesSearch && m.type === "birthday_alert";
    }
    if (filterType === "chat") {
      return matchesSearch && m.type !== "birthday_alert";
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in text-left text-xs">
      
      {/* Title header */}
      <div className="border-b border-slate-200/5 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0A2540] tracking-tight flex items-center gap-2">
            Secure Message Center
            <span className="text-xs font-mono font-medium tracking-tight bg-[#F1B814]/15 text-[#F1B814] px-2.5 py-0.5 rounded-full border border-[#F1B814]/25">
              {isAdmin ? "Admin Control" : "Employee Portal"}
            </span>
          </h1>
          <p className="text-sm text-slate-700 mt-1">
            {isAdmin 
              ? "Draft custom organizational notifications or review automated upcoming employee birthday alerts."
              : "Read administrative updates or dispatch inquiries directly back to workspace HR leads."}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchMessages}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-350 dark:text-white rounded-lg transition"
            title="Reload Server Messages"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {isAdmin && (
            <button
              onClick={() => {
                setSendMode("separate");
                if (employeeList.length > 0) {
                  setCompReceiverId(employeeList[0].id);
                } else {
                  setCompReceiverId("");
                }
                setCompSubject("");
                setCompBody("");
                setCompError("");
                setCompSuccess("");
                setComposerOpen(true);
              }}
              className="bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              Send New Message
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px] relative">
        
        {/* LEFT COLUMN: Message list pane (Colspan 5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-4 shadow-sm">
          
          {/* Controls: Search & Category pills */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inbox logs..."
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white pl-9 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterType("all")}
                className={`flex-1 py-1 px-2.5 font-bold rounded-lg border text-[10px] text-center transition ${
                  filterType === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-605 text-slate-705 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 text-slate-350 dark:text-gray-300"
                }`}
              >
                All ({messages.length})
              </button>
              <button
                onClick={() => setFilterType("chat")}
                className={`flex-1 py-1 px-2.5 font-bold rounded-lg border text-[10px] text-center transition ${
                  filterType === "chat"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-605 text-slate-750 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 text-slate-350 dark:text-gray-300"
                }`}
              >
                Letters
              </button>
              {isAdmin && (
                <button
                  onClick={() => setFilterType("birthday")}
                  className={`flex-1 py-1 px-2.5 font-bold rounded-lg border text-[10px] text-center transition ${
                    filterType === "birthday"
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-transparent"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-605 text-slate-750 dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10 text-slate-350 dark:text-gray-300"
                  }`}
                >
                  Birthdays ({messages.filter(m => m.type === "birthday_alert").length})
                </button>
              )}
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[460px] pr-1 scrollbar-thin">
            {filteredMessages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                <Inbox className="mx-auto h-10 w-10 text-slate-300 mb-2 stroke-[1.5]" />
                <p>No messages matching search criteria inside folder inbox.</p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id;
                const isBday = msg.type === "birthday_alert";
                return (
                  <button
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-indigo-50/50 dark:bg-indigo-950/15 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/5 shadow-sm"
                        : "bg-slate-50/50 dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="flex items-center gap-1.5 truncate">
                        {isBday ? (
                          <Gift className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        )}
                        <span className="font-extrabold text-slate-900 dark:text-white truncate">
                          {msg.senderName}
                        </span>
                      </div>
                      
                      {/* Read status indicator dot */}
                      {!msg.isRead && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse flex-shrink-0" title="Unread" />
                      )}
                    </div>

                    <div className="mt-1">
                      <h4 className={`text-slate-800 dark:text-slate-200 font-bold truncate ${!msg.isRead ? 'font-black text-slate-950 dark:text-white' : ''}`}>
                        {msg.subject}
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] line-clamp-2 mt-0.5 leading-relaxed">
                        {msg.body}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2 text-[9px] text-slate-400 font-mono">
                      <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Message Reader (Colspan 7) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          {selectedMessage ? (
            <div className="h-full flex flex-col justify-between space-y-6">
              
              {/* Message Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-tighter">
                      {selectedMessage.senderName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
                        {selectedMessage.senderName}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono">
                        From: {selectedMessage.senderId} → To: {selectedMessage.receiverId}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-right font-mono text-slate-500 dark:text-slate-400 space-y-0.5">
                    <p>{new Date(selectedMessage.createdAt).toLocaleString()}</p>
                    {selectedMessage.isRead ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 font-bold">
                        <CheckCheck className="h-3 w-3" /> Read Status Logging
                      </span>
                    ) : (
                      <span className="text-indigo-600 dark:text-indigo-400 flex items-center justify-end gap-1 font-bold">
                        Unread Transits
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <h2 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                    {selectedMessage.subject}
                  </h2>
                  
                  {selectedMessage.type === "birthday_alert" && (
                    <div className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-2 rounded-lg flex items-center gap-1.5 w-max">
                      <Gift className="h-4 w-4" />
                      <span>Corporate Birthday Warning Triggered</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Message Body */}
              <div className="flex-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200 leading-relaxed font-medium max-h-[350px] overflow-y-auto pr-1">
                {selectedMessage.body}
              </div>

              {/* Action: reply option */}
              <div className="border-t border-slate-250 dark:border-slate-800 pt-4 flex gap-2 justify-end">
                {isAdmin && selectedMessage.senderId !== currentUser.id && selectedMessage.senderId !== "system" && (
                  <button
                    onClick={() => {
                      setSendMode("separate");
                      setCompReceiverId(selectedMessage.senderId);
                      setCompSubject(`Re: ${selectedMessage.subject.startsWith("Re:") ? "" : "Re: "}${selectedMessage.subject}`);
                      setCompBody("");
                      setCompError("");
                      setCompSuccess("");
                      setComposerOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Reply
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-12">
              <Mail className="h-16 w-16 text-slate-200 dark:text-slate-800 stroke-[1] mb-3" />
              <p className="font-bold">No message selected.</p>
              <p className="text-[10px] mt-1">Select a message from the left list card to view full communication logs.</p>
            </div>
          )}
        </div>
      </div>

      {/* COMPOSER FORM DIALOG MODAL */}
      {composerOpen && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSendMessage}
            className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-left text-xs absolute transform transition"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Send className="h-4.5 w-4.5 text-indigo-500" /> Assemble Secure Message
              </h3>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 p-1 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            {compError && (
              <p className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> {compError}
              </p>
            )}

            {compSuccess && (
              <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-250 border-emerald-200 p-2.5 rounded-lg flex items-center gap-1.5">
                <Check className="h-4 w-4" /> {compSuccess}
              </p>
            )}
            <div className="space-y-3">
              {isAdmin && (
                <div className="flex gap-4 p-3.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-350">
                    <input
                      type="radio"
                      name="sendMode"
                      value="separate"
                      checked={sendMode === "separate"}
                      onChange={() => {
                        setSendMode("separate");
                        if (employeeList.length > 0) {
                          setCompReceiverId(employeeList[0].id);
                        } else {
                          setCompReceiverId("");
                        }
                      }}
                      className="accent-indigo-600"
                    />
                    Send Separate Message
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-350">
                    <input
                      type="radio"
                      name="sendMode"
                      value="all"
                      checked={sendMode === "all"}
                      onChange={() => {
                        setSendMode("all");
                        setCompReceiverId("all");
                      }}
                      className="accent-indigo-600"
                    />
                    Send to All (Broadcast)
                  </label>
                </div>
              )}

              <div>
                <label className="text-slate-500 block mb-1 font-semibold uppercase">Recipient Address</label>
                {isAdmin ? (
                  sendMode === "all" ? (
                    <input
                      type="text"
                      disabled
                      value="All Registered Employees (Broadcast)"
                      className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl p-2.5 cursor-not-allowed font-bold"
                    />
                  ) : (
                    <select
                      value={compReceiverId}
                      onChange={(e) => setCompReceiverId(e.target.value)}
                      required
                      className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Target Employee --</option>
                      {employeeList.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  <input
                    type="text"
                    disabled
                    value="G Venkat (Corporate HR Lead)"
                    className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-xl p-2.5 cursor-not-allowed font-medium"
                  />
                )}
              </div>

              <div>
                <label className="text-slate-500 block mb-1 font-semibold uppercase">Subject Title</label>
                <input
                  type="text"
                  required
                  value={compSubject}
                  onChange={(e) => setCompSubject(e.target.value)}
                  placeholder="e.g., Onboarding Document Verification Compliance"
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-2.5 focus:ring-1 focus:ring-indigo-505 focus:outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1 font-semibold uppercase">Message Core Content</label>
                <textarea
                  required
                  rows={5}
                  value={compBody}
                  onChange={(e) => setCompBody(e.target.value)}
                  placeholder="Draft your secure letter content here..."
                  className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl p-3 focus:ring-1 focus:ring-indigo-505 focus:outline-none placeholder-slate-400 font-sans"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-900 pt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-bold py-2 px-4 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={sending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Transmit"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

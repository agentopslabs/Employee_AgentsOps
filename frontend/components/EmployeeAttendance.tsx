import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Coffee, 
  Send,
  ArrowRight,
  TrendingUp,
  FileText,
  Activity,
  Plus
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { User } from "../types";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  approvedAt?: string;
  remarks?: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  leaveType: "instant" | "oneday_before" | "oneweek_before";
  reason: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  remarks?: string;
}

interface EmployeeAttendanceProps {
  currentUser: User;
  onRefreshAll: () => void;
}

export default function EmployeeAttendance({ currentUser, onRefreshAll }: EmployeeAttendanceProps) {
  const { cardBg, cardHeaderBg } = useTheme();

  // Active view tab
  const [activeSubTab, setActiveSubTab] = useState<"checkin" | "leave" | "history">("checkin");

  // State
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Leave Form States
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveType, setLeaveType] = useState<"instant" | "oneday_before" | "oneweek_before">("instant");
  const [leaveReason, setLeaveReason] = useState("");
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveSuccess, setLeaveSuccess] = useState("");

  // Check-In Actions States
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [checkInSuccess, setCheckInSuccess] = useState("");

  // Get local date formatted as YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString("sv-SE");

  async function fetchEmployeeRecords() {
    setLoading(true);
    try {
      const [resAtt, resLeaves] = await Promise.all([
        fetch(`/api/attendance?employeeId=${currentUser.id}`),
        fetch(`/api/leaves?employeeId=${currentUser.id}`)
      ]);
      if (resAtt.ok) {
        const dataAtt = await resAtt.json();
        setAttendance(dataAtt);
      }
      if (resLeaves.ok) {
        const dataLeaves = await resLeaves.json();
        setLeaves(dataLeaves);
      }
    } catch (e) {
      console.error("Failed to load employee attendance/leave logs:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployeeRecords();
  }, [currentUser.id]);

  // Handle Daily Check-in request
  const handleCheckIn = async () => {
    setCheckInError("");
    setCheckInSuccess("");
    setCheckingIn(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          date: todayStr
        })
      });

      if (res.ok) {
        const newRecord = await res.json();
        // Optimistically add to local state immediately — no flicker
        setAttendance(prev => {
          // Remove any old record for today then prepend new one
          const filtered = prev.filter(r => r.date !== todayStr);
          return [newRecord, ...filtered];
        });
        setCheckInSuccess("Check-in approval request successfully dispatched to Admin!");
        // Delayed refresh for eventual consistency
        setTimeout(() => {
          fetchEmployeeRecords();
          onRefreshAll();
        }, 1500);
      } else {
        const err = await res.json();
        setCheckInError(err.detail || "Check-in failed.");
      }
    } catch (e) {
      setCheckInError("Connection failure occurred.");
    } finally {
      setCheckingIn(false);
    }
  };

  // Handle Leave form submit
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveError("");
    setLeaveSuccess("");

    if (!leaveStartDate || !leaveEndDate || !leaveReason.trim()) {
      setLeaveError("All fields are required to apply for leave.");
      return;
    }

    if (new Date(leaveStartDate) > new Date(leaveEndDate)) {
      setLeaveError("Start date cannot fall after the end date.");
      return;
    }

    setSubmittingLeave(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          startDate: leaveStartDate,
          endDate: leaveEndDate,
          leaveType,
          reason: leaveReason.trim()
        })
      });

      if (res.ok) {
        const newLeave = await res.json();
        // Optimistically add to local state immediately — no flicker
        setLeaves(prev => [newLeave, ...prev]);
        setLeaveSuccess("Leave request submitted successfully!");
        setLeaveStartDate("");
        setLeaveEndDate("");
        setLeaveReason("");
        setLeaveType("instant");
        // Delayed refresh for eventual consistency
        setTimeout(() => {
          fetchEmployeeRecords();
          onRefreshAll();
        }, 1500);
      } else {
        const err = await res.json();
        setLeaveError(err.detail || "Failed to submit leave request.");
      }
    } catch (e) {
      setLeaveError("Connection failure occurred.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Calculate stats
  const approvedAttendance = attendance.filter(a => a.status === "approved");
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  const currentYearStr = `${now.getFullYear()}`;

  const monthlyDays = approvedAttendance.filter(a => a.date.startsWith(currentMonthStr)).length;
  const yearlyDays = approvedAttendance.filter(a => a.date.startsWith(currentYearStr)).length;

  const todayRecord = attendance.find(a => a.date === todayStr);

  const leavesApproved = leaves.filter(l => l.status === "approved").length;
  const leavesRejected = leaves.filter(l => l.status === "rejected").length;
  const leavesPending = leaves.filter(l => l.status === "pending").length;

  return (
    <div className="space-y-8 text-left animate-fade-in text-xs">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            Attendance & Leaves Dashboard
            <span className="text-xs bg-indigo-505/15 bg-indigo-500/10 text-indigo-650 text-indigo-650 px-2 rounded-full font-mono font-medium border border-indigo-550/15">
              Employee Console
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Send daily attendance check-in requests, apply for leaves, and review your monthly and yearly statistics history.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          <button
            onClick={() => setActiveSubTab("checkin")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "checkin"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Check-In
          </button>
          <button
            onClick={() => setActiveSubTab("leave")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "leave"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Apply for Leave
          </button>
          <button
            onClick={() => setActiveSubTab("history")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "history"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            History & Logs
          </button>
        </div>
      </div>

      {activeSubTab === "checkin" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Check-In Card */}
          <div className="lg:col-span-6 space-y-6">
            <div className={`${cardBg} p-6 space-y-6 shadow-sm border border-slate-200/80`}>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Clock className="text-indigo-550 h-5 w-5" />
                <h3 className="text-sm font-extrabold text-slate-900 font-sans">Daily Attendance Verification</h3>
              </div>

              {checkInError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-650 text-red-600 font-semibold rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{checkInError}</span>
                </div>
              )}

              {checkInSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 font-semibold rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{checkInSuccess}</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-center space-y-2">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide font-mono">Today's Date</span>
                <p className="text-2xl font-black text-slate-800 font-mono tracking-tight">{todayStr}</p>
                <div className="pt-2">
                  {!todayRecord ? (
                    <button
                      disabled={checkingIn}
                      onClick={handleCheckIn}
                      className="mx-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white font-bold rounded-lg shadow transition-all cursor-pointer uppercase flex items-center gap-1.5"
                    >
                      <Send className="h-4 w-4" />
                      {checkingIn ? "Sending..." : "Submit Today's Check-In"}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center space-y-1">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase ${
                        todayRecord.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                          : todayRecord.status === "rejected"
                          ? "bg-rose-500/10 text-rose-600 border-rose-500/25"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/25 animate-pulse"
                      }`}>
                        {todayRecord.status === "approved"
                          ? "✔ Approved Present"
                          : todayRecord.status === "rejected"
                          ? "✘ Check-in Rejected"
                          : "⏳ Awaiting Approval"}
                      </span>
                      {todayRecord.remarks && (
                        <p className="text-[10px] text-slate-500 italic mt-1">Remarks: {todayRecord.remarks}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <h4 className="font-extrabold text-[11px] text-slate-500 uppercase tracking-wide flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-indigo-500" /> Attendance Summaries</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Days Present (This Month)</span>
                    <span className="block text-xl font-black text-indigo-600 font-mono">{monthlyDays} Days</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-lg">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">Days Present (This Year)</span>
                    <span className="block text-xl font-black text-indigo-600 font-mono">{yearlyDays} Days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Guidance Info Card */}
          <div className="lg:col-span-6 space-y-6">
            <div className={`${cardBg} p-6 border border-slate-200`}>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-500" /> Check-in Guidelines
              </h4>
              <div className="space-y-3.5 text-[11px] text-slate-600 leading-relaxed">
                <p>
                  <strong>Verification Cycle:</strong> Checking-in submits a request stamp for the current day. Present count statistics update immediately once the verification request is approved by the admin.
                </p>
                <p>
                  <strong>Check-in Frequency:</strong> Only 1 daily verification request is permitted per candidate per day. If a request is rejected, you can resubmit a corrected stamp request.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "leave" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Apply Leave form */}
          <div className="lg:col-span-7">
            <form onSubmit={handleApplyLeave} className={`${cardBg} p-6 space-y-5 shadow-sm text-xs`}>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Coffee className="text-indigo-500 h-4.5 w-4.5" />
                <h3 className="text-sm font-extrabold text-slate-900">Apply for Leave Request</h3>
              </div>

              {leaveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 font-semibold rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{leaveError}</span>
                </div>
              )}

              {leaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 font-semibold rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{leaveSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-mono"
                  />
                </div>
              </div>


              <div>
                <label className="text-slate-700 font-bold block mb-1">Reason for Leave</label>
                <textarea
                  required
                  placeholder="Provide details about your absence request..."
                  rows={4}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-sans leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={submittingLeave}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white font-bold text-xs py-2.5 rounded-lg shadow-md transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {submittingLeave ? "Submitting..." : "Apply Leave Request"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className={`${cardBg} p-5 border border-slate-200 text-xs`}>
              <h4 className="font-bold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Coffee className="h-4 w-4 text-amber-500" /> Leave History Overview
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2.5 text-center text-[10px] font-bold">
                  <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/15 p-2 rounded">
                    <span className="block text-base font-black font-mono">{leavesApproved}</span> Approved
                  </div>
                  <div className="bg-rose-500/5 text-rose-600 border border-rose-500/15 p-2 rounded">
                    <span className="block text-base font-black font-mono">{leavesRejected}</span> Rejected
                  </div>
                  <div className="bg-amber-500/5 text-amber-600 border border-amber-500/15 p-2 rounded">
                    <span className="block text-base font-black font-mono">{leavesPending}</span> Pending
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-sans pt-1 border-t border-slate-100">
                  Your leave requests are logged instantly. Approved leaves are audited against overall onboarding status benchmarks.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-xs">
          {/* Check-ins list (Colspan 5) */}
          <div className="lg:col-span-5 space-y-4">
            <div className={`${cardBg} overflow-hidden shadow-sm`}>
              <div className={`${cardHeaderBg} p-4 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700`}>
                <span className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-indigo-500" /> Check-In Logs</span>
                <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono">
                  {attendance.length} Total
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100 pr-1 scrollbar-thin">
                {attendance.length === 0 ? (
                  <p className="text-slate-400 italic py-8 text-center font-medium">No check-in logs found.</p>
                ) : (
                  attendance.map(a => (
                    <div key={a.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition">
                      <div className="font-mono text-[10px]">
                        <span className="block font-bold text-slate-800">{a.date}</span>
                        <span className="text-slate-400 text-[8px]">Checked at: {new Date(a.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        a.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : a.status === "rejected"
                          ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Leaves list (Colspan 7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className={`${cardBg} overflow-hidden shadow-sm`}>
              <div className={`${cardHeaderBg} p-4 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700`}>
                <span className="flex items-center gap-1.5"><Coffee className="h-4 w-4 text-indigo-500" /> Leave History Queue</span>
                <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono">
                  {leaves.length} Requested
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100 pr-1 scrollbar-thin">
                {leaves.length === 0 ? (
                  <p className="text-slate-400 italic py-8 text-center font-medium">No leave logs found.</p>
                ) : (
                  leaves.map(l => (
                    <div key={l.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-bold text-slate-800 text-[11px]">
                            📅 Duration: <span className="font-mono text-slate-900 font-bold">{l.startDate}</span> to <span className="font-mono text-slate-900 font-bold">{l.endDate}</span>
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          l.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : l.status === "rejected"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}>
                          {l.status}
                        </span>
                      </div>

                      <div className="text-[10px] space-y-1">
                        <p className="text-slate-650 bg-slate-50 p-2 rounded border border-slate-100">
                          <strong>Reason:</strong> {l.reason}
                        </p>
                        {(l.remarks || l.reviewedAt) && (
                          <div className="pl-2.5 border-l-2 border-l-slate-200 text-slate-500 mt-1">
                            <p className="text-[9px]">HR Feedback remarks: "{l.remarks || 'No remarks logged.'}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

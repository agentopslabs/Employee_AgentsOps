import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Check, 
  X, 
  AlertCircle, 
  Users, 
  TrendingUp, 
  FileText,
  User,
  Coffee,
  Activity
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { User as EmployeeUser, UserRole, UserStatus } from "../types";

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

interface AdminAttendanceProps {
  employees: EmployeeUser[];
  onRefreshAll: () => void;
}

export default function AdminAttendance({ employees, onRefreshAll }: AdminAttendanceProps) {
  const { cardBg, cardHeaderBg } = useTheme();

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<"attendance" | "leaves" | "summaries">("attendance");

  // State
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Selected Employee filter for Summaries tab
  const [selectedSummaryEmpId, setSelectedSummaryEmpId] = useState("");

  const activeEmployees = employees.filter(
    e => e.role === UserRole.EMPLOYEE && e.status === UserStatus.ACTIVE
  );

  async function fetchAttendanceAndLeaves() {
    setLoading(true);
    try {
      const [resAtt, resLeaves] = await Promise.all([
        fetch("/api/attendance"),
        fetch("/api/leaves")
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
      console.error("Failed to load attendance and leave requests:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAttendanceAndLeaves();
  }, []);

  const handleReviewAttendance = async (recordId: string, status: "approved" | "rejected") => {
    const remarks = remarksMap[recordId] || "";
    setActionLoadingId(recordId);
    try {
      const res = await fetch(`/api/attendance/${recordId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks })
      });
      if (res.ok) {
        const updatedRecord = await res.json();
        // Optimistically update local state immediately so there is no flicker
        setAttendance(prev => prev.map(r => r.id === recordId ? updatedRecord : r));
        setRemarksMap(prev => {
          const clone = { ...prev };
          delete clone[recordId];
          return clone;
        });
        // Then also re-fetch to ensure eventual consistency
        setTimeout(() => {
          fetchAttendanceAndLeaves();
          onRefreshAll();
        }, 1500);
      } else {
        const err = await res.json();
        alert(err.detail || "Action failed.");
      }
    } catch (e) {
      alert("Connection failure.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReviewLeave = async (leaveId: string, status: "approved" | "rejected") => {
    const remarks = remarksMap[leaveId] || "";
    setActionLoadingId(leaveId);
    try {
      const res = await fetch(`/api/leaves/${leaveId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks })
      });
      if (res.ok) {
        const updatedLeave = await res.json();
        // Optimistically update local state immediately so there is no flicker
        setLeaves(prev => prev.map(l => l.id === leaveId ? updatedLeave : l));
        setRemarksMap(prev => {
          const clone = { ...prev };
          delete clone[leaveId];
          return clone;
        });
        // Then also re-fetch to ensure eventual consistency
        setTimeout(() => {
          fetchAttendanceAndLeaves();
          onRefreshAll();
        }, 1500);
      } else {
        const err = await res.json();
        alert(err.detail || "Action failed.");
      }
    } catch (e) {
      alert("Connection failure.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper to calculate employee metrics
  const getEmployeeMetrics = (empId: string) => {
    const empAttendance = attendance.filter(a => a.employeeId === empId && a.status === "approved");
    const empLeaves = leaves.filter(l => l.employeeId === empId);

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    const currentYearStr = `${now.getFullYear()}`;

    // Monthly present count
    const monthlyPresent = empAttendance.filter(a => a.date.startsWith(currentMonthStr)).length;
    // Yearly present count
    const yearlyPresent = empAttendance.filter(a => a.date.startsWith(currentYearStr)).length;

    // Leave counts
    const leavesApplied = empLeaves.length;
    const leavesApproved = empLeaves.filter(l => l.status === "approved").length;
    const leavesRejected = empLeaves.filter(l => l.status === "rejected").length;
    const leavesPending = empLeaves.filter(l => l.status === "pending").length;

    return {
      monthlyPresent,
      yearlyPresent,
      leavesApplied,
      leavesApproved,
      leavesRejected,
      leavesPending,
      empAttendance,
      empLeaves
    };
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            Attendance & Leave Operations
            <span className="text-xs bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full border border-indigo-550/15">
              Attendance Desk
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review employee daily attendance check-ins, verify leave requests, and audit employee monthly and yearly records.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          <button
            onClick={() => setActiveSubTab("attendance")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "attendance"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Check-In Requests
            {attendance.filter(a => a.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-rose-500 text-white text-[9px] px-1 rounded-full font-bold">
                {attendance.filter(a => a.status === "pending").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab("leaves")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "leaves"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Leave Requests
            {leaves.filter(l => l.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-rose-500 text-white text-[9px] px-1 rounded-full font-bold">
                {leaves.filter(l => l.status === "pending").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab("summaries")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "summaries"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Employee Summaries
          </button>
        </div>
      </div>

      {activeSubTab === "attendance" && (
        <div className={`${cardBg} overflow-hidden shadow-sm text-xs`}>
          <div className={`${cardHeaderBg} p-4 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700`}>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-indigo-500" /> Pending Daily Check-Ins</span>
            <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-mono">
              {attendance.filter(a => a.status === "pending").length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {attendance.filter(a => a.status === "pending").length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium leading-tight">
                No pending daily check-in requests to verify.
              </div>
            ) : (
              attendance.filter(a => a.status === "pending").map((rec) => (
                <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{rec.employeeName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {rec.employeeId}</span>
                    </div>
                    <p className="text-[11px] text-slate-650 flex items-center gap-1">
                      Check-in target date: <strong className="text-indigo-600">{rec.date}</strong>
                    </p>
                    <span className="text-[9px] text-slate-400 font-mono block">
                      Submitted at: {new Date(rec.submittedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Remarks (optional)"
                      value={remarksMap[rec.id] || ""}
                      onChange={(e) => setRemarksMap(prev => ({ ...prev, [rec.id]: e.target.value }))}
                      className="bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-indigo-500 w-full sm:w-48 text-xs"
                    />
                    <div className="flex gap-2.5 w-full sm:w-auto justify-end">
                      <button
                        disabled={actionLoadingId === rec.id}
                        onClick={() => handleReviewAttendance(rec.id, "rejected")}
                        className="px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded font-bold hover:bg-rose-100 transition cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        disabled={actionLoadingId === rec.id}
                        onClick={() => handleReviewAttendance(rec.id, "approved")}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === "leaves" && (
        <div className={`${cardBg} overflow-hidden shadow-sm text-xs`}>
          <div className={`${cardHeaderBg} p-4 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700`}>
            <span className="flex items-center gap-1.5"><Coffee className="h-4 w-4 text-indigo-500" /> Pending Leave Requests</span>
            <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-mono">
              {leaves.filter(l => l.status === "pending").length} Requests
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {leaves.filter(l => l.status === "pending").length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium leading-tight">
                No pending employee leave requests to verify.
              </div>
            ) : (
              leaves.filter(l => l.status === "pending").map((leave) => (
                <div key={leave.id} className="p-5 space-y-4 hover:bg-slate-50/50 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{leave.employeeName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {leave.employeeId}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Applied: {new Date(leave.submittedAt).toLocaleString()}</p>
                    </div>


                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <p className="font-semibold text-slate-800 text-[11px]">
                        Leave Duration: <span className="font-black text-slate-900 font-mono">{leave.startDate}</span> to <span className="font-black text-slate-900 font-mono">{leave.endDate}</span>
                      </p>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                        <span className="font-bold text-slate-500 block mb-1">Reason for Leave Request:</span>
                        <p className="text-slate-800 italic leading-relaxed text-[11px]">{leave.reason || "No reason specified."}</p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-end space-y-3">
                      <div>
                        <label className="text-slate-600 font-bold block mb-1">Review Remarks / Feedback</label>
                        <input
                          type="text"
                          placeholder="e.g. Leave request approved, tasks delegated."
                          value={remarksMap[leave.id] || ""}
                          onChange={(e) => setRemarksMap(prev => ({ ...prev, [leave.id]: e.target.value }))}
                          className="w-full bg-white border border-slate-350 rounded p-2 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2.5">
                        <button
                          disabled={actionLoadingId === leave.id}
                          onClick={() => handleReviewLeave(leave.id, "rejected")}
                          className="px-4 py-1.8 bg-rose-50 text-rose-600 border border-rose-200 rounded font-bold hover:bg-rose-100 transition cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1"
                        >
                          <X className="h-3.5 w-3.5" /> Reject Request
                        </button>
                        <button
                          disabled={actionLoadingId === leave.id}
                          onClick={() => handleReviewLeave(leave.id, "approved")}
                          className="px-4 py-1.8 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve Leave
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === "summaries" && (
        <div className="space-y-6 text-xs">
          {/* Selector header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <Users className="text-indigo-500 h-5 w-5" />
              <div>
                <h3 className="font-bold text-slate-800">Employee Summary Directory</h3>
                <p className="text-[10px] text-slate-400">Select an employee to inspect detailed monthly/yearly logs</p>
              </div>
            </div>

            <select
              value={selectedSummaryEmpId}
              onChange={(e) => setSelectedSummaryEmpId(e.target.value)}
              className="bg-white border border-slate-300 rounded p-2 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer text-xs w-full sm:w-64"
            >
              <option value="">-- All Active Employees --</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
              ))}
            </select>
          </div>

          {selectedSummaryEmpId ? (
            // Single Employee Detail view
            (() => {
              const emp = employees.find(e => e.id === selectedSummaryEmpId);
              if (!emp) return <p className="text-slate-400 italic">Employee not found.</p>;
              const stats = getEmployeeMetrics(emp.id);

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left stats card */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className={`${cardBg} p-5 border border-slate-200 text-center space-y-4`}>
                      <div className="h-16 w-16 mx-auto rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md text-xl">
                        {emp.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">{emp.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.email}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-left">
                        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-center">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">This Month</span>
                          <span className="block text-lg font-black text-indigo-600">{stats.monthlyPresent} days</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-center">
                          <span className="text-[9px] text-slate-500 font-bold uppercase">This Year</span>
                          <span className="block text-lg font-black text-indigo-600">{stats.yearlyPresent} days</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-150 pt-4 text-left space-y-2">
                        <span className="font-bold text-slate-500 block uppercase text-[9px] tracking-wider">Leave History Log Summary</span>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                          <div className="bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 p-1 rounded">
                            <span className="block text-sm">{stats.leavesApproved}</span> Approved
                          </div>
                          <div className="bg-rose-500/5 text-rose-600 border border-rose-500/10 p-1 rounded">
                            <span className="block text-sm">{stats.leavesRejected}</span> Rejected
                          </div>
                          <div className="bg-amber-500/5 text-amber-600 border border-amber-500/10 p-1 rounded">
                            <span className="block text-sm">{stats.leavesPending}</span> Pending
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right history logs */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* Attendance Grid list */}
                    <div className={`${cardBg} p-5 border border-slate-200 space-y-4`}>
                      <h4 className="font-extrabold text-slate-900 text-[13px] border-b border-slate-100 pb-2 flex items-center gap-1">
                        <Activity className="h-4 w-4 text-indigo-550" /> Present Days Audit Log
                      </h4>
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-150 pr-1 scrollbar-thin">
                        {stats.empAttendance.length === 0 ? (
                          <p className="text-slate-400 italic py-4 text-center">No approved attendance days found.</p>
                        ) : (
                          stats.empAttendance.map(a => (
                            <div key={a.id} className="py-2.5 flex items-center justify-between font-mono text-[10px] text-slate-650">
                              <span>📅 Check-in date: <strong className="text-slate-800 font-bold">{a.date}</strong></span>
                              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                <CheckCircle className="h-3 w-3" /> Present Approved
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Leaves list */}
                    <div className={`${cardBg} p-5 border border-slate-200 space-y-4`}>
                      <h4 className="font-extrabold text-slate-900 text-[13px] border-b border-slate-100 pb-2 flex items-center gap-1">
                        <Coffee className="h-4 w-4 text-amber-500" /> Leave Requests History Log
                      </h4>
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-150 pr-1 scrollbar-thin">
                        {stats.empLeaves.length === 0 ? (
                          <p className="text-slate-400 italic py-4 text-center">No applied leave requests found.</p>
                        ) : (
                          stats.empLeaves.map(l => (
                            <div key={l.id} className="py-3 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-800">
                                  {l.startDate} to {l.endDate}
                                </span>
                                <span className={`px-2 py-0.2 rounded uppercase text-[9px] font-bold border ${
                                  l.status === "approved"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    : l.status === "rejected"
                                    ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                }`}>
                                  {l.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 italic">Reason: {l.reason}</p>
                              {l.remarks && (
                                <p className="text-[9px] text-slate-500 font-mono">HR Remarks: {l.remarks}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            // All Employees List summaries grid
            <div className={`${cardBg} overflow-hidden shadow-sm`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50/60 text-slate-600 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                      <th className="p-3.5 pl-6">Employee Name</th>
                      <th className="p-3.5">Days Present (Month)</th>
                      <th className="p-3.5">Days Present (Year)</th>
                      <th className="p-3.5">Leaves Approved</th>
                      <th className="p-3.5 text-right pr-6">Leaves Rejected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                          No active employees registered.
                        </td>
                      </tr>
                    ) : (
                      activeEmployees.map((emp) => {
                        const stats = getEmployeeMetrics(emp.id);
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-3.5 pl-6">
                              <button
                                onClick={() => setSelectedSummaryEmpId(emp.id)}
                                className="font-bold text-indigo-650 hover:underline text-left cursor-pointer"
                              >
                                {emp.name}
                              </button>
                              <span className="text-[9px] text-slate-400 block font-mono">{emp.email}</span>
                            </td>
                            <td className="p-3.5 font-bold text-slate-800">{stats.monthlyPresent} days</td>
                            <td className="p-3.5 font-bold text-slate-800">{stats.yearlyPresent} days</td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                                {stats.leavesApproved} Approved
                              </span>
                            </td>
                            <td className="p-3.5 text-right pr-6">
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] font-bold">
                                {stats.leavesRejected} Rejected
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

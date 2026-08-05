import React, { useState, useEffect } from "react";
import { 
  UserCheck, 
  Layers, 
  Users, 
  Plus, 
  HelpCircle, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Play,
  ClipboardList,
  Settings
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Test, User as EmployeeUser, AssignedTest, TestStatus, UserStatus } from "../types";

interface AdminTestAssignmentProps {
  tests: Test[];
  employees: EmployeeUser[];
  assignedTests: AssignedTest[];
  onRefreshAll: () => void;
}

export default function AdminTestAssignment({
  tests,
  employees,
  assignedTests,
  onRefreshAll
}: AdminTestAssignmentProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  // Assignment selection states
  const [selectedTestId, setSelectedTestId] = useState("");
  const [targetType, setTargetType] = useState<"multiple" | "all">("multiple");
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  
  // feedback state
  const [assignMessage, setAssignMessage] = useState("");
  const [assignError, setAssignError] = useState("");

  // Default test states
  const [defaultTestId, setDefaultTestId] = useState("");
  const [defaultMessage, setDefaultMessage] = useState("");
  const [defaultError, setDefaultError] = useState("");
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setDefaultTestId(data.defaultTestId || "");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    loadSettings();
  }, []);

  async function handleSaveDefault(e: React.FormEvent) {
    e.preventDefault();
    setDefaultMessage("");
    setDefaultError("");
    setIsSavingDefault(true);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTestId })
      });
      if (res.ok) {
        setDefaultMessage("Default onboarding test updated successfully!");
      } else {
        const errData = await res.json();
        setDefaultError(errData.detail || "Failed to update default test.");
      }
    } catch (err) {
      setDefaultError("Connection failed. Unable to save settings.");
    } finally {
      setIsSavingDefault(false);
    }
  }

  function formatTimeAgo(assignRecord: AssignedTest, empUser?: EmployeeUser) {
    let targetTimeMs = 0;
    let label = "Assigned";

    if (assignRecord.status === TestStatus.COMPLETED && assignRecord.completedAt) {
      targetTimeMs = new Date(assignRecord.completedAt).getTime();
      label = "Completed";
    } else {
      if (assignRecord.assignedAt) {
        targetTimeMs = new Date(assignRecord.assignedAt).getTime();
      } else {
        const parts = assignRecord.id.split("-");
        if (parts.length > 1) {
          const timestamp = parseInt(parts[1], 10);
          if (!isNaN(timestamp) && timestamp > 1000000000000) {
            targetTimeMs = timestamp;
          }
        }
      }
      if (!targetTimeMs) {
        if (empUser && empUser.createdAt) {
          targetTimeMs = new Date(empUser.createdAt).getTime();
        } else {
          targetTimeMs = Date.now() - 24 * 60 * 60 * 1000;
        }
      }
    }

    const elapsedSeconds = Math.floor((Date.now() - targetTimeMs) / 1000);
    if (elapsedSeconds < 0) return `${label} just now`;
    if (elapsedSeconds < 60) return `${label} ${elapsedSeconds}s ago`;
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${label} ${elapsedMinutes}m ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${label} ${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${label} ${elapsedDays}d ago`;
  }

  const activePublishedTests = tests.filter(t => t.isPublished);
  const activeEmployees = employees.filter(e => e.status === UserStatus.ACTIVE);

  function handleToggleEmpSelect(empId: string) {
    if (selectedEmpIds.includes(empId)) {
      setSelectedEmpIds(selectedEmpIds.filter(id => id !== empId));
    } else {
      setSelectedEmpIds([...selectedEmpIds, empId]);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignMessage("");
    setAssignError("");

    if (!selectedTestId) {
      setAssignError("Kindly select an assessment standard model to deploy.");
      return;
    }

    let finalEmployeeIds: string[] = [];
    if (targetType === "all") {
      finalEmployeeIds = activeEmployees.map(e => e.id);
    } else if (targetType === "single" || targetType === "multiple") {
      finalEmployeeIds = selectedEmpIds;
    }

    if (finalEmployeeIds.length === 0) {
      setAssignError("Select at least 1 employee recipient to proceed.");
      return;
    }

    try {
      const res = await fetch("/api/assigned-tests/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: selectedTestId, employeeIds: finalEmployeeIds })
      });

      if (res.ok) {
        const reply = await res.json();
        setAssignMessage(`Successful deployment! Dispatched test assignments to ${finalEmployeeIds.length} candidate(s).`);
        setSelectedEmpIds([]);
        setSelectedTestId("");
        onRefreshAll();
      } else {
        const errorData = await res.json();
        setAssignError(errorData.detail || errorData.error || "Deployment failed.");
      }
    } catch (e) {
      setAssignError("Deployment transaction failed.");
    }
  }

  function getTestStatusBadge(status: TestStatus, passed?: boolean) {
    switch (status) {
      case TestStatus.COMPLETED:
        return passed 
          ? "bg-green-500/10 text-emerald-600 border border-green-500/20" 
          : "bg-rose-500/10 text-rose-600 border border-rose-500/20";
      case TestStatus.IN_PROGRESS:
        return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
      default:
        return "bg-slate-100 text-slate-600 border border-slate-200/60";
    }
  }

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          Test Assessment Assignment Desk
          <span className="text-xs bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full border border-indigo-550/15">
            Deployment Module
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Assign skill evaluations. Dispatch to single employees, custom candidate groups, or globally. Track participant exam execution limits and outcomes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Create Campaign Assignment Card */}
        <div className="lg:col-span-5 h-fit text-xs space-y-6">
          <form onSubmit={handleAssign} className={`rounded-xl bg-white border border-slate-200 p-6 space-y-5 shadow-sm`}>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ClipboardList className="text-indigo-500 h-4.5 w-4.5" />
              <h3 className="text-sm font-extrabold text-slate-900">Deploy Assessment Campaign</h3>
            </div>

            {assignError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 font-semibold rounded-lg">
                {assignError}
              </div>
            )}

            {assignMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 font-semibold rounded-lg">
                {assignMessage}
              </div>
            )}

            {/* Test select */}
            <div>
              <label className="text-slate-700 font-bold block mb-1">Select Assessment Template</label>
              <select
                required
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="">-- Choose Quiz Standard --</option>
                {activePublishedTests.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.questions.length} Qs • {t.duration} mins)</option>
                ))}
              </select>
            </div>

            {/* Target type selection */}
            <div>
              <label className="text-slate-700 font-bold block mb-1.5">Group Assignment Criteria</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: "multiple", label: "Select Employees", desc: "Select specific" },
                  { id: "all", label: "All Employees", desc: "Select all candidates" }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTargetType(item.id as any);
                      setSelectedEmpIds([]);
                    }}
                    className={`p-2.5 rounded border text-center transition-all cursor-pointer ${
                      targetType === item.id 
                        ? "bg-indigo-50 border-indigo-500 text-indigo-600 font-black shadow-sm" 
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-bold text-[11px]">{item.label}</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Employee lists selections conditional */}
            {targetType !== "all" && (
              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Select Targeted Candidates</label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto divide-y divide-slate-200 scrollbar-thin">
                  {activeEmployees.length === 0 ? (
                    <p className="p-4 text-center text-slate-500 font-mono">No active employees on file.</p>
                  ) : (
                    activeEmployees.map(emp => {
                      const isChecked = selectedEmpIds.includes(emp.id);
                      return (
                        <div 
                          key={emp.id} 
                          className="flex items-center gap-2.5 py-1.5 cursor-pointer hover:bg-slate-100"
                          onClick={() => handleToggleEmpSelect(emp.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="rounded bg-white border-slate-350 text-indigo-500 focus:ring-0 h-3.5 w-3.5 accent-indigo-600 pointer-events-none"
                          />
                          <div className="truncate text-left leading-tight">
                            <p className="font-bold text-slate-800">{emp.name}</p>
                            <span className="text-[9px] text-slate-500 font-mono">{emp.email}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white font-bold text-xs py-2.5 rounded-lg shadow-md transition-all cursor-pointer uppercase"
            >
              Deploy Test Campaign
            </button>
          </form>

          {/* Configure Default Onboarding Test Card */}
          <form onSubmit={handleSaveDefault} className={`rounded-xl bg-white border border-slate-200 p-6 space-y-5 shadow-sm`}>
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="text-indigo-500 h-4.5 w-4.5" />
              <h3 className="text-sm font-extrabold text-[#0A2540]">Configure Default Onboarding Test</h3>
            </div>

            <p className="text-[11px] text-slate-650 leading-relaxed">
              Define the default test that will be automatically assigned to newly created employees. Existing employees will not be affected.
            </p>

            {defaultError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 font-semibold rounded-lg">
                {defaultError}
              </div>
            )}

            {defaultMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 font-semibold rounded-lg">
                {defaultMessage}
              </div>
            )}

            <div>
              <label className="text-slate-700 font-bold block mb-1">Select Default Test</label>
              <select
                value={defaultTestId}
                onChange={(e) => setDefaultTestId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="none">-- No Default Test (None) --</option>
                {activePublishedTests.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.questions.length} Qs • {t.duration} mins)</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSavingDefault}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white font-bold text-xs py-2.5 rounded-lg shadow-md transition-all cursor-pointer uppercase disabled:opacity-50"
            >
              {isSavingDefault ? "Saving Settings..." : "Save Default Test"}
            </button>
          </form>
        </div>

        {/* Right Side: Tracking List Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className={`rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm`}>
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700">
              <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-indigo-500" /> Active Assessments Trace</span>
              <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-mono">{assignedTests.length} Campaigns</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50/60 text-slate-600 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                    <th className="p-3.5 pl-6">Participant</th>
                    <th className="p-3.5">Assigned Assessment</th>
                    <th className="p-3.5">Interactive Status</th>
                    <th className="p-3.5 text-right pr-6">Campaign Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedTests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-400 font-medium leading-tight">
                        No active assessment records in queue. Utilize the console on the left to deploy.
                      </td>
                    </tr>
                  ) : (
                    assignedTests.map((record) => {
                      const empUser = employees.find(e => e.id === record.employeeId);
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3.5 pl-6">
                            <div className="font-bold text-slate-900">{empUser ? empUser.name : "N/A Employee"}</div>
                            <span className="text-[10px] text-slate-500 font-mono italic">{empUser ? empUser.email : "Unassigned"}</span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800">{record.testName}</div>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {record.testId.substring(0, 10)}</span>
                          </td>
                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-full font-extrabold uppercase text-[9px] ${
                              getTestStatusBadge(record.status, record.passed)
                            }`}>
                              {record.status === TestStatus.COMPLETED 
                                ? (record.passed ? "✔ PASSED" : "✘ FAILED") 
                                : record.status.replace("_", " ")}
                            </span>
                            <span className="block text-[9px] text-slate-500 font-mono mt-1 font-semibold whitespace-nowrap">
                              {formatTimeAgo(record, empUser)}
                            </span>
                          </td>
                          <td className="p-3.5 text-right pr-6">
                            {record.status === TestStatus.COMPLETED ? (
                              <div className="leading-tight">
                                <span className="font-mono text-emerald-600 font-black text-xs">{record.score}% score</span>
                                <p className="text-[9px] text-slate-500 font-mono">Passing: {record.passingMarks}%</p>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic font-semibold text-[10px]">Pending exam</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

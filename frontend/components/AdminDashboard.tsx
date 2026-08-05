import React, { useState, useEffect } from "react";
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  PieChart, 
  Activity, 
  ChevronRight, 
  CheckCheck,
  TrendingUp,
  FileCheck2,
  Lock,
  Unlock,
  AlertCircle
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { User, Application, AssignedTest, ActivityLog, UserStatus, TestStatus } from "../types";

interface AdminDashboardProps {
  employees: User[];
  applications: Application[];
  assignedTests: AssignedTest[];
  activityLogs: ActivityLog[];
  onSelectTab: (tab: string) => void;
}

export default function AdminDashboard({
  employees,
  applications,
  assignedTests,
  activityLogs,
  onSelectTab
}: AdminDashboardProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  // Metrics calculation
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === UserStatus.ACTIVE).length;
  const inactiveEmployees = employees.filter(e => e.status === UserStatus.INACTIVE).length;

  const submittedApps = applications.filter(a => a.status === "submitted").length;
  const approvedApps = applications.filter(a => a.status === "approved").length;
  const pendingApps = applications.filter(a => a.status === "submitted" || a.status === "draft").length;

  const totalAssigned = assignedTests.length;
  const completedAssigned = assignedTests.filter(t => t.status === TestStatus.COMPLETED).length;

  const passedCount = assignedTests.filter(t => t.status === TestStatus.COMPLETED && t.passed).length;
  const failedCount = assignedTests.filter(t => t.status === TestStatus.COMPLETED && !t.passed).length;

  // Chart interactivity states
  const [hoveredProductIndex, setHoveredProductIndex] = useState<number | null>(null);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  // Cards layout configuration
  const statCards = [
    { title: "Total Employees", value: totalEmployees, sub: `${activeEmployees} active`, icon: Users, color: "from-blue-600 to-indigo-500", shadow: "shadow-blue-500/10" },
    { title: "Active Accounts", value: activeEmployees, sub: `${inactiveEmployees} de-active`, icon: Unlock, color: "from-emerald-500 to-teal-500", shadow: "shadow-emerald-500/10" },
    { title: "Inactive/Suspended", value: inactiveEmployees, sub: "Disabled list", icon: Lock, color: "from-slate-600 to-slate-800", shadow: "shadow-slate-500/10" },
    { title: "Onboarding Profiles", value: applications.length, sub: `${submittedApps} Submitted`, icon: FileText, color: "from-cyan-500 to-blue-400", shadow: "shadow-cyan-500/10" },
    { title: "Pending Reviews", value: pendingApps, sub: "Awaiting approval", icon: Clock, color: "from-amber-500 to-orange-400", shadow: "shadow-amber-500/10" },
    { title: "Tests Assigned", value: totalAssigned, sub: "Across all campaigns", icon: Layers, color: "from-purple-600 to-indigo-500", shadow: "shadow-purple-500/10" },
    { title: "Tests Completed", value: completedAssigned, sub: `${totalAssigned - completedAssigned} remaining`, icon: CheckCheck, color: "from-indigo-500 to-pink-500", shadow: "shadow-pink-500/10" },
    { title: "Passed Employees", value: passedCount, sub: "Score criteria met", icon: CheckCircle2, color: "from-green-500 to-emerald-500", shadow: "shadow-emerald-500/10" },
    { title: "Failed Assessment List", value: failedCount, sub: "Under grading score", icon: XCircle, color: "from-rose-500 to-red-400", shadow: "shadow-rose-500/10" }
  ];

  // Simulated chart coordinates
  const passFailData = [
    { name: "Passed", value: passedCount, color: "#10b981", percent: completedAssigned > 0 ? Math.round((passedCount / completedAssigned) * 100) : 0 },
    { name: "Failed", value: failedCount, color: "#ef4444", percent: completedAssigned > 0 ? Math.round((failedCount / completedAssigned) * 100) : 0 },
    { name: "Unfinished", value: totalAssigned - completedAssigned, color: "#a855f7", percent: totalAssigned > 0 ? Math.round(((totalAssigned - completedAssigned) / totalAssigned) * 100) : 0 }
  ];

  // Monthly activity coordinates (line graph)
  const monthlyActivityCoordinates = [
    { month: "Jan", val: 5 },
    { month: "Feb", val: 14 },
    { month: "Mar", val: 28 },
    { month: "Apr", val: 42 },
    { month: "May", val: 68 },
    { month: "Jun", val: 95 }
  ];

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Visual Title Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/5 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A2540] tracking-tight flex items-center gap-2">
            Company Command Overview
            <span className="text-xs font-mono font-medium tracking-tight bg-cyan-500/15 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-500/25">
              Enterprise Dashboard
            </span>
          </h1>
          <p className="text-xs text-slate-700 mt-1">
            Real-time compliance analytics, test assessment results, and onboarding timelines for AgentOps Labs.
          </p>
        </div>
      </div>

      {/* Grid STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9 gap-4">
        {statCards.map((card, idx) => {
          const IconComp = card.icon;
          return (
            <div 
              key={idx}
              className={`xl:col-span-3 rounded-xl ${cardBg} p-5 flex items-center justify-between hover:scale-[1.01] hover:border-slate-400 transition-all duration-300 relative group overflow-hidden`}
            >
              {/* Abs hover color bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#0A2540]">
                  {card.title}
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1.5">
                  {card.value}
                  <span className="text-[10px] text-slate-600 font-mono tracking-tight font-medium">units</span>
                </h3>
                <p className="text-[10px] text-slate-700 mt-0.5 font-semibold">
                  {card.sub}
                </p>
              </div>
              <div className="bg-slate-500/10 dark:bg-slate-800/45 p-2 px-3.5 rounded-xl text-slate-750 dark:text-slate-300">
                <IconComp className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive GRAPHS Row (Aesthetic SVGs with hover tooltips) */}
      <div className="max-w-3xl mx-auto w-full">
        {/* Graph 1: Pass vs Fail Grade Division (SVG Donut Chart representation) */}
        <div className={`rounded-xl ${cardBg} overflow-hidden border border-slate-200/5 dark:border-slate-850/40 shadow-xl`}>
          <div className={`p-5 ${cardHeaderBg} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <PieChart className="text-indigo-400 h-4.5 w-4.5" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">Certification Grade Divisions</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Auto Evaluated Results</span>
          </div>
          <div className="p-6 flex flex-col sm:flex-row items-center justify-center gap-8">
            {/* Interactive SVG Pie */}
            <div className="relative h-44 w-44 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                {/* Seed default background circle */}
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#101726" strokeWidth="12" />
                
                {/* Simple stacked visualization */}
                {/* Total test completed = passedCount + failedCount */}
                {/* Draw Passed segment */}
                <circle 
                  cx="50" cy="50" r="38" 
                  fill="transparent" 
                  stroke="#10b981" 
                  strokeWidth={hoveredProductIndex === 0 ? "15" : "11"} 
                  strokeDasharray={`${completedAssigned > 0 ? (passedCount / totalAssigned) * 238 : 0} 238`}
                  strokeDashoffset="0"
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredProductIndex(0)}
                  onMouseLeave={() => setHoveredProductIndex(null)}
                />

                {/* Draw Failed segment */}
                <circle 
                  cx="50" cy="50" r="38" 
                  fill="transparent" 
                  stroke="#ef4444" 
                  strokeWidth={hoveredProductIndex === 1 ? "15" : "11"} 
                  strokeDasharray={`${completedAssigned > 0 ? (failedCount / totalAssigned) * 238 : 30} 238`}
                  strokeDashoffset={`-${completedAssigned > 0 ? (passedCount / totalAssigned) * 238 : 30}`}
                  className="transition-all cursor-pointer animate-pulse"
                  onMouseEnter={() => setHoveredProductIndex(1)}
                  onMouseLeave={() => setHoveredProductIndex(null)}
                />

                {/* Draw Unfinished segment */}
                <circle 
                  cx="50" cy="50" r="38" 
                  fill="transparent" 
                  stroke="#6366f1" 
                  strokeWidth={hoveredProductIndex === 2 ? "15" : "11"} 
                  strokeDasharray={`${totalAssigned > 0 ? ((totalAssigned - completedAssigned) / totalAssigned) * 238 : 40} 238`}
                  strokeDashoffset={`-${totalAssigned > 0 ? ((passedCount + failedCount) / totalAssigned) * 238 : 80}`}
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredProductIndex(2)}
                  onMouseLeave={() => setHoveredProductIndex(null)}
                />
              </svg>
              {/* Core Text card of Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">Completed</span>
                <span className="text-2xl font-black text-slate-900">{completedAssigned}</span>
                <span className="text-[10px] text-slate-700 font-mono">of {totalAssigned} assigned</span>
              </div>
            </div>

            {/* Labels and statistics legend */}
            <div className="flex-1 space-y-3.5">
              {passFailData.map((lbl, idx) => (
                <div 
                  key={idx}
                  className={`p-2.5 rounded-lg border transition-all ${
                    hoveredProductIndex === idx 
                      ? 'bg-slate-500/10 dark:bg-purple-500/10 border-indigo-500/40 text-slate-900 dark:text-whiteScale translate-x-1' 
                      : 'bg-[#0f111a]/40 dark:bg-[#121624]/60 border-slate-205/10 dark:border-slate-800/70'
                  }`}
                  onMouseEnter={() => setHoveredProductIndex(idx)}
                  onMouseLeave={() => setHoveredProductIndex(null)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-2 text-xs font-bold text-[#0A2540]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lbl.color }} />
                      {lbl.name} Standard
                    </span>
                    <span className="text-xs font-mono font-black" style={{ color: lbl.color }}>
                      {lbl.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800/80 h-1 mt-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ backgroundColor: lbl.color, width: `${lbl.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recents Rows: Pending Applications */}
      <div className="max-w-3xl mx-auto w-full">
        {/* Submitted Applications Box */}
        <div className={`rounded-xl ${cardBg} overflow-hidden border border-slate-200/5 dark:border-slate-850/40 shadow-xl`}>
          <div className={`p-5 ${cardHeaderBg} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <FileCheck2 className="text-cyan-600 h-4 w-4" />
              <h4 className="text-sm font-extrabold text-[#0A2540]">Pending Candidate submissions</h4>
            </div>
            <button 
              onClick={() => onSelectTab("admin-employees")}
              className="text-[10px] text-[#3b82f6] hover:text-[#06b6d4] font-black uppercase flex items-center gap-1 cursor-pointer"
            >
              Verify Stack <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="p-1 max-h-80 overflow-y-auto">
            {applications.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">No onboarding applications started yet.</p>
            ) : (
              <div className="divide-y divide-slate-200/40 dark:divide-slate-800/50">
                {applications.map((app, index) => (
                  <div key={index} className="p-4 flex items-center justify-between hover:bg-slate-500/5 transition-all text-xs">
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-slate-100">{app.fullName || "Draft Profile"}</h5>
                      <span className="text-[10px] text-slate-700 font-mono">{app.email}</span>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[9px] bg-slate-200 px-2 py-0.2 rounded font-mono text-slate-700 border border-slate-300">
                          {app.highestQualification || "Unspecified Degree"}
                        </span>
                        <span className="text-[9px] bg-indigo-500/10 text-indigo-700 border border-indigo-500/15 px-2 py-0.2 rounded font-mono font-bold">
                          Passing: {app.yearOfPassing || "Pending"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        app.status === "submitted" 
                          ? "bg-yellow-500/15 text-yellow-850 text-yellow-800 border border-yellow-500/25" 
                          : app.status === "approved"
                          ? "bg-green-500/15 text-green-850 text-green-800 border border-green-500/25"
                          : "bg-slate-200 text-slate-700 border border-slate-300"
                      }`}>
                        {app.status}
                      </span>
                      <p className="text-[9px] text-slate-700 font-mono mt-1">
                        Updated {new Date(app.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

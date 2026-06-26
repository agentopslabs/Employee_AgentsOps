import React, { useState, useEffect } from "react";
import { 
  FileText, 
  BookOpen, 
  CheckCircle, 
  Award, 
  Bell, 
  Play, 
  ArrowRight, 
  AlertTriangle,
  Clock,
  ThumbsUp,
  XCircle,
  HelpCircle,
  X
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { 
  Application, 
  AssignedTest, 
  SystemNotification, 
  ApplicationStatus, 
  TestStatus 
} from "../types";

interface EmployeeDashboardProps {
  application: Application | null;
  assignedTests: AssignedTest[];
  notifications: SystemNotification[];
  onSelectTab: (tab: string) => void;
  onStartTest: (testRecord: AssignedTest) => void;
  defaultTestId?: string;
}

export default function EmployeeDashboard({
  application,
  assignedTests,
  notifications,
  onSelectTab,
  onStartTest,
  defaultTestId
}: EmployeeDashboardProps) {
  const adminTheme = useTheme();

  const appStatus = application ? application.status : ApplicationStatus.NOT_STARTED;
  const isEligibleForTest = appStatus === ApplicationStatus.SUBMITTED || appStatus === ApplicationStatus.APPROVED;

  // Pop-up states for default test assignment notification
  const [showAssignedPopup, setShowAssignedPopup] = useState(false);
  const [popupTest, setPopupTest] = useState<AssignedTest | null>(null);

  useEffect(() => {
    if (isEligibleForTest && assignedTests.length > 0) {
      // Find the first assigned test that is the DEFAULT test, is not started, and hasn't had its popup acknowledged yet
      const pendingTest = assignedTests.find(
        t => t.status === TestStatus.NOT_STARTED && t.isDefaultOnboardingTest === true
      );
      if (pendingTest) {
        const hasShown = sessionStorage.getItem(`popup_shown_${pendingTest.id}`);
        if (!hasShown) {
          setPopupTest(pendingTest);
          setShowAssignedPopup(true);
        }
      }
    }
  }, [assignedTests, isEligibleForTest]);

  const handleClosePopup = () => {
    if (popupTest) {
      sessionStorage.setItem(`popup_shown_${popupTest.id}`, "true");
    }
    setShowAssignedPopup(false);
  };

  const handleStartTestFromPopup = () => {
    if (popupTest) {
      sessionStorage.setItem(`popup_shown_${popupTest.id}`, "true");
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      onStartTest(popupTest);
    }
    setShowAssignedPopup(false);
  };

  // Stats
  const totalAssigned = assignedTests.length;
  const completedAssigned = assignedTests.filter(t => t.status === TestStatus.COMPLETED).length;
  const pendingAssigned = totalAssigned - completedAssigned;

  // Latest Outcome Evaluator
  const completedList = assignedTests
    .filter(t => t.status === TestStatus.COMPLETED)
    .sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA; // descending
    });

  const latestResult = completedList.length > 0 ? completedList[0] : null;
  const passStatusCleared = completedList.length > 0 && completedList.every(t => t.passed);

  // Status Badge Label Helper
  function getAppStatusLabel(status: ApplicationStatus) {
    switch (status) {
      case ApplicationStatus.APPROVED:
        return { text: "Approved", style: "bg-emerald-50 text-emerald-700 border border-emerald-250 border-emerald-200" };
      case ApplicationStatus.REJECTED:
        return { text: "Rejected", style: "bg-rose-50 text-rose-700 border border-rose-250 border-rose-200" };
      case ApplicationStatus.SUBMITTED:
        return { text: "Submitted", style: "bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]" };
      case ApplicationStatus.DRAFT:
        return { text: "Draft Profile", style: "bg-slate-50 text-slate-700 border border-slate-200" };
      default:
        return { text: "Not Started", style: "bg-amber-50 text-amber-700 border border-amber-200" };
    }
  }

  const appBadge = getAppStatusLabel(appStatus);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Onboarding Desk & Workspace</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete your onboarding stages safely. Submit the entry details form to unlock qualification credentials.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 font-medium">
          <Clock className="h-4 w-4 text-slate-450" />
          <span>Onboarding Campaign: active</span>
        </div>
      </div>

      {/* STATS CARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-sans">
        
        {/* Stat 1: Application Status */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Application Status</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${appBadge.style} mt-1`}>
              {appBadge.text}
            </span>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-none">Submission Eligibility</p>
          </div>
        </div>

        {/* Stat 2: Assigned Tests Count */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Certs</span>
            <BookOpen className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-mono mt-1">{totalAssigned}</h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-none">{pendingAssigned} exams outstanding</p>
          </div>
        </div>

        {/* Stat 3: Completed Tests Count */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed Exams</span>
            <CheckCircle className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-mono mt-1">{completedAssigned}</h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-none">Graded evaluations</p>
          </div>
        </div>

        {/* Stat 4: Latest Test Result */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest Score</span>
            <Award className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-mono mt-1">
              {latestResult ? `${latestResult.score}%` : "None"}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 leading-none truncate" title={latestResult ? latestResult.testName : "No exam history"}>
              {latestResult ? latestResult.testName : "No exam history"}
            </p>
          </div>
        </div>

        {/* Stat 5: Pass/Fail Clear Status */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Final Verification</span>
            <ThumbsUp className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
              completedList.length === 0 
                ? "bg-slate-50 text-slate-600 border border-slate-200" 
                : passStatusCleared 
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}>
              {completedList.length === 0 ? "UNKNOWN" : passStatusCleared ? "PASSED" : "FAILED"}
            </span>
            <p className="text-[10px] text-slate-400 mt-1 px-0.5 leading-none">Onboarding criteria</p>
          </div>
        </div>

      </div>

      {/* Profiling Lock Alert Disclaimer */}
      {!isEligibleForTest && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-slate-800 text-xs leading-relaxed flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Action Needed: Submission Pending</h4>
            <p className="text-slate-600 mt-0.5">
              Your onboarding candidate profile state is currently marked as {appStatus.toUpperCase().replace('_', ' ')}. You of course cannot initiate test processes until basic profile details has been submitted.
            </p>
          </div>
          <button
            onClick={() => onSelectTab("employee-application")}
            className="sm:ml-auto flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
          >
            Complete Form Now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* RESULTS SECTIONS */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Left Side: Latest Assessment Widget & Assessment History */}
        <div className="space-y-6">
          
          {/* Latest Assessment Widget Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
            <div className="p-4 px-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Latest Assessment Grade</h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">Evaluated</span>
            </div>

            <div className="p-5">
              {latestResult ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Exam</span>
                    <h4 className="text-sm font-bold text-slate-850 text-slate-800 truncate" title={latestResult.testName}>{latestResult.testName}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">Completed Date: {latestResult.completedAt ? new Date(latestResult.completedAt).toLocaleDateString() : "N/A"}</p>
                  </div>

                  <div className="space-y-1 flex flex-col md:items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block md:text-center">Evaluation Score</span>
                      <div className="flex items-baseline gap-1 mt-0.5 md:justify-center">
                        <span className="text-2xl font-black text-slate-800 font-mono">{latestResult.score}%</span>
                        <span className="text-slate-455 text-slate-450 font-mono text-[11px]">Score</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end">
                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 self-start md:self-auto">Status Outcome</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider p-1 px-3 rounded-full flex items-center gap-1 leading-none ${
                      latestResult.passed 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-250 border-emerald-200" 
                        : "bg-rose-50 text-rose-700 border border-rose-250 border-rose-200"
                    }`}>
                      {latestResult.passed ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-emerald-600" />
                          Passed
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-rose-600" />
                           Failed
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-405 text-slate-400">
                  <Award className="h-8 w-8 mx-auto text-slate-350 opacity-40 mb-2" />
                  <span>No completed exam achievements logged to your onboard profile.</span>
                </div>
              )}
            </div>
          </div>

          {/* Assessment History Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
            <div className="p-4 px-5 bg-slate-50 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Assessment History Logs</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[10px] text-slate-400 uppercase font-black tracking-wider">
                    <th className="p-4 px-5">Test Name</th>
                    <th className="p-4">Assigned At</th>
                    <th className="p-4">Completed At</th>
                    <th className="p-4">Graded Score</th>
                    <th className="p-4 px-5">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 divide-slate-100 text-slate-700">
                  {assignedTests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-450 text-slate-400 font-medium bg-white">
                        No assigned assessments compiled.
                      </td>
                    </tr>
                  ) : (
                    assignedTests.map(test => {
                      const isDone = test.status === TestStatus.COMPLETED;
                      const hasStarted = test.status === TestStatus.IN_PROGRESS;
                      return (
                        <tr key={test.id} className="hover:bg-slate-50 transition duration-150">
                          <td className="p-4 px-5 font-bold text-slate-900 truncate max-w-[180px]" title={test.testName}>
                            {test.testName}
                          </td>
                          <td className="p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {test.startedAt ? new Date(test.startedAt).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="p-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {isDone && test.completedAt ? new Date(test.completedAt).toLocaleDateString() : "-"}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-800">
                            {isDone ? `${test.score}%` : "-"}
                          </td>
                          <td className="p-4 px-5">
                            <span className={`inline-block text-[10px] font-bold uppercase ${
                              isDone
                                ? (test.passed ? "text-emerald-600" : "text-rose-600")
                                : hasStarted
                                ? "text-amber-600 animate-pulse"
                                : "text-slate-500"
                            }`}>
                              {isDone 
                                ? (test.passed ? "✔ Passed" : "✘ Failed") 
                                : hasStarted 
                                ? "In Progress" 
                                : "Not Started"
                              }
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

      </div>
    </div>

      {/* Default Test Assignment Popup Modal */}
      {showAssignedPopup && popupTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-[#F1B814] rounded-3xl p-9 max-w-lg w-full mx-4 shadow-2xl relative space-y-7 animate-scale-in">
            {/* Close Icon Button */}
            <button 
              onClick={handleClosePopup}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Premium Icon Badge */}
            <div className="mx-auto h-16 w-16 bg-[#F1B814]/10 border border-[#F1B814]/20 rounded-2xl flex items-center justify-center">
              <Award className="h-8 w-8 text-[#F1B814] animate-bounce" />
            </div>

            {/* Notification content */}
            <div className="text-center space-y-3">
              <h2 className="text-xl font-black text-[#0A2540] tracking-tight uppercase">Onboarding Test Assigned</h2>
              <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                Since you completed submitting your onboarding application profile, you have been automatically assigned the default evaluation test:
              </p>
              <div className="p-5 bg-amber-50 border-2 border-amber-250 border-amber-200 rounded-2xl font-black text-amber-950 text-base mt-3 shadow-inner">
                {popupTest.testName}
              </div>
            </div>

            {/* Warning Instructions */}
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 text-xs text-rose-850 space-y-3 text-left">
              <div className="flex items-center gap-2 font-black text-rose-950 text-sm uppercase">
                <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 animate-pulse" />
                Critical Assessment Instructions:
              </div>
              <ul className="list-disc list-inside space-y-2 pl-1 leading-relaxed font-medium">
                <li>If you change browser tabs, switch active windows, or navigate to other screens or apps, your test will be <strong>submitted automatically</strong>.</li>
                <li>There is <strong>no option to retake or restart</strong> the test. You can only attempt this assessment once.</li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3.5 pt-2">
              <button
                onClick={handleStartTestFromPopup}
                className="w-full bg-gradient-to-r from-[#F1B814] to-[#f7cc4b] hover:from-[#f7cc4b] hover:to-[#F1B814] text-slate-950 font-black py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-center uppercase tracking-widest text-sm"
              >
                Begin Assessment Now
              </button>
              <button
                onClick={handleClosePopup}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold py-4 rounded-2xl transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer text-center text-sm"
              >
                Take Later (Go to Dashboard)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

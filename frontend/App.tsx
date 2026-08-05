import React, { useState, useEffect, useRef } from "react";
import { ThemeProvider } from "./components/ThemeContext";
import Login from "./components/Login";
import DashboardLayout from "./components/DashboardLayout";

// Admin Views
import AdminDashboard from "./components/AdminDashboard";
import AdminEmployeeManagement from "./components/AdminEmployeeManagement";
import AdminDocuments from "./components/AdminDocuments";
import AdminTests from "./components/AdminTests";
import AdminTestAssignment from "./components/AdminTestAssignment";
import AdminReports from "./components/AdminReports";
import AdminTasks from "./components/AdminTasks";
import AdminAttendance from "./components/AdminAttendance";

// Employee Views
import EmployeeDashboard from "./components/EmployeeDashboard";
import ApplicationForm from "./components/ApplicationForm";
import EmployeeProfile from "./components/EmployeeProfile";
import EmployeeAssignedTests from "./components/EmployeeAssignedTests";
import EmployeeTasks from "./components/EmployeeTasks";
import EmployeeAttendance from "./components/EmployeeAttendance";

// Testing View Overlay
import AssessmentModule from "./components/AssessmentModule";
import PasswordResetPage from "./components/PasswordResetPage";
import MessageCenter from "./components/MessageCenter";

import { 
  User, 
  UserRole, 
  Application, 
  EmployeeDocument, 
  Test, 
  AssignedTest, 
  EmailRecord, 
  SystemNotification, 
  ActivityLog,
  TestStatus
} from "./types";

export default function App() {
  // Authentication state
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem("agentops_jwt"));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Secure Password Reset state parsed from email link redirection
  const [resetTokenFromUrl, setResetTokenFromUrl] = useState<string | null>(null);
  const [resetEmailFromUrl, setResetEmailFromUrl] = useState<string | null>(null);

  // Active Tab/Navigation State
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("agentops_active_tab") || "admin-analytics";
  });

  // Auxiliary state updater tracking
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Loaded Database State Collections
  const [employees, setEmployees] = useState<User[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [assignedTests, setAssignedTests] = useState<AssignedTest[]>([]);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [defaultTestId, setDefaultTestId] = useState<string>("test-system-safety");

  const [activeExamRecord, setActiveExamRecord] = useState<AssignedTest | null>(null);
  const [activeExamTemplate, setActiveExamTemplate] = useState<Test | null>(null);
  const justEndedExamIdRef = useRef<string | null>(null);

  function triggerRefreshFn() {
    setRefreshTrigger(p => p + 1);
  }

  // Safe JSON wrapper to survive dev refreshes & fallback pages
  async function safeJson(response: Response, fallback: any = null) {
    if (!response.ok) return fallback;
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("application/json")) {
      return fallback;
    }
    try {
      const text = await response.text();
      if (!text || text.trim().startsWith("<") || text.trim().startsWith("<!")) {
        return fallback;
      }
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  // Core API loader
  async function refreshDataPool() {
    if (!authToken) return;
    const tokenAtStart = authToken;

    try {
      const headers = { "Authorization": `Bearer ${authToken}` };

      // Multi-gather
      const [
        resMe,
        resUsers,
        resApps,
        resDocs,
        resTests,
        resAssigned,
        resEmails,
        resNotifs,
        resLogs,
        resSettings
      ] = await Promise.all([
        fetch("/api/auth/me", { headers }),
        fetch("/api/users", { headers }),
        fetch("/api/applications", { headers }),
        fetch("/api/documents", { headers }),
        fetch("/api/tests", { headers }),
        fetch("/api/assigned-tests", { headers }),
        fetch("/api/emails", { headers }),
        fetch("/api/notifications", { headers }),
        fetch("/api/activity-logs", { headers }),
        fetch("/api/settings", { headers })
      ]);

      if (authToken !== tokenAtStart) return;

      const mePayload = await safeJson(resMe);
      if (mePayload && mePayload.id) {
        setCurrentUser(mePayload);
      } else if (resMe.status === 401 || resMe.status === 403) {
        let reason = "Your authentication session has expired. For your safety, please sign in again.";
        if (resMe.status === 401) {
          reason = "Session expired or invalid credential token (401 Unauthorized). Please sign in again.";
        } else if (resMe.status === 403) {
          reason = "Your account does not have authorization, or access was revoked (403 Forbidden). Please sign in again.";
        }
        handleLogout(reason);
        return;
      }

      const usersArr = await safeJson(resUsers);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(usersArr)) setEmployees(usersArr);

      const appsArr = await safeJson(resApps);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(appsArr)) setApplications(appsArr);

      const docsArr = await safeJson(resDocs);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(docsArr)) setDocuments(docsArr);

      const testsArr = await safeJson(resTests);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(testsArr)) setTests(testsArr);

      const assignedArr = await safeJson(resAssigned);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(assignedArr)) setAssignedTests(assignedArr);

      const emailsArr = await safeJson(resEmails);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(emailsArr)) setEmails(emailsArr);

      const notifsArr = await safeJson(resNotifs);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(notifsArr)) setNotifications(notifsArr);

      const logsArr = await safeJson(resLogs);
      if (authToken !== tokenAtStart) return;
      if (Array.isArray(logsArr)) setActivityLogs(logsArr);

      const settingsPayload = await safeJson(resSettings);
      if (authToken !== tokenAtStart) return;
      if (settingsPayload && settingsPayload.defaultTestId) {
        setDefaultTestId(settingsPayload.defaultTestId);
      }

    } catch (e) {
      console.error("Data syncing error:", e);
    }
  }

  // Listen for secure password reset links containing URL hash tokens
  useEffect(() => {
    function parseResetTokenHash() {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#reset-token=")) {
        const parts = hash.substring(1).split("&");
        let token = "";
        let email = "";
        parts.forEach(part => {
          const [key, val] = part.split("=");
          if (key === "reset-token") {
            token = val;
          } else if (key === "email") {
            email = decodeURIComponent(val);
          }
        });

        if (token) {
          setResetTokenFromUrl(token);
          setResetEmailFromUrl(email);
          // Logging out ensures there is no session overlap
          handleLogout();
        }
      }
    }

    parseResetTokenHash();
    window.addEventListener("hashchange", parseResetTokenHash);
    return () => {
      window.removeEventListener("hashchange", parseResetTokenHash);
    };
  }, []);

  // Handle bootstrap mount verification checks
  useEffect(() => {
    let active = true;
    async function initCheck() {
      if (authToken) {
        const tokenAtStart = authToken;
        try {
          const res = await fetch("/api/auth/me", {
            headers: { "Authorization": `Bearer ${authToken}` }
          });
          const user = await safeJson(res);
          if (!active || authToken !== tokenAtStart) return;
          if (user && user.id) {
            setCurrentUser(user);
            const savedTab = localStorage.getItem("agentops_active_tab");
            if (user.role === UserRole.ADMIN) {
              if (savedTab && savedTab.startsWith("admin-")) {
                setActiveTab(savedTab);
              } else {
                setActiveTab("admin-analytics");
              }
            } else {
              if (savedTab && savedTab.startsWith("employee-")) {
                setActiveTab(savedTab);
              } else {
                setActiveTab("employee-dashboard");
              }
            }
          } else if (res.status === 401 || res.status === 403) {
            const reason = res.status === 401 
              ? "Your local credential token has expired (Unauthorized 401). Please sign in to establish a new session."
              : "Access to this candidate profile has been disabled (Forbidden 403). Contact your Administrator.";
            handleLogout(reason);
          } else {
            handleLogout(`An unexpected server state occurred (Status ${res.status}). Please sign in again.`);
          }
        } catch (e) {
          console.error(e);
          if (active && authToken === tokenAtStart) {
            handleLogout("Connection to the server failed. Please verify that the server is online.");
          }
        }
      }
      if (active) {
        setCheckingAuth(false);
      }
    }

    initCheck();
    return () => {
      active = false;
    };
  }, [authToken]);

  // Persist activeTab to localStorage when updated
  useEffect(() => {
    if (activeTab) {
      localStorage.setItem("agentops_active_tab", activeTab);
    }
  }, [activeTab]);

  // Keep activeTab in sync with the currentUser's role to prevent role-based tab mismatches (e.g. "Admin View Omitted")
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === UserRole.ADMIN) {
        if (!activeTab.startsWith("admin-")) {
          setActiveTab("admin-analytics");
        }
      } else {
        if (!activeTab.startsWith("employee-")) {
          setActiveTab("employee-dashboard");
        }
      }
    }
  }, [currentUser, activeTab]);


  // Handle loading other auxiliary pools once authenticated
  useEffect(() => {
    if (currentUser && authToken) {
      refreshDataPool();
      // Establish background poll rate
      const interval = setInterval(refreshDataPool, 8000); // 8 seconds fetch sync rate
      return () => clearInterval(interval);
    }
  }, [currentUser, authToken, refreshTrigger]);

  // Set active testing overrides
  useEffect(() => {
    if (currentUser && assignedTests.length > 0) {
      const activeRunningExam = assignedTests.find(
        t => t.employeeId === currentUser.id && t.status === TestStatus.IN_PROGRESS
      );
      if (activeRunningExam && activeRunningExam.id !== justEndedExamIdRef.current) {
        if (!activeExamRecord || activeExamRecord.id !== activeRunningExam.id) {
          const template = tests.find(t => t.id === activeRunningExam.testId);
          if (template) {
            setActiveExamRecord(activeRunningExam);
            setActiveExamTemplate(template);
          }
        }
      }
    }
  }, [assignedTests, currentUser, tests]);

  function handleLoginSuccess(user: User, token: string) {
    localStorage.setItem("agentops_jwt", token);
    setAuthToken(token);
    setCurrentUser(user);
    setAuthError(null);
    const defaultTab = user.role === UserRole.ADMIN ? "admin-analytics" : "employee-dashboard";
    setActiveTab(defaultTab);
    localStorage.setItem("agentops_active_tab", defaultTab);
  }

  function handleLogout(errorMessage?: string) {
    localStorage.removeItem("agentops_jwt");
    localStorage.removeItem("agentops_active_tab");
    
    // Clear popup shown keys on logout from both localStorage and sessionStorage
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("popup_shown_")) {
        localStorage.removeItem(key);
      }
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("popup_shown_")) {
        sessionStorage.removeItem(key);
      }
    }

    setAuthToken(null);
    setCurrentUser(null);
    setActiveExamRecord(null);
    setActiveExamTemplate(null);
    if (errorMessage && typeof errorMessage === "string") {
      setAuthError(errorMessage);
    } else {
      setAuthError(null);
    }
  }

  // Handle manual start test from dashboard click
  async function handleLaunchTest(assignedRecord: AssignedTest) {
    justEndedExamIdRef.current = null;

    // 1. Instantly transition states locally so the test module mounts with 0ms visual latency
    const template = tests.find(t => t.id === assignedRecord.testId);
    if (template) {
      const localStartedRecord: AssignedTest = {
        ...assignedRecord,
        status: TestStatus.IN_PROGRESS,
        startedAt: new Date().toISOString(),
        remainingTime: assignedRecord.remainingTime || (template.duration * 60),
        answers: assignedRecord.answers || {}
      };
      setAssignedTests(prev => prev.map(t => t.id === localStartedRecord.id ? localStartedRecord : t));
      setActiveExamRecord(localStartedRecord);
      setActiveExamTemplate(template);
    }

    // 2. Perform the server POST synchronization in the background
    try {
      const res = await fetch(`/api/assigned-tests/${assignedRecord.id}/start`, {
        method: "POST"
      });
      if (res.ok) {
        const startedRecord = await res.json();
        // Update states silently with the official synchronized server record
        setAssignedTests(prev => prev.map(t => t.id === startedRecord.id ? startedRecord : t));
        setActiveExamRecord(startedRecord);
      }
      refreshDataPool();
    } catch (e) {
      console.error("Failed to start test on backend:", e);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-slate-500">
        <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
        <span>Initializing AgentOps Security Protocols...</span>
      </div>
    );
  }

  if (resetTokenFromUrl) {
    return (
      <ThemeProvider>
        <PasswordResetPage 
          token={resetTokenFromUrl} 
          email={resetEmailFromUrl || ""} 
          onClose={() => {
            setResetTokenFromUrl(null);
            setResetEmailFromUrl(null);
            window.location.hash = "";
          }}
        />
      </ThemeProvider>
    );
  }

  if (!currentUser || !authToken) {
    return (
      <ThemeProvider>
        <Login onLoginSuccess={handleLoginSuccess} initialError={authError} />
      </ThemeProvider>
    );
  }

  // Is candidate currently taking an active assessment exam?
  if (activeExamRecord && activeExamTemplate) {
    return (
      <ThemeProvider>
        <AssessmentModule
          testRecord={activeExamRecord}
          testTemplate={activeExamTemplate}
          onSubmitted={() => {
            justEndedExamIdRef.current = activeExamRecord.id;
            setActiveExamRecord(null);
            setActiveExamTemplate(null);
            setActiveTab("employee-dashboard");
            refreshDataPool();
          }}
          onExit={() => {
            justEndedExamIdRef.current = activeExamRecord.id;
            setActiveExamRecord(null);
            setActiveExamTemplate(null);
            refreshDataPool();
          }}
        />
      </ThemeProvider>
    );
  }

  // Filter lists specifically for the current employee session
  const myApplication = applications.find(a => a.employeeId === currentUser.id) || null;
  const myAssignedTests = assignedTests.filter(t => t.employeeId === currentUser.id);
  const myNotifications = notifications.filter(n => n.employeeId === currentUser.id && n.type !== "info");

  // Render components conditionally based on tabs click states
  function renderTabPanel() {
    if (currentUser?.role === UserRole.ADMIN) {
      switch (activeTab) {
        case "admin-analytics":
          return (
            <AdminDashboard 
              employees={employees}
              applications={applications}
              assignedTests={assignedTests}
              activityLogs={activityLogs}
              onSelectTab={setActiveTab}
            />
          );
        case "admin-employees":
          return (
            <AdminEmployeeManagement 
              employees={employees}
              onRefreshAll={refreshDataPool}
            />
          );
        case "admin-documents":
          return (
            <AdminDocuments 
              employees={employees}
              applications={applications}
              onRefreshAll={refreshDataPool}
            />
          );
        case "admin-tests":
          return (
            <AdminTests 
              tests={tests}
              onRefreshAll={refreshDataPool}
            />
          );
        case "admin-assignments":
          return (
            <AdminTestAssignment 
              tests={tests}
              employees={employees}
              assignedTests={assignedTests}
              onRefreshAll={refreshDataPool}
            />
          );
        case "admin-reports":
          return (
            <AdminReports 
              employees={employees}
              applications={applications}
              documents={documents}
              assignedTests={assignedTests}
            />
          );
        case "admin-tasks":
          return (
            <AdminTasks 
              employees={employees}
              onRefreshAll={refreshDataPool}
            />
          );
        case "admin-attendance":
          return (
            <AdminAttendance 
              employees={employees}
              onRefreshAll={refreshDataPool}
            />
          );
        case "admin-messages":
          return (
            <MessageCenter 
              currentUser={currentUser}
              employees={employees}
              onRefreshAll={refreshDataPool}
            />
          );
        default:
          return <p className="text-xs text-slate-505 text-center">Admin View Omitted</p>;
      }
    } else {
      // Employee Portal
      switch (activeTab) {
        case "employee-dashboard":
          return (
            <EmployeeDashboard 
              application={myApplication}
              assignedTests={myAssignedTests}
              notifications={myNotifications}
              onSelectTab={setActiveTab}
              onStartTest={handleLaunchTest}
              defaultTestId={defaultTestId}
            />
          );
        case "employee-application":
          return (
            <ApplicationForm 
              currentUser={currentUser}
              application={myApplication}
              onRefreshAll={refreshDataPool}
              onSelectTab={setActiveTab}
            />
          );
        case "employee-profile":
          return (
            <EmployeeProfile 
              currentUser={currentUser}
              application={myApplication}
              onRefreshAll={refreshDataPool}
            />
          );
        case "employee-tests":
          const isEligible = myApplication && (myApplication.status === "submitted" || myApplication.status === "approved");
          return (
            <EmployeeAssignedTests 
              assignedTests={myAssignedTests}
              tests={tests}
              onStartTest={handleLaunchTest}
              isEligible={!!isEligible}
              onSelectTab={setActiveTab}
            />
          );
        case "employee-tasks":
          return (
            <EmployeeTasks 
              currentUser={currentUser}
              onRefreshAll={refreshDataPool}
            />
          );
        case "employee-attendance":
          return (
            <EmployeeAttendance 
              currentUser={currentUser}
              onRefreshAll={refreshDataPool}
            />
          );
        case "employee-messages":
          return (
            <MessageCenter 
              currentUser={currentUser}
              employees={employees}
              onRefreshAll={refreshDataPool}
            />
          );
        default:
          return <p className="text-xs text-slate-505 text-center font-mono">Employee Tab Not Implemented</p>;
      }
    }
  }

  return (
    <ThemeProvider>
      <DashboardLayout
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        refreshTrigger={refreshTrigger}
        triggerRefreshFn={triggerRefreshFn}
      >
        {renderTabPanel()}
      </DashboardLayout>
    </ThemeProvider>
  );
}

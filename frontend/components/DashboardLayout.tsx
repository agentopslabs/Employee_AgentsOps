import React, { useState, useEffect } from "react";
import { 
  useTheme 
} from "./ThemeContext";
import { 
  User, 
  UserRole, 
  SystemNotification 
} from "../types";
import { 
  LogOut, 
  Bell, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Mail, 
  Settings, 
  Users, 
  FileText, 
  BookOpen, 
  UserCheck, 
  BarChart3, 
  FileCheck, 
  Database,
  Terminal,
  Activity,
  AlertTriangle,
  Clock,
  Sparkles,
  ClipboardList,
  Calendar
} from "lucide-react";
import Logo from "./Logo";
import SimulatedEmailClient from "./SimulatedEmailClient";

interface DashboardLayoutProps {
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  refreshTrigger: number;
  triggerRefreshFn: () => void;
}

export default function DashboardLayout({
  currentUser,
  onLogout,
  activeTab,
  setActiveTab,
  children,
  refreshTrigger,
  triggerRefreshFn
}: DashboardLayoutProps) {
  const { isDark, toggleTheme, glassBg, glassBorder, textPrimary, textSecondary, sidebarBg } = useTheme();
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showEmailDrawer, setShowEmailDrawer] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll notifications
  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && !contentType.includes("application/json")) {
          return;
        }
        const text = await res.text();
        if (!text || text.trim().startsWith("<") || text.trim().startsWith("<!")) {
          return;
        }
        const data = JSON.parse(text);
        // Filter for specific user or administrative notifications
        const filtered = data.filter((n: SystemNotification) => {
          if (n.type === "info") {
            return false;
          }
          if (currentUser.role === UserRole.ADMIN) {
            // Admin sees notifications with no employeeId (system level / admin alerts) or targeting admin
            return !n.employeeId || n.employeeId.startsWith("admin");
          } else {
            // Employee only gets notifications matching their specific employeeId
            return n.employeeId === currentUser.id;
          }
        });
        setNotifications(filtered);
        setUnreadCount(filtered.filter((n: SystemNotification) => !n.isRead).length);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    fetchNotifications();
    
    // Auto-poll notifications every 8 seconds for responsive simulation
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, [currentUser, refreshTrigger]);

  async function handleClearNotifications() {
    try {
      await fetch("/api/notifications/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id })
      });
      fetchNotifications();
      if (typeof triggerRefreshFn === "function") {
        triggerRefreshFn();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleNotificationClick(notif: SystemNotification) {
    const isAdmin = currentUser.role === UserRole.ADMIN;
    let destTab = "";
    const title = (notif.title || "").toLowerCase();
    const message = (notif.message || "").toLowerCase();

    if (isAdmin) {
      if (title.includes("application") || message.includes("application")) {
        destTab = "admin-applications";
      } else if (title.includes("document") || message.includes("document") || title.includes("certificate") || message.includes("certificate") || title.includes("doc")) {
        destTab = "admin-documents";
      } else if (title.includes("task") || message.includes("task") || title.includes("submission") || message.includes("submission") || message.includes("solution")) {
        destTab = "admin-tasks";
      } else if (title.includes("attendance") || message.includes("attendance") || title.includes("leave") || message.includes("leave")) {
        destTab = "admin-attendance";
      } else if (title.includes("test") || message.includes("test") || title.includes("exam") || message.includes("exam") || title.includes("assessment") || message.includes("assessment")) {
        destTab = "admin-test-assignment";
      } else if (title.includes("message") || message.includes("message") || title.includes("broadcast") || message.includes("broadcast")) {
        destTab = "admin-messages";
      } else {
        destTab = "admin-employees";
      }
    } else {
      if (title.includes("message") || message.includes("message") || title.includes("broadcast") || message.includes("broadcast") || title.includes("hr message")) {
        destTab = "employee-messages";
      } else if (title.includes("assessment") || message.includes("assessment") || title.includes("exam") || message.includes("exam") || title.includes("test") || message.includes("test")) {
        destTab = "employee-assessments";
      } else if (title.includes("document") || message.includes("document") || title.includes("doc") || message.includes("doc")) {
        destTab = "employee-documents";
      } else if (title.includes("task") || message.includes("task") || title.includes("coding") || message.includes("coding")) {
        destTab = "employee-tasks";
      } else if (title.includes("attendance") || message.includes("attendance") || title.includes("leave") || message.includes("leave")) {
        destTab = "employee-attendance";
      } else if (title.includes("profile") || message.includes("profile") || title.includes("credentials") || message.includes("credentials")) {
        destTab = "employee-profile";
      } else {
        destTab = "employee-dashboard";
      }
    }

    try {
      await fetch(`/api/notifications/${notif.id}`, {
        method: "DELETE"
      });
      fetchNotifications();
      if (typeof triggerRefreshFn === "function") {
        triggerRefreshFn();
      }
    } catch (err) {
      console.error("Failed to delete clicked notification:", err);
    }

    if (destTab) {
      setActiveTab(destTab);
    }
    setShowNotifDropdown(false);
  }

  // Admin and Employee navigation tabs
  const adminNav = [
    { id: "admin-analytics", label: "Analytics Overview", icon: BarChart3 },
    { id: "admin-employees", label: "Employee Accounts", icon: Users },
    { id: "admin-documents", label: "Document Management", icon: FileCheck },
    { id: "admin-tasks", label: "Task Assignment", icon: ClipboardList },
    { id: "admin-tests", label: "Test Configuration", icon: BookOpen },
    { id: "admin-assignments", label: "Test Assignment", icon: UserCheck },
    { id: "admin-reports", label: "Compliance Reports", icon: FileText },
    { id: "admin-attendance", label: "Attendance & Leaves", icon: Calendar },
    { id: "admin-messages", label: "Send Message", icon: Mail }
  ];

  const employeeNav = [
    { id: "employee-dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "employee-application", label: "Application Form", icon: FileText },
    { id: "employee-tasks", label: "Tasks Dashboard", icon: ClipboardList },
    { id: "employee-profile", label: "Profile", icon: Settings },
    { id: "employee-tests", label: "Assigned Tests", icon: BookOpen },
    { id: "employee-attendance", label: "Attendance & Leaves", icon: Calendar },
    { id: "employee-messages", label: "Messages", icon: Mail }
  ];

  const activeNav = currentUser.role === UserRole.ADMIN ? adminNav : employeeNav;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col md:flex-row font-sans selection:bg-indigo-500/20 relative">
      {/* Dynamic Animated Glowing Backdrops */}
      {isDark ? (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 mesh-gradient opacity-100" />
      ) : (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-slate-100" />
      )}

      {/* Main Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-72 h-full transform transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 flex-shrink-0 ${sidebarBg} flex flex-col justify-between overflow-y-scroll ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-white/10 bg-black/15">
            <Logo isDarkBg={true} />
            <button className="md:hidden text-slate-300 hover:text-white cursor-pointer" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Connected User Profile Card */}
          <div className="p-4 mx-3 my-4 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md text-sm">
                {currentUser.name.split(' ').map(n=>n[0]).join('')}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            </div>
            <div className="truncate flex-1">
              <h4 className="text-xs font-bold text-white truncate">{currentUser.name}</h4>
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-[#F1B814] mt-0.5">
                Role: {currentUser.role}
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="px-3 space-y-1.5">
            {activeNav.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold transition-all relative overflow-hidden group ${
                    isSelected 
                      ? "text-white bg-white/10 border-l-4 border-[#F1B814]" 
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <IconComp className={`h-4.5 w-4.5 ${isSelected ? 'text-[#F1B814]' : 'text-slate-400 group-hover:text-slate-100'}`} />
                  <span>{item.label}</span>
                  {isSelected && (
                    <span className="absolute right-2 text-[8px] opacity-70 animate-pulse text-[#F1B814]">●</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area with Mail Simulation PEAK & Signout */}
        <div className="p-4 border-t border-white/10 bg-black/15 space-y-2">
          {/* Email Server Drawer Button */}
          <button
            onClick={() => setShowEmailDrawer(!showEmailDrawer)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-[#F1B814] hover:text-[#f7cc4b] bg-[#F1B814]/10 hover:bg-[#F1B814]/15 py-1.5 px-3 rounded-md border border-[#F1B814]/25 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              SMTP Simulator Logs
            </span>
            <span className="bg-[#F1B814] text-slate-950 font-mono scale-90 px-1.5 py-0.2 rounded font-extrabold">Active</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 hover:bg-rose-500/15 text-slate-305 text-slate-300 hover:text-rose-400 rounded-lg text-xs font-bold border border-transparent hover:border-rose-500/10 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
          
          <div className="flex items-center justify-between gap-1 text-[9px] text-slate-400 mt-2 font-mono px-1">
            <span>AgentOps Workspace</span>
            <span>v1.2.0</span>
          </div>
        </div>
      </aside>      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 z-10 relative overflow-hidden">
        {/* Universal Header */}
        <header className="h-20 bg-[#0A2540] border-b border-white/10 flex items-center justify-between px-6 md:px-8 z-20 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-350 hover:text-white cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                {currentUser.role === UserRole.ADMIN ? "Admin Command" : "Employee Portal"}
                <span className="h-1.5 w-1.5 rounded-full bg-[#F1B814] animate-ping" />
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                {activeTab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 rounded-full text-slate-350 hover:text-white hover:bg-white/10 transition-colors cursor-pointer relative"
                title="Notifications"
              >
                <Bell className="h-5 w-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-3.5 w-3.5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-3 w-80 bg-[#0c1a30]/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#081324]">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <Bell className="h-3.5 w-3.5 text-[#F1B814] -mt-0.5" /> Alerts & logs
                    </span>
                    {notifications.length > 0 && (
                      <button 
                        onClick={handleClearNotifications}
                        className="text-[9px] text-[#F1B814] hover:underline font-black uppercase cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs font-medium">
                        No active notifications.
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          className="p-3.5 hover:bg-white/5 transition-colors text-left cursor-pointer border-l-2 border-transparent hover:border-[#F1B814]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded font-mono ${
                              notif.type === 'success' 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : notif.type === 'alert' || notif.type === 'warning'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-550/20'
                                : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                            }`}>
                              {notif.type || 'info'}
                            </span>
                            <span className="text-[8px] text-slate-400 font-mono">
                              {new Date(notif.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <h5 className="text-[11px] font-extrabold text-white mt-1.5 leading-tight">{notif.title}</h5>
                          <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed font-mono">{notif.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Outbound SMTP Client drawer toggle at bottom */}
        {showEmailDrawer && (
          <div className="px-6 md:px-8 pt-4 pb-2 bg-indigo-500/5 border-b border-indigo-500/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-indigo-400 flex items-center gap-1">
                <Terminal className="h-3.5 w-3.5" /> 📬 Simulated Multi-Role SMTP Relay Console
              </span>
              <button 
                onClick={() => setShowEmailDrawer(false)}
                className="text-[10px] text-slate-500 hover:text-red-400 font-black cursor-pointer uppercase"
              >
                Close Logs [X]
              </button>
            </div>
            <SimulatedEmailClient 
              userId={currentUser.id} 
              userEmail={currentUser.email} 
              triggerRefresh={refreshTrigger} 
            />
          </div>
        )}

        {/* Dynamic Screen Injector */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto relative scrollbar-thin z-10">
          {children}
        </main>
      </div>
    </div>
  );
}

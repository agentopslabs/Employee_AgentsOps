import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Edit, 
  ChevronRight, 
  X, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Plus, 
  User, 
  BookOpen, 
  Paperclip, 
  HelpCircle,
  TrendingUp,
  MapPin,
  Calendar,
  Lock,
  ExternalLink,
  GraduationCap,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { 
  User as EmployeeUser, 
  UserRole, 
  UserStatus, 
  Application, 
  EmployeeDocument, 
  AssignedTest, 
  ChecklistItem, 
  ActivityLog, 
  DocumentStatus,
  ApplicationStatus,
  TestStatus
} from "../types";
import DocumentPreviewModal from "./DocumentPreviewModal";
import { triggerDocumentDownload } from "../lib/downloadHelper";

interface AdminEmployeeManagementProps {
  employees: EmployeeUser[];
  onRefreshAll: () => void;
}

export default function AdminEmployeeManagement({
  employees,
  onRefreshAll
}: AdminEmployeeManagementProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  // Selected employee states
  const [selectedEmp, setSelectedEmp] = useState<EmployeeUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Create employee Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  // Credentials Output State inside Modal
  const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; pass: string } | null>(null);

  // Edit employee States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<EmployeeUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editStatus, setEditStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [editPassword, setEditPassword] = useState("");

  // Safe alerts and confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    type: "deregister" | "reset_credentials";
    empId: string;
    message: string;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Complete Detailed Profile loaded on selection
  const [appDetails, setAppDetails] = useState<Application | null>(null);
  const [docDetails, setDocDetails] = useState<EmployeeDocument[]>([]);
  const [testDetails, setTestDetails] = useState<AssignedTest[]>([]);
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [logsList, setLogsList] = useState<ActivityLog[]>([]);

  // Checklist adding
  const [newChkText, setNewChkText] = useState("");
  const [newChkCategory, setNewChkCategory] = useState<"application" | "documents" | "assessments" | "approval">("application");

  // Error/Success statuses
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.mobile.includes(searchTerm);
    const matchesStatus = filterStatus === "all" || emp.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Fetch full employee details when user is clicked
  async function fetchEmployeeDetailedProfile(empId: string) {
    try {
      // 1. Fetch Application profile
      const appRes = await fetch(`/api/applications/${empId}`);
      if (appRes.ok) {
        const ad = await appRes.json();
        setAppDetails(ad.status === "not_started" ? null : ad);
      }

      // 2. Fetch docs
      const docRes = await fetch(`/api/documents/${empId}`);
      if (docRes.ok) {
        setDocDetails(await docRes.json());
      }

      // 3. Fetch test assigned results
      const testRes = await fetch(`/api/assigned-tests/${empId}`);
      if (testRes.ok) {
        setTestDetails(await testRes.json());
      }

      // 4. Fetch checklist items
      const chkRes = await fetch(`/api/checklists/${empId}`);
      if (chkRes.ok) {
        setChecklist(await chkRes.json());
      }

      // 5. Fetch activity logs
      const logsRes = await fetch("/api/activity-logs");
      if (logsRes.ok) {
        const allLogs: ActivityLog[] = await logsRes.json();
        setLogsList(allLogs.filter(l => l.employeeId === empId));
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (selectedEmp) {
      fetchEmployeeDetailedProfile(selectedEmp.id);
    }
  }, [selectedEmp, employees]);

  // Create account
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    if (!newName || !newEmail || !newMobile) {
      setActionError("All configuration parameters are required.");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, email: newEmail, mobile: newMobile, password: newPassword })
      });

      if (!res.ok) {
        const err = await res.json();
        setActionError(err.detail || err.error || "Failed to create employee.");
        return;
      }

      const reply = await res.json();
      setGeneratedCredentials({
        email: reply.user.email,
        pass: reply.password
      });

      // Reset Form fields
      setNewName("");
      setNewEmail("");
      setNewMobile("");
      setNewPassword("");
      // Refresh immediately to show the new employee
      onRefreshAll();
      // Also retry after 2 seconds to handle any Firestore propagation delay
      setTimeout(() => onRefreshAll(), 2000);
    } catch (e) {
      setActionError("Internal SMTP client dispatch failed.");
    }
  }

  // Update account
  async function handleUpdateEmp(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmp) return;

    try {
      const res = await fetch(`/api/users/${editingEmp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          mobile: editMobile,
          status: editStatus,
          password: editPassword
        })
      });

      if (res.ok) {
        setShowEditModal(false);
        setActionSuccess("Employee details saved successfully.");
        setEditPassword("");
        onRefreshAll();
        // If current selected profile matches editing profile, update selection too
        if (selectedEmp?.id === editingEmp.id) {
          const updated = await res.json();
          setSelectedEmp(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Admin resets employee password
  async function handleResetPassword(empId: string) {
    try {
      const res = await fetch(`/api/admin/users/${empId}/reset-password`, { method: "POST" });
      if (res.ok) {
        const reply = await res.json();
        setAlertModal({
          title: "Credentials Regenerated",
          message: `Credentials regenerated successfully! Temporary password was logged and dispatched to candidate inbox: ${reply.newPassword}`
        });
        onRefreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Delete employee
  async function handleDeleteUser(empId: string) {
    try {
      const res = await fetch(`/api/users/${empId}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedEmp(null);
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Checklist manipulation
  async function toggleCheck(itemId: string, currentVal: boolean) {
    try {
      const res = await fetch(`/api/checklists/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: !currentVal })
      });
      if (res.ok && selectedEmp) {
        fetchEmployeeDetailedProfile(selectedEmp.id);
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddCustomCheck() {
    if (!newChkText || !selectedEmp) return;
    try {
      const res = await fetch("/api/checklists/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmp.id,
          category: newChkCategory,
          text: newChkText
        })
      });
      if (res.ok) {
        setNewChkText("");
        fetchEmployeeDetailedProfile(selectedEmp.id);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteCheckItem(itemId: string) {
    try {
      await fetch(`/api/checklists/${itemId}`, { method: "DELETE" });
      if (selectedEmp) {
        fetchEmployeeDetailedProfile(selectedEmp.id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Document action shortcut inside profile
  async function handleReviewDoc(docId: string, status: "approved" | "rejected") {
    const remarks = status === "approved" ? "Verified" : prompt("Specify rejection reason for the candidate:");
    if (remarks === null) return; // cancelled

    try {
      const res = await fetch(`/api/documents/${docId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks })
      });
      if (res.ok && selectedEmp) {
        fetchEmployeeDetailedProfile(selectedEmp.id);
        onRefreshAll();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function getDocTypeName(type: string) {
    switch (type) {
      case "resume": return "Resume Brief";
      case "aadhaar": return "Aadhaar UID Card";
      case "pan": return "PAN Tax Code Card";
      case "photo": return "Passport Sized Photo";
      case "educational": return "Educational Degree Certs";
      case "experience": return "Experience Proof Letters";
      default: return type.toUpperCase();
    }
  }

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Title block */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/5 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-xl font-black text-[#0A2540] flex items-center gap-2">
            Employee Accounts Registry
            <span className="text-xs bg-indigo-500/15 text-indigo-755 text-indigo-700 border border-indigo-500/25 px-2 rounded-full font-mono font-medium">
              HR Module
            </span>
          </h1>
          <p className="text-xs text-slate-700 mt-1">
            Setup active employees, reset credentials, track onboarding checklists, study certifications, and audit candidate activity.
          </p>
        </div>
        <button
          onClick={() => {
            setGeneratedCredentials(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-md hover:shadow-indigo-500/20 hover:scale-[1.02] transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Provision Employee
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess("")} className="ml-auto text-emerald-400">[X]</button>
        </div>
      )}

      {/* Main Layout Grid split: Left list, Right full details sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Search list */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search candidates by name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-500/5 dark:bg-slate-950 border border-slate-200/20 dark:border-slate-800 text-xs py-2.5 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-500/5 dark:bg-slate-950 border border-slate-200/20 dark:border-slate-800 text-xs p-2 px-3 rounded-lg text-slate-800 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All States</option>
              <option value={UserStatus.ACTIVE}>Active Only</option>
              <option value={UserStatus.INACTIVE}>Inactive Only</option>
            </select>
          </div>

          <div className={`rounded-xl ${cardBg} border border-slate-200/30 dark:border-slate-800/80 overflow-hidden shadow-sm`}>
            <div className="p-3 bg-slate-950/20 border-b border-slate-800/60 flex items-center justify-between text-[11px] font-bold text-[#0A2540]">
              <span>Employee Directory List</span>
              <span>{filteredEmployees.length} on file</span>
            </div>
            <div className="divide-y divide-slate-200/50 dark:divide-slate-800/50 max-h-[500px] overflow-y-auto scrollbar-thin">
              {filteredEmployees.length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500">No matching employee records stored.</p>
              ) : (
                filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmp(emp)}
                    className={`p-4 flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-slate-500/5 ${selectedEmp?.id === emp.id ? 'bg-indigo-500/5 border-l-4 border-indigo-500' : ''}`}
                  >
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{emp.name}</h4>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                          emp.status === UserStatus.ACTIVE 
                            ? "bg-emerald-500/10 text-emerald-400" 
                            : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {emp.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-700 font-mono truncate">{emp.email}</p>
                      <p className="text-[10px] text-slate-700 font-mono mt-0.5">{emp.mobile}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Edit click */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEmp(emp);
                          setEditName(emp.name);
                          setEditEmail(emp.email);
                          setEditMobile(emp.mobile);
                          setEditStatus(emp.status);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 hover:bg-slate-700/40 rounded text-slate-400 hover:text-white"
                        title="Edit Details"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            type: "reset_credentials",
                            empId: emp.id,
                            message: "Are you sure you want to regenerate and send new login credentials to this candidate?"
                          });
                        }}
                        className="p-1.5 hover:bg-slate-700/40 rounded text-slate-400 hover:text-cyan-400"
                        title="Reset Temp Pass"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmModal({
                            type: "deregister",
                            empId: emp.id,
                            message: "This will permanently drop the employee's candidate documents, submissions, assessments, and checklists. Proceed?"
                          });
                        }}
                        className="p-1.5 hover:bg-slate-700/40 rounded text-slate-400 hover:text-red-400"
                        title="Delete Permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Detailed Profile Sheet */}
        <div className="lg:col-span-7">
          {selectedEmp ? (
            <div className={`space-y-6 animate-fade-in`}>
              {/* Detailed personal card */}
              <div className={`rounded-xl ${cardBg} border border-slate-200/30 dark:border-slate-800/80 overflow-hidden`}>
                <div className="bg-slate-55 border-b border-slate-200 p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-indigo-100 border border-indigo-250 border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xl shadow-sm">
                      {selectedEmp.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        {selectedEmp.name}
                        <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-bold ${
                          selectedEmp.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {selectedEmp.status}
                        </span>
                      </h2>
                      <p className="text-[11px] text-slate-600 font-semibold mt-0.5">{selectedEmp.email}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1 font-medium"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Joined: {new Date(selectedEmp.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1 font-medium"><MapPin className="h-3.5 w-3.5 text-slate-400" /> ID: {selectedEmp.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmModal({
                        type: "reset_credentials",
                        empId: selectedEmp.id,
                        message: "Are you sure you want to regenerate and send new login credentials to this candidate?"
                      })}
                      className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-705 text-slate-700 font-bold py-1.5 px-3 rounded-lg transition shadow-sm cursor-pointer"
                    >
                      Reset Credentials
                    </button>
                    <button
                      onClick={() => setConfirmModal({
                        type: "deregister",
                        empId: selectedEmp.id,
                        message: "This will permanently drop the employee's candidate documents, submissions, assessments, and checklists. Proceed?"
                      })}
                      className="text-[10px] bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-750 text-rose-700 font-bold py-1.5 px-3 rounded-lg transition cursor-pointer"
                    >
                      Deregister
                    </button>
                  </div>
                </div>

                {/* Onboard checkmarks overview */}
                <div className="p-6 border-t border-slate-205/10 dark:border-slate-800/80">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800/40 pb-2">
                    <span className="text-xs font-black text-[#0A2540] flex items-center gap-1.5">
                      <ClipboardList className="h-4.5 w-4.5 text-cyan-600" /> State Onboarding Checklists
                    </span>
                    <span className="text-[10px] text-slate-700 font-mono">HR Verification Engine</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                    {/* Categories: Application & Documents */}
                    <div>
                      <h5 className="text-[11px] font-bold text-[#0A2540] uppercase tracking-widest mb-3.5">
                        📂 Profiles & Identities Checklist
                      </h5>
                      <div className="space-y-3">
                        {checklist.filter(c => c.category === "application" || c.category === "documents").map(item => (
                          <div key={item.id} className="flex items-center justify-between group">
                            <label className="flex items-center gap-2.5 text-xs text-slate-900 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={item.isCompleted}
                                onChange={() => toggleCheck(item.id, item.isCompleted)}
                                className="rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                              />
                              <span className={item.isCompleted ? "line-through text-slate-500 font-normal" : "text-slate-900 font-medium"}>{item.text}</span>
                            </label>
                            <button
                              onClick={() => handleDeleteCheckItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-[10px] transition"
                            >
                              [delete]
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Categories: Assessments & Approvals */}
                    <div>
                      <h5 className="text-[11px] font-bold text-[#0A2540] uppercase tracking-widest mb-3.5">
                        📝 Exams & HR Clearance Checklist
                      </h5>
                      <div className="space-y-3">
                        {checklist.filter(c => c.category === "assessments" || c.category === "approval").map(item => (
                          <div key={item.id} className="flex items-center justify-between group">
                            <label className="flex items-center gap-2.5 text-xs text-slate-900 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={item.isCompleted}
                                onChange={() => toggleCheck(item.id, item.isCompleted)}
                                className="rounded bg-white border-slate-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                              />
                              <span className={item.isCompleted ? "line-through text-slate-500 font-normal" : "text-slate-900 font-medium"}>{item.text}</span>
                            </label>
                            <button
                              onClick={() => handleDeleteCheckItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-[10px] transition"
                            >
                              [delete]
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Add customized checklist item */}
                  <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Add custom onboarding check card..."
                      value={newChkText}
                      onChange={(e) => setNewChkText(e.target.value)}
                      className="bg-white border border-slate-200 text-xs p-2 px-3 rounded-xl flex-1 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <select
                      value={newChkCategory}
                      onChange={(e) => setNewChkCategory(e.target.value as any)}
                      className="bg-white border border-slate-200 text-xs p-2 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="application">Application</option>
                      <option value="documents">Documents</option>
                      <option value="assessments">Assessments</option>
                      <option value="approval">Approval</option>
                    </select>
                    <button
                      onClick={handleAddCustomCheck}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs p-1.5 px-3 rounded flex items-center gap-1 justify-center transition"
                    >
                      <Plus className="h-3 w-3" /> Add Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Onboarding Profile Application detailed info */}
              <div className={`rounded-xl ${cardBg} border border-slate-205/10 dark:border-slate-800/80 p-6 space-y-4`}>
                <h4 className="text-xs font-bold text-[#0A2540] uppercase tracking-widest border-b border-slate-800/40 pb-2">
                  🎓 Candidate Education & Skills Details
                </h4>
                {appDetails ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                    <div className="space-y-2 leading-relaxed">
                      <p><span className="text-[#0A2540] font-bold block">Academic Degree:</span> <span className="text-slate-800 font-medium">{appDetails.highestQualification || "Not specified"}</span></p>
                      <p><span className="text-[#0A2540] font-bold block">College/University Name:</span> <span className="text-slate-800 font-medium">{appDetails.collegeName || "Not specified"}</span></p>
                      <p><span className="text-[#0A2540] font-bold block">Year of Passing:</span> <span className="text-indigo-650 text-indigo-700 font-bold">{appDetails.yearOfPassing || "Not specified"}</span></p>
                      <p><span className="text-[#0A2540] font-bold block">Cumulative GPA / Percentages:</span> <span className="text-slate-800 font-medium">{appDetails.percentageOrCgpa || "Not declared"}</span></p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <span className="text-[#0A2540] font-bold block mb-1">Technical Coding Core:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {appDetails.technicalSkills.map((ski, index) => (
                            <span key={index} className="bg-cyan-50 text-cyan-800 px-2.5 py-1 rounded-lg font-mono text-[10px] border border-cyan-200 font-bold">
                              {ski}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[#0A2540] font-bold block mb-1">Other Enterprise Traits:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {appDetails.otherSkills.map((ski, index) => (
                            <span key={index} className="bg-purple-50 text-purple-800 px-2.5 py-1 rounded-lg font-mono text-[10px] border border-purple-200 font-bold">
                              {ski}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[#0A2540] font-bold block mb-0.5">Application State</span>
                        <span className="text-yellow-700 font-mono font-bold uppercase text-[10px]">{appDetails.status}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 bg-slate-50 border border-slate-200 rounded-xl">
                    <GraduationCap className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Applicant hasn't filled or submitted the educational onboarding profile.</p>
                  </div>
                )}
              </div>

              {/* Uploaded Documents Lists */}
              <div className={`rounded-xl ${cardBg} border border-slate-200/30 dark:border-slate-800/80 p-6 space-y-4`}>
                <h4 className="text-xs font-bold text-[#0A2540] uppercase tracking-widest border-b border-slate-800/40 pb-2">
                  📎 Uploaded Compliance Certifications
                </h4>
                {docDetails.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 border border-slate-200 rounded-xl">No documents uploaded by this candidate yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {docDetails.map(doc => (
                      <div key={doc.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-2.5">
                          <Paperclip className="h-4 w-4 text-indigo-500" />
                          <div>
                            <h5 className="font-bold text-slate-800">{getDocTypeName(doc.type)}</h5>
                            <p className="text-[10px] text-slate-700 truncate max-w-[200px] font-mono leading-none mt-1 font-semibold">{doc.fileName} ({doc.fileSize})</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold uppercase rounded p-0.5 px-2 ${
                            doc.status === DocumentStatus.APPROVED 
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                              : doc.status === DocumentStatus.REJECTED 
                              ? "bg-rose-50 text-rose-700 border border-rose-200" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {doc.status}
                          </span>

                          <div className="flex gap-1.5">
                            {/* direct view button */}
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="text-[10px] bg-[#0A2540] hover:bg-slate-900 text-white font-bold p-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                            >
                              View Direct
                            </button>
                            {/* safe download */}
                            <button 
                              type="button"
                              onClick={() => triggerDocumentDownload(doc, selectedEmp.name)}
                              className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold p-1.5 px-3 rounded-lg transition cursor-pointer"
                            >
                              Download File
                            </button>
                            {doc.status === DocumentStatus.PENDING && (
                              <>
                                <button
                                  onClick={() => handleReviewDoc(doc.id, "approved")}
                                  className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold p-1.5 px-3 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReviewDoc(doc.id, "rejected")}
                                  className="text-[10px] bg-rose-50 border border-rose-200 text-rose-700 font-bold p-1.5 px-3 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assessment reports overview */}
              <div className={`rounded-xl ${cardBg} border border-slate-200/30 p-6 space-y-4`}>
                <h3 className="text-xs font-bold text-[#0A2540] uppercase tracking-widest border-b border-slate-100 pb-2">
                  📝 Quiz & Certification Assessments Records
                </h3>
                {testDetails.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 border border-slate-200 rounded-xl">No assessments assigned or completed by employee.</p>
                ) : (
                  <div className="space-y-4 text-xs">
                    {testDetails.map(record => (
                      <div key={record.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                            {record.testName}
                            <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                              record.status === TestStatus.COMPLETED 
                                ? "bg-cyan-50 text-cyan-700 border border-cyan-200" 
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {record.status}
                            </span>
                          </h4>
                          {record.status === TestStatus.COMPLETED && (
                            <div className="flex gap-3.5 text-slate-500 mt-1.5 font-mono text-[10px] leading-none font-semibold">
                              <p>Passing: {record.passingMarks}%</p>
                              <p>Answer Logs Updated</p>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {record.status === TestStatus.COMPLETED ? (
                            <>
                              <h3 className={`text-xl font-bold ${record.passed ? "text-emerald-600" : "text-rose-600"}`}>
                                {record.score}%
                              </h3>
                              <span className={`text-[9px] uppercase tracking-wide font-bold ${record.passed ? "text-emerald-600" : "text-rose-600"}`}>
                                {record.passed ? "PASSED" : "FAILED"}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-semibold italic">Quiz Not Taken</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


            </div>
          ) : (
            <div className={`h-full flex flex-col items-center justify-center p-12 text-center rounded-xl bg-slate-500/5 dark:bg-slate-950/40 border border-slate-200`}>
              <Users className="h-14 w-14 text-slate-700 animate-pulse mb-3" />
              <h3 className="text-[#0A2540] font-black text-sm">Detail Profile Viewer</h3>
              <p className="text-xs text-slate-700 max-w-[280px] mt-1 line-leading-tight">
                Select an employee from the directory sidebar on the left to see complete personal, educational, checkmarks, certifications, and assessment history.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PROVISION EMPLOYEE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative text-left">
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <UserPlus className="h-4.5 w-4.5 text-purple-400" /> Setup Employee Credentials
              </h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setGeneratedCredentials(null);
                  setActionError("");
                }} 
                className="text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {actionError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                  {actionError}
                </div>
              )}

              {generatedCredentials ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-lg leading-relaxed">
                    <p className="font-bold mb-1">🎉 SUCCESS! Account Generated.</p>
                    <p>Credentials logged and automated systems sent welcome email simulation to candidate on SMTP servers.</p>
                  </div>
                  <div className="p-4 bg-slate-950 font-mono text-xs rounded-lg border border-slate-800 space-y-2">
                    <p><span className="text-slate-500">Candidate Email:</span> <span className="text-cyan-400">{generatedCredentials.email}</span></p>
                    <p><span className="text-slate-500">Auto Password:</span> <span className="text-purple-405 font-bold text-slate-205">{generatedCredentials.pass}</span></p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setGeneratedCredentials(null);
                    }}
                    className="w-full bg-slate-800 text-white font-bold text-xs py-2 rounded-lg hover:bg-slate-700"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Employee Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rachel Green"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="rachel@agentops.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-slate-955 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Mobile Contact Phone</label>
                    <input
                      type="tel"
                      required
                      placeholder="+1 (555) 012-3456"
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Assign Login Password (Optional)</label>
                    <input
                      type="text"
                      placeholder="Leave blank to generate automatically"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs py-2.5 rounded-lg hover:from-blue-500 hover:to-indigo-500 cursor-pointer"
                  >
                    Generate Account & Email Credentials
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingEmp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-left">
            <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100">Edit Employee Specifications</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleUpdateEmp} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Employee Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Mobile Contact No</label>
                <input
                  type="text"
                  required
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold flex items-center gap-1.5">
                  Account System Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={UserStatus.ACTIVE}>Active / Clear to access</option>
                  <option value={UserStatus.INACTIVE}>Inactive / Deactivated</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-500" /> Overwrite Password (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to preserve current"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-slate-200 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-650 hover:bg-indigo-600 bg-indigo-600 text-white font-bold text-xs py-2.5 rounded-lg cursor-pointer"
              >
                Save Updates
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SAFE CONFIRMATION DIALOG MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-left space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                Require Confirmation
              </h4>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const { type, empId } = confirmModal;
                  setConfirmModal(null);
                  if (type === "reset_credentials") {
                    await handleResetPassword(empId);
                  } else if (type === "deregister") {
                    await handleDeleteUser(empId);
                  }
                }}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer ${
                  confirmModal.type === "deregister" ? "bg-red-650 hover:bg-red-600 bg-red-650 bg-red-600" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Document Preview overlay */}
      <DocumentPreviewModal 
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        candidateName={selectedEmp ? selectedEmp.name : "Candidate Profile"}
        isAdmin={true}
      />

      {/* SAFE INFO/ALERT DIALOG MODAL */}
      {alertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-left space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-cyan-400">
              <CheckCircle className="h-5 w-5" />
              <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                {alertModal.title}
              </h4>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed font-mono whitespace-pre-wrap bg-slate-950 p-4 rounded-xl border border-slate-800">
              {alertModal.message}
            </p>
            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setAlertModal(null)}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

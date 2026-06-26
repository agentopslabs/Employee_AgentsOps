import React, { useState, useEffect } from "react";
import { 
  ClipboardList, 
  Plus, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Download, 
  Check, 
  X, 
  Clock, 
  Users, 
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Trash2
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Task, TaskSubmission, User, UserRole, UserStatus } from "../types";

interface AdminTasksProps {
  employees: User[];
  onRefreshAll: () => void;
}

const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export default function AdminTasks({ employees, onRefreshAll }: AdminTasksProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  // Active View Tab inside Tasks Panel
  const [activeSubTab, setActiveSubTab] = useState<"assign" | "submissions" | "list">("assign");

  // Database Tasks and Submissions list
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  // Task Creation Form States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<"all" | "single">("all");
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; size: string; url: string }[]>([]);
  
  // Feedback states
  const [formSuccess, setFormSuccess] = useState("");
  const [formError, setFormError] = useState("");

  // Review states
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const activeEmployees = employees.filter(
    e => e.role === UserRole.EMPLOYEE && e.status === UserStatus.ACTIVE
  );

  async function fetchTasksAndSubmissions() {
    setLoading(true);
    try {
      const [resTasks, resSubs] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/tasks/submissions")
      ]);
      if (resTasks.ok) {
        const tasksData = await resTasks.json();
        setTasks(tasksData);
      }
      if (resSubs.ok) {
        const subsData = await resSubs.json();
        setSubmissions(subsData);
      }
    } catch (e) {
      console.error("Failed to load tasks and submissions:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasksAndSubmissions();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files) as File[];
      const newAttachments = [];
      for (const file of selectedFiles) {
        try {
          const base64Url = await convertToBase64(file);
          const sizeKb = (file.size / 1024).toFixed(1);
          newAttachments.push({
            name: file.name,
            size: `${sizeKb} KB`,
            url: base64Url
          });
        } catch (err) {
          console.error("File reading error:", err);
        }
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSuccess("");
    setFormError("");

    if (!title.trim() || !description.trim()) {
      setFormError("Task title and description are required.");
      return;
    }

    if (targetType === "single" && !selectedEmpId) {
      setFormError("Kindly choose an employee recipient to assign this task.");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      assignedTo: targetType === "all" ? "all" : selectedEmpId,
      files: attachments
    };

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFormSuccess("Task successfully deployed and dispatched!");
        setTitle("");
        setDescription("");
        setAttachments([]);
        setSelectedEmpId("");
        fetchTasksAndSubmissions();
        onRefreshAll();
      } else {
        const err = await res.json();
        setFormError(err.detail || "Task creation failed.");
      }
    } catch (err) {
      setFormError("A connection error occurred. Could not assign task.");
    }
  };

  const handleReviewSubmission = async (subId: string, status: "approved" | "rejected") => {
    const remarks = remarksMap[subId] || "";
    setActionLoadingId(subId);
    try {
      const res = await fetch(`/api/tasks/submissions/${subId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks })
      });

      if (res.ok) {
        setRemarksMap(prev => {
          const clone = { ...prev };
          delete clone[subId];
          return clone;
        });
        fetchTasksAndSubmissions();
        onRefreshAll();
      } else {
        const err = await res.json();
        alert(err.detail || "Action failed.");
      }
    } catch (e) {
      alert("Failed to contact server.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownload = (fileName: string, url: string) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to download file:", err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            Task Assignment & Reviews
            <span className="text-xs bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full border border-indigo-550/15">
              Task Desk
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assign workflow assignments directly or globally. Verify and approve employee submissions with custom review remarks.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/80">
          <button
            onClick={() => setActiveSubTab("assign")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "assign"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Create Task
          </button>
          <button
            onClick={() => setActiveSubTab("list")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === "list"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Assigned Tasks
          </button>
          <button
            onClick={() => setActiveSubTab("submissions")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer relative ${
              activeSubTab === "submissions"
                ? "bg-white text-indigo-650 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Submissions Review
            {submissions.filter(s => s.status === "pending").length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {submissions.filter(s => s.status === "pending").length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeSubTab === "assign" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <form onSubmit={handleAssignTask} className={`${cardBg} p-6 space-y-5 shadow-sm text-xs`}>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ClipboardList className="text-indigo-500 h-4.5 w-4.5" />
                <h3 className="text-sm font-extrabold text-slate-900">Define New Task Assignment</h3>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-650 text-red-600 font-semibold rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 font-semibold rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Title input */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Task Title</label>
                <input
                  type="text"
                  placeholder="e.g. Complete React Routing Challenge"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              {/* Description input */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Detailed Instructions</label>
                <textarea
                  placeholder="Specify task guidelines, expectations, submission checklist, and details..."
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-sans leading-relaxed"
                />
              </div>

              {/* Assignment Criteria */}
              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Assignment Targets</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTargetType("all")}
                    className={`p-2.5 rounded border text-center transition-all cursor-pointer ${
                      targetType === "all"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-600 font-black shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-bold text-[11px]">All Employees</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">Assign globally</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetType("single")}
                    className={`p-2.5 rounded border text-center transition-all cursor-pointer ${
                      targetType === "single"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-600 font-black shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div className="font-bold text-[11px]">Individual Employee</div>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">Targeted assignment</div>
                  </button>
                </div>
              </div>

              {/* Choose single employee */}
              {targetType === "single" && (
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Select Candidate Employee</label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer text-xs"
                  >
                    <option value="">-- Choose Employee User --</option>
                    {activeEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Task attachments upload */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Reference Attachments (Optional)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100/70 transition-all">
                    <div className="flex flex-col items-center justify-center pt-4 pb-4">
                      <Plus className="w-6 h-6 text-slate-400 mb-1" />
                      <p className="text-[10px] text-slate-500 font-bold">Click to upload PDFs, Images, CSVs, Docs...</p>
                      <p className="text-[8px] text-slate-400 mt-0.5">Supports any file type</p>
                    </div>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="font-bold text-slate-700">Uploaded Task Resources:</p>
                    <div className="divide-y divide-slate-150 border border-slate-200 rounded-lg overflow-hidden bg-white">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="h-4 w-4 text-indigo-550 flex-shrink-0" />
                            <span className="font-semibold text-slate-800 truncate">{file.name}</span>
                            <span className="text-[9px] text-slate-450 font-mono">({file.size})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white font-bold text-xs py-2.5 rounded-lg shadow-md transition-all cursor-pointer uppercase tracking-wider"
              >
                Deploy Task Assignment
              </button>
            </form>
          </div>

          {/* Guidelines info card */}
          <div className="lg:col-span-5 space-y-6">
            <div className={`${cardBg} p-6 border border-slate-200`}>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-500" /> Tasking Operations Guide
              </h4>
              <div className="space-y-3.5 text-[11px] text-slate-600 leading-relaxed">
                <p>
                  <strong>Global Broadcast:</strong> Setting target criteria to "All Employees" spawns this assignment for all current and future active employees.
                </p>
                <p>
                  <strong>Submissions Routing:</strong> When employees submit solutions, a system notification alerts the administrative panel. You can verify their answers in the <em>Submissions Review</em> sub-tab.
                </p>
                <p>
                  <strong>Attachment Handshakes:</strong> Reference files are saved in-memory and synced. Employees download these to get reference templates.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "list" && (
        <div className={`${cardBg} overflow-hidden shadow-sm`}>
          <div className={`${cardHeaderBg} p-4 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-700`}>
            <span className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4 text-indigo-500" /> Currently Deployed Assignments</span>
            <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded font-mono">{tasks.length} Active Tasks</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/60 text-slate-600 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                  <th className="p-3.5 pl-6">Task Title & ID</th>
                  <th className="p-3.5">Assigned Target</th>
                  <th className="p-3.5">Reference Documents</th>
                  <th className="p-3.5 text-right pr-6">Created On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-400 font-medium">
                      No tasks have been deployed yet. Use the Create Task form to dispatch a new one.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => {
                    const assignedUser = employees.find(e => e.id === task.assignedTo);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3.5 pl-6 max-w-xs">
                          <div className="font-bold text-slate-900 truncate" title={task.title}>{task.title}</div>
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5" title={task.description}>
                            {task.description}
                          </p>
                          <span className="text-[8px] text-slate-400 font-mono block mt-1">ID: {task.id}</span>
                        </td>
                        <td className="p-3.5">
                          {task.assignedTo === "all" ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold uppercase">
                              ALL EMPLOYEES
                            </span>
                          ) : (
                            <div className="leading-tight">
                              <span className="font-bold text-slate-800">{assignedUser?.name || "Unknown Employee"}</span>
                              <p className="text-[9px] text-slate-500 font-mono">{assignedUser?.email}</p>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5">
                          {task.files.length === 0 ? (
                            <span className="text-slate-400 italic">None attached</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {task.files.map((file, fIdx) => (
                                <button
                                  key={fIdx}
                                  onClick={() => handleDownload(file.name, file.url)}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] text-indigo-650 hover:bg-slate-100 transition cursor-pointer truncate"
                                  title={`Download ${file.name}`}
                                >
                                  <Download className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate max-w-[100px]">{file.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-right pr-6 font-mono text-[10px] text-slate-500">
                          {new Date(task.createdAt).toLocaleString()}
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

      {activeSubTab === "submissions" && (
        <div className="space-y-6">
          <h3 className="text-sm font-extrabold text-slate-900">Task Submissions Pipeline</h3>
          {submissions.length === 0 ? (
            <div className={`${cardBg} p-8 text-center text-slate-400 font-medium`}>
              No employee task submissions found in the database.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {submissions.map((sub) => {
                const associatedTask = tasks.find(t => t.id === sub.taskId);
                return (
                  <div key={sub.id} className={`${cardBg} border border-slate-200 overflow-hidden text-xs shadow-sm hover:border-slate-300 transition`}>
                    {/* Header */}
                    <div className="p-4 border-b border-slate-150 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {sub.employeeName}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {sub.employeeId}</span>
                        </div>
                        <p className="text-[10px] text-indigo-600 font-bold mt-0.5">
                          Task: {associatedTask ? associatedTask.title : `Unknown Task (${sub.taskId.substring(0, 8)})`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-450 font-mono">
                          Submitted: {new Date(sub.submittedAt).toLocaleString()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                          sub.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : sub.status === "rejected"
                            ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                            : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                      {/* Submitted Solution Text */}
                      <div className="space-y-1">
                        <span className="font-bold text-slate-700 block">Submitted Solution Text:</span>
                        <div className="p-3.5 rounded bg-slate-50 border border-slate-100 text-slate-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                          {sub.submittedText || <span className="text-slate-400 italic">No description text provided.</span>}
                        </div>
                      </div>

                      {/* Attachments */}
                      <div className="space-y-1">
                        <span className="font-bold text-slate-700 block">Uploaded Solution Deliverables:</span>
                        {sub.files && sub.files.length > 0 ? (
                          <div className="flex flex-wrap gap-2.5">
                            {sub.files.map((file, fIdx) => (
                              <button
                                key={fIdx}
                                onClick={() => handleDownload(file.name, file.url)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-indigo-650 hover:text-indigo-800 shadow-sm transition cursor-pointer"
                              >
                                <Download className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>{file.name}</span>
                                <span className="text-[9px] text-slate-400 font-mono">({file.size})</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">No attachments submitted.</p>
                        )}
                      </div>

                      {/* Review Remarks history */}
                      {sub.status !== "pending" && (
                        <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg space-y-1 text-[11px]">
                          <div className="flex items-center justify-between text-slate-650 font-bold">
                            <span>Review Status Logged</span>
                            <span className="font-mono text-[10px] text-slate-400">Reviewed At: {sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleString() : "N/A"}</span>
                          </div>
                          <p className="text-slate-800 font-medium">
                            <strong>Remarks:</strong> {sub.remarks || <span className="text-slate-400 italic">No remarks provided.</span>}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      {sub.status === "pending" && (
                        <div className="border-t border-slate-150 pt-4 mt-2 space-y-3">
                          <div>
                            <label className="text-slate-700 font-bold block mb-1">Verification Remarks / Feedback</label>
                            <input
                              type="text"
                              placeholder="e.g. Code passes audit. Approved onboarding clearance."
                              value={remarksMap[sub.id] || ""}
                              onChange={(e) => setRemarksMap(prev => ({ ...prev, [sub.id]: e.target.value }))}
                              className="w-full bg-white border border-slate-350 rounded p-2 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs"
                            />
                          </div>

                          <div className="flex justify-end gap-2.5">
                            <button
                              disabled={actionLoadingId === sub.id}
                              onClick={() => handleReviewSubmission(sub.id, "rejected")}
                              className="px-4 py-1.8 bg-rose-50 text-rose-600 border border-rose-200 rounded font-bold hover:bg-rose-100 transition cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject Submission
                            </button>
                            <button
                              disabled={actionLoadingId === sub.id}
                              onClick={() => handleReviewSubmission(sub.id, "approved")}
                              className="px-4 py-1.8 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded font-bold hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50 text-xs flex items-center gap-1"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Verify & Approve
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

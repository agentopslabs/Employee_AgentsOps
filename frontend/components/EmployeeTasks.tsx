import React, { useState, useEffect } from "react";
import { 
  ClipboardList, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Download, 
  Clock, 
  Send,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  ChevronRight
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Task, TaskSubmission, User } from "../types";

interface EmployeeTasksProps {
  currentUser: User;
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

export default function EmployeeTasks({ currentUser, onRefreshAll }: EmployeeTasksProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  // Tasks and Submissions list
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  // Active Task selected for submission
  const [activeSubmitTask, setActiveSubmitTask] = useState<Task | null>(null);

  // Submission Form States
  const [submittedText, setSubmittedText] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; size: string; url: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  async function fetchTasksAndSubmissions() {
    setLoading(true);
    try {
      const [resTasks, resSubs] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/tasks/submissions")
      ]);
      if (resTasks.ok) {
        const tasksData = await resTasks.json();
        // Filter tasks that are assigned to "all" or specifically to this employee
        const filteredTasks = tasksData.filter(
          (t: Task) => t.assignedTo === "all" || t.assignedTo === currentUser.id
        );
        setTasks(filteredTasks);
      }
      if (resSubs.ok) {
        const subsData = await resSubs.json();
        // Filter submissions made by this employee
        const filteredSubs = subsData.filter(
          (s: TaskSubmission) => s.employeeId === currentUser.id
        );
        setSubmissions(filteredSubs);
      }
    } catch (e) {
      console.error("Failed to load tasks and submissions:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasksAndSubmissions();
  }, [currentUser.id]);

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

  const handleSubmitSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmitTask) return;

    setSubmitError("");
    setSubmitSuccess("");

    if (!submittedText.trim() && attachments.length === 0) {
      setSubmitError("Please provide either solution text or upload a solution file attachment.");
      return;
    }

    setSubmitting(true);
    const payload = {
      taskId: activeSubmitTask.id,
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      submittedText: submittedText.trim(),
      files: attachments
    };

    try {
      const res = await fetch("/api/tasks/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSubmitSuccess("Solution successfully submitted to Administration!");
        setSubmittedText("");
        setAttachments([]);
        setTimeout(() => {
          setActiveSubmitTask(null);
          setSubmitSuccess("");
          fetchTasksAndSubmissions();
          onRefreshAll();
        }, 1500);
      } else {
        const err = await res.json();
        setSubmitError(err.detail || "Submission transaction failed.");
      }
    } catch (e) {
      setSubmitError("A connection error occurred. Could not submit solution.");
    } finally {
      setSubmitting(false);
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
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          Your Assigned Tasks
          <span className="text-xs bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full border border-indigo-550/15">
            Tasks Dashboard
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Complete assigned onboarding tasks, view guidelines, download template resources, and submit deliverables for verification.
        </p>
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 font-mono text-xs">
          <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
          <span>Synchronizing task records...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className={`${cardBg} p-10 text-center text-slate-400 font-semibold text-xs`}>
          No tasks have been assigned to you at this time.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Tasks List */}
          <div className={`${activeSubmitTask ? "lg:col-span-6" : "lg:col-span-12"} space-y-4`}>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              {tasks.map((task) => {
                const sub = submissions.find(s => s.taskId === task.id);
                const isSelected = activeSubmitTask?.id === task.id;

                return (
                  <div
                    key={task.id}
                    className={`${cardBg} border transition-all ${
                      isSelected
                        ? "border-[#F1B814] ring-1 ring-[#F1B814]/30"
                        : "border-slate-205 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900 truncate" title={task.title}>
                            {task.title}
                          </h3>
                          {task.assignedTo === "all" ? (
                            <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.2 rounded border border-emerald-500/20">
                              Global Task
                            </span>
                          ) : (
                            <span className="text-[8px] font-bold bg-blue-500/10 text-blue-600 px-1.5 py-0.2 rounded border border-blue-500/20">
                              Direct Task
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-650 leading-relaxed font-sans line-clamp-2" title={task.description}>
                          {task.description}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-[9px] text-slate-450 font-mono pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Assigned: {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Right action block */}
                      <div className="flex flex-col sm:flex-row md:flex-col items-end gap-3.5 w-full md:w-auto flex-shrink-0">
                        {/* Status Badge */}
                        <div>
                          {!sub ? (
                            <span className="px-2.5 py-0.8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold uppercase font-mono">
                              Not Submitted
                            </span>
                          ) : (
                            <span className={`px-2.5 py-0.8 rounded-full text-[9px] font-bold uppercase font-mono border ${
                              sub.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : sub.status === "rejected"
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            }`}>
                              {sub.status === "approved" ? "✔ Approved" : sub.status === "rejected" ? "✘ Rejected" : "⏳ Pending Verification"}
                            </span>
                          )}
                        </div>

                        {/* Submit Actions */}
                        <div className="w-full sm:w-auto">
                          {(!sub || sub.status === "rejected") && (
                            <button
                              onClick={() => {
                                setSubmittedText(sub?.submittedText || "");
                                setAttachments([]);
                                setActiveSubmitTask(task);
                                setSubmitError("");
                                setSubmitSuccess("");
                              }}
                              className="w-full text-center px-4 py-1.8 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition shadow-sm cursor-pointer flex items-center justify-center gap-1"
                            >
                              <span>{sub ? "Resubmit Solution" : "Submit Solution"}</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reference resource items */}
                    {task.files && task.files.length > 0 && (
                      <div className="px-5 pb-4 border-t border-slate-100 pt-3 bg-slate-50/50">
                        <span className="text-[10px] font-extrabold text-slate-500 block mb-2 uppercase tracking-wide">
                          Task Guides & Reference Templates:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {task.files.map((file, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleDownload(file.name, file.url)}
                              className="flex items-center gap-1.5 px-3 py-1.2 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-indigo-650 hover:bg-slate-50 transition cursor-pointer shadow-sm"
                            >
                              <Download className="h-3 w-3 flex-shrink-0" />
                              <span>{file.name}</span>
                              <span className="text-[8px] text-slate-400 font-mono">({file.size})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Remarks details */}
                    {sub && (sub.remarks || sub.reviewedAt) && (
                      <div className="px-5 pb-4 border-t border-slate-100 pt-3 bg-slate-50/50 text-[11px]">
                        <span className="font-bold text-slate-700 block mb-1">HR Review Log:</span>
                        <div className="p-3 bg-white border border-slate-150 rounded-lg">
                          <p className="text-slate-800">
                            <strong>Remarks:</strong> {sub.remarks || <span className="text-slate-400 italic">No feedback provided yet.</span>}
                          </p>
                          {sub.reviewedAt && (
                            <span className="text-[8px] text-slate-400 font-mono block mt-1">Reviewed on: {new Date(sub.reviewedAt).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submission panel */}
          {activeSubmitTask && (
            <div className="lg:col-span-6 animate-slide-in-right">
              <form onSubmit={handleSubmitSolution} className={`${cardBg} p-6 space-y-5 shadow-md border-l-4 border-l-indigo-550 text-xs`}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="text-indigo-500 h-4.5 w-4.5" />
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Submit Solution</h3>
                      <p className="text-[9px] text-indigo-600 font-bold">{activeSubmitTask.title}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubmitTask(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 cursor-pointer"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>

                {submitError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 font-semibold rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                {submitSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 font-semibold rounded-lg flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{submitSuccess}</span>
                  </div>
                )}

                {/* Text explanation */}
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Solution Notes / Description</label>
                  <textarea
                    required
                    placeholder="Provide details of your implementation, answers to questions, or comments on the solution..."
                    rows={6}
                    value={submittedText}
                    onChange={(e) => setSubmittedText(e.target.value)}
                    className="w-full bg-white border border-slate-350 rounded p-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-sans leading-relaxed"
                  />
                </div>

                {/* File deliverables */}
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Submit Files / Deliverables</label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100/70 transition-all">
                      <div className="flex flex-col items-center justify-center pt-4 pb-4">
                        <Plus className="w-6 h-6 text-slate-400 mb-1" />
                        <p className="text-[10px] text-slate-500 font-bold">Attach screenshots, zip, docs, CSV, PDF...</p>
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
                      <p className="font-bold text-slate-700">Files to be Uploaded:</p>
                      <div className="divide-y divide-slate-150 border border-slate-200 rounded-lg overflow-hidden bg-white">
                        {attachments.map((file, idx) => (
                          <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-4 w-4 text-indigo-550 flex-shrink-0" />
                              <span className="font-semibold text-slate-800 truncate text-xs">{file.name}</span>
                              <span className="text-[9px] text-slate-450 font-mono">({file.size})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubmitTask(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 rounded-lg transition-all cursor-pointer text-center uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-550 text-white font-bold text-xs py-2 rounded-lg shadow-md transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? "Uploading Solution..." : "Submit Task"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

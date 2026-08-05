import React, { useState } from "react";
import { 
  FolderOpen, 
  Search, 
  User, 
  ExternalLink, 
  Save, 
  Edit2, 
  X, 
  CheckCircle, 
  Info,
  ClipboardList
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Application, User as CandidateUser } from "../types";

interface AdminDocumentsProps {
  employees: CandidateUser[];
  applications: Application[];
  onRefreshAll: () => void;
}

export default function AdminDocuments({
  employees,
  applications,
  onRefreshAll
}: AdminDocumentsProps) {
  const { cardBg, cardHeaderBg } = useTheme();

  const [searchTerm, setSearchTerm] = useState("");
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editLinkValue, setEditLinkValue] = useState("");
  const [saveLoadingId, setSaveLoadingId] = useState<string | null>(null);

  const documentTypes = [
    { id: "resume", shortLabel: "Resume" },
    { id: "aadhaar", shortLabel: "Aadhaar" },
    { id: "pan", shortLabel: "PAN" },
    { id: "photo", shortLabel: "Photo" },
    { id: "educational", shortLabel: "Educational" },
    { id: "experience", shortLabel: "Experience" }
  ];

  // Filter out admin users and apply search term
  const filteredEmployees = employees.filter(emp => {
    if (emp.role === "admin") return false;
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  async function handleSaveDriveLink(employeeId: string) {
    setSaveLoadingId(employeeId);
    const existingApp = applications.find(a => a.employeeId === employeeId);
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const token = localStorage.getItem("agentops_jwt");
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers,
        body: JSON.stringify({
          employeeId: employeeId,
          fullName: existingApp?.fullName || emp.name,
          email: existingApp?.email || emp.email,
          mobile: existingApp?.mobile || emp.mobile,
          gender: existingApp?.gender || "",
          highestQualification: existingApp?.highestQualification || "",
          collegeName: existingApp?.collegeName || "",
          yearOfPassing: existingApp?.yearOfPassing || "",
          percentageOrCgpa: existingApp?.percentageOrCgpa || "",
          technicalSkills: existingApp?.technicalSkills || [],
          otherSkills: existingApp?.otherSkills || [],
          status: existingApp?.status || "draft",
          googleDriveLink: editLinkValue,
          submittedDocs: existingApp?.submittedDocs || [],
          updatedAt: new Date().toISOString()
        })
      });

      if (res.ok) {
        setEditingEmployeeId(null);
        onRefreshAll();
      } else {
        alert("Failed to save Google Drive link.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving Google Drive link.");
    } finally {
      setSaveLoadingId(null);
    }
  }

  function startEditing(employeeId: string, currentLink: string) {
    setEditingEmployeeId(employeeId);
    setEditLinkValue(currentLink);
  }

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Title */}
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-xl font-black text-[#0A2540] flex items-center gap-2">
          Onboarding Documents Directory
          <span className="text-xs bg-cyan-100 text-cyan-800 border border-cyan-200 px-2.5 py-0.5 rounded-full font-bold">
            Drive & Checklist Directory
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Provide personalized Google Drive upload links for employees and audit their document checklist statuses inline.
        </p>
      </div>

      {/* Filter and search bar */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 text-xs py-2.5 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Dashboard Documents List */}
      <div className={`rounded-xl ${cardBg} border border-slate-200 overflow-hidden shadow-sm bg-white`}>
        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#0A2540] text-slate-200 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                <th className="p-4 pl-6">Candidate Name & Email</th>
                <th className="p-4">Google Drive Upload Folder Link</th>
                <th className="p-4 text-center">Checklist Status</th>
                <th className="p-4">Submitted Documents Checklist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-500 max-w-[400px] leading-tight mx-auto">
                    <Info className="h-8 w-8 text-slate-400 mx-auto mb-2 animate-pulse" />
                    No employees found matching query.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const app = applications.find(a => a.employeeId === emp.id);
                  const driveLink = app?.googleDriveLink || "";
                  const submittedList = app?.submittedDocs || [];
                  const checkedCount = submittedList.length;
                  const isEditing = editingEmployeeId === emp.id;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition">
                      {/* Employee metadata */}
                      <td className="p-4 pl-6 align-top">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <span>{emp.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 ml-5">{emp.email}</div>
                      </td>

                      {/* Google Drive Link input / action */}
                      <td className="p-4 align-top max-w-[320px]">
                        {isEditing ? (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              value={editLinkValue}
                              onChange={(e) => setEditLinkValue(e.target.value)}
                              placeholder="https://drive.google.com/..."
                              className="bg-white border border-slate-300 text-[11px] p-1.5 px-2 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1"
                            />
                            <button
                              onClick={() => handleSaveDriveLink(emp.id)}
                              disabled={saveLoadingId === emp.id}
                              className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer flex items-center justify-center"
                              title="Save Link"
                            >
                              <Save className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingEmployeeId(null)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer flex items-center justify-center"
                              title="Cancel"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {driveLink ? (
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <a
                                  href={driveLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline font-semibold truncate flex items-center gap-1"
                                >
                                  <span className="truncate">{driveLink}</span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No link shared</span>
                            )}
                            <button
                              onClick={() => startEditing(emp.id, driveLink)}
                              className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-slate-500 hover:text-slate-900 cursor-pointer ml-auto flex-shrink-0"
                              title="Edit Link"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Checklist count status */}
                      <td className="p-4 text-center align-top">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          checkedCount === documentTypes.length
                            ? "bg-emerald-100 text-emerald-800" 
                            : checkedCount > 0 
                            ? "bg-indigo-100 text-indigo-800" 
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {checkedCount} / {documentTypes.length} Docs
                        </span>
                      </td>

                      {/* Submitted checklist details */}
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                          {documentTypes.map(docType => {
                            const isSubmitted = submittedList.includes(docType.id);
                            return (
                              <span
                                key={docType.id}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
                                  isSubmitted
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold"
                                    : "bg-slate-50 border-slate-200 text-slate-400 font-normal"
                                }`}
                              >
                                {isSubmitted ? (
                                  <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                )}
                                <span>{docType.shortLabel}</span>
                              </span>
                            );
                          })}
                        </div>
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
  );
}

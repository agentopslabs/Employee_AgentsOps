import React, { useState, useEffect } from "react";
import { 
  Lock, 
  User, 
  Key, 
  Paperclip,
  Check,
  ExternalLink,
  ClipboardList,
  CheckCircle
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { 
  User as EmployeeUser, 
  Application
} from "../types";

interface EmployeeProfileProps {
  currentUser: EmployeeUser;
  application: Application | null;
  onRefreshAll: () => void;
}

export default function EmployeeProfile({
  currentUser,
  application,
  onRefreshAll
}: EmployeeProfileProps) {
  // Settings State: Change Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const justSavedRef = React.useRef(false);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editQualification, setEditQualification] = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editYearOfPassing, setEditYearOfPassing] = useState("");
  const [editCgpa, setEditCgpa] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  // feedback toasts
  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  // Sync profile editing values with currentUser and application
  useEffect(() => {
    if (!isEditing) {
      if (justSavedRef.current) {
        justSavedRef.current = false;
        return;
      }
      setEditName(currentUser.name || "");
      setEditMobile(currentUser.mobile || "");
      setEditGender(application?.gender || "");
      setEditQualification(application?.highestQualification || "");
      setEditCollege(application?.collegeName || "");
      setEditYearOfPassing(application?.yearOfPassing || "");
      setEditCgpa(application?.percentageOrCgpa || "");
    }
  }, [currentUser, application, isEditing]);

  // Handle saving of updated profile details
  async function handleSaveProfile() {
    setErrorStatus("");
    setSuccessStatus("");

    if (!editName.trim() || !editMobile.trim()) {
      setErrorStatus("Name and Mobile Number fields are mandatory.");
      return;
    }

    setSaveLoading(true);

    const token = localStorage.getItem("agentops_jwt");
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      // 1. Update user credentials (PUT /api/users/:id)
      const userRes = await fetch(`/api/users/${currentUser.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: editName,
          mobile: editMobile,
          email: currentUser.email
        })
      });

      if (!userRes.ok) {
        throw new Error("Failed to update user profile details.");
      }

      // 2. Update onboarding application details (POST /api/applications)
      const appRes = await fetch("/api/applications", {
        method: "POST",
        headers,
        body: JSON.stringify({
          employeeId: currentUser.id,
          fullName: editName,
          email: currentUser.email,
          mobile: editMobile,
          gender: editGender,
          highestQualification: editQualification,
          collegeName: editCollege,
          yearOfPassing: editYearOfPassing,
          percentageOrCgpa: editCgpa,
          technicalSkills: application?.technicalSkills || [],
          otherSkills: application?.otherSkills || [],
          status: application?.status || "draft",
          googleDriveLink: application?.googleDriveLink || "",
          submittedDocs: application?.submittedDocs || [],
          updatedAt: new Date().toISOString()
        })
      });

      if (!appRes.ok) {
        throw new Error("Failed to update onboarding academic details.");
      }

      // Clear local storage draft backup
      localStorage.removeItem(`onboarding_form_${currentUser.id}`);

      justSavedRef.current = true;
      setSuccessStatus("Your profile and academic credentials have been updated successfully!");
      setIsEditing(false);
      onRefreshAll();
    } catch (e: any) {
      setErrorStatus(e?.message || "Failed to update profile details.");
    } finally {
      setSaveLoading(false);
    }
  }

  // Handle password modification
  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorStatus("All password parameters are mandatory.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorStatus("New and confirmed passwords must match.");
      return;
    }

    const token = localStorage.getItem("agentops_jwt");
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`/api/users/${currentUser.id}/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (res.ok) {
        setSuccessStatus("Password changed successfully in secure session vaults.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        onRefreshAll();
      } else {
        const err = await res.json();
        setErrorStatus(err.detail || err.error || "Credentials authorization failed.");
      }
    } catch (e) {
      setErrorStatus("Failed to communicate with authentication servers.");
    }
  }

  // Handle toggling of document checklist items
  async function handleToggleDoc(docId: string, isChecked: boolean) {
    setErrorStatus("");
    setSuccessStatus("");

    const currentSubmittedDocs = application?.submittedDocs || [];
    let newSubmittedDocs: string[];
    if (isChecked) {
      newSubmittedDocs = [...currentSubmittedDocs, docId];
    } else {
      newSubmittedDocs = currentSubmittedDocs.filter(id => id !== docId);
    }

    const token = localStorage.getItem("agentops_jwt");
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const appRes = await fetch("/api/applications", {
        method: "POST",
        headers,
        body: JSON.stringify({
          employeeId: currentUser.id,
          fullName: application?.fullName || currentUser.name,
          email: application?.email || currentUser.email,
          mobile: application?.mobile || currentUser.mobile,
          gender: application?.gender || editGender,
          highestQualification: application?.highestQualification || editQualification,
          collegeName: application?.collegeName || editCollege,
          yearOfPassing: application?.yearOfPassing || editYearOfPassing,
          percentageOrCgpa: application?.percentageOrCgpa || editCgpa,
          technicalSkills: application?.technicalSkills || [],
          otherSkills: application?.otherSkills || [],
          status: application?.status || "draft",
          googleDriveLink: application?.googleDriveLink || "",
          submittedDocs: newSubmittedDocs,
          updatedAt: new Date().toISOString()
        })
      });

      if (!appRes.ok) {
        throw new Error("Failed to save checklist state.");
      }

      onRefreshAll();
    } catch (e: any) {
      setErrorStatus(e?.message || "Failed to update checklist.");
    }
  }

  const documentTypes = [
    { id: "resume", label: "Mandatory Resume File (PDF / Word)" },
    { id: "aadhaar", label: "Aadhaar Identity Card (PDF / Image)" },
    { id: "pan", label: "PAN Tax Identity Card (PDF / Image)" },
    { id: "photo", label: "Passport-Sized Color Photo (PNG / JPG)" },
    { id: "educational", label: "Consolidated Educational Certificates" },
    { id: "experience", label: "Previous Employment Proof Letters (Optional)" }
  ];

  const submittedDocsList = application?.submittedDocs || [];
  const checkedCount = submittedDocsList.length;
  const progressPercent = Math.round((checkedCount / documentTypes.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Title block */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Onboarding Profile & Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review secure personnel credentials, adjust your password parameters, and complete your document checklist stages.
        </p>
      </div>

      {successStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{successStatus}</span>
        </div>
      )}

      {errorStatus && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
          <CheckCircle className="h-5 w-5 text-rose-600 flex-shrink-0 rotate-45" />
          <span>{errorStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        
        {/* Left column: My Profile Summary view of metadata and details */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <User className="text-indigo-600 h-5 w-5" />
                <h3 className="text-sm font-bold text-slate-900">Personal & Academic Credentials</h3>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-bold py-1.5 px-3.5 rounded-lg transition duration-150 cursor-pointer text-[11px]"
                >
                  Edit Profile Details
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={() => setIsEditing(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3.5 rounded-lg transition duration-150 cursor-pointer text-[11px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saveLoading}
                    onClick={handleSaveProfile}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3.5 rounded-lg transition duration-150 cursor-pointer text-[11px] flex items-center gap-1.5"
                  >
                    {saveLoading ? "Saving..." : "Save Details"}
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal Details Form */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal Details</h4>
                  <div className="space-y-3 p-4 border border-slate-200 bg-slate-50/50 rounded-xl">
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Full Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 font-semibold text-[10px] uppercase">Registered Email (Read Only)</label>
                      <input
                        type="text"
                        disabled
                        value={currentUser.email}
                        className="w-full bg-slate-100 border border-slate-205 text-slate-400 rounded-lg p-2 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Mobile Number</label>
                      <input
                        type="text"
                        value={editMobile}
                        onChange={(e) => setEditMobile(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Gender</label>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Gender --</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Graduation Details Form */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Graduation Details</h4>
                  <div className="space-y-3 p-4 border border-slate-200 bg-slate-50/50 rounded-xl">
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Highest Qualification</label>
                      <input
                        type="text"
                        value={editQualification}
                        onChange={(e) => setEditQualification(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">College / University</label>
                      <input
                        type="text"
                        value={editCollege}
                        onChange={(e) => setEditCollege(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 font-semibold text-[10px] uppercase">Year of Passing</label>
                      <input
                        type="text"
                        value={editYearOfPassing}
                        onChange={(e) => setEditYearOfPassing(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-indigo-700 block mb-1 font-bold text-[10px] uppercase">Score / Grade (GPA/Percentage)</label>
                      <input
                        type="text"
                        value={editCgpa}
                        onChange={(e) => setEditCgpa(e.target.value)}
                        className="w-full bg-indigo-50/50 border border-indigo-200 text-indigo-950 font-bold rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Demographics Summary */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal Details</h4>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 font-medium text-slate-700">
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Full Name</span> <span className="text-slate-900">{currentUser.name}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Registered Email</span> <span className="text-slate-900">{currentUser.email}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Mobile Number</span> <span className="text-slate-900">{currentUser.mobile}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Gender</span> <span className="text-slate-900">{application?.gender || "Not declared Yet"}</span></p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Graduation Details</h4>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 font-medium text-slate-700">
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Highest Qualification</span> <span className="text-slate-900">{application?.highestQualification || "Not declared Yet"}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">College / University</span> <span className="text-slate-900">{application?.collegeName || "Not declared Yet"}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase">Year of Passing</span> <span className="text-slate-900">{application?.yearOfPassing || "Not declared Yet"}</span></p>
                    <p><span className="text-slate-400 block font-normal text-[10px] uppercase font-bold text-indigo-600">Score / Grade</span> <span className="text-indigo-600 font-bold">{application?.percentageOrCgpa || "Not declared Yet"}</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* Google Drive Link and Checklist Section */}
            <div className="border-t border-slate-100 pt-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Paperclip className="h-4.5 w-4.5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Onboarding Documents Submission</h3>
              </div>

              {application?.googleDriveLink ? (
                <div className="space-y-6">
                  {/* Google Drive Upload Card */}
                  <div className="bg-indigo-50/40 border border-indigo-150 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-900 text-sm">Your Personalized Google Drive Upload Folder</h4>
                      <p className="text-slate-500 text-[11px]">
                        Please click the button to upload your certificates and documents to this secure Google Drive folder.
                      </p>
                    </div>
                    <a
                      href={application.googleDriveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-sm text-xs cursor-pointer w-full md:w-auto"
                    >
                      <span>Open Google Drive</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Checklist and Progress */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4.5 w-4.5 text-slate-700" />
                        <span className="font-bold text-slate-900">Submission Verification Checklist</span>
                      </div>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {checkedCount} of {documentTypes.length} Submitted
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-2 bg-slate-105 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300" 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-medium">
                        {progressPercent}% Complete
                      </div>
                    </div>

                    {/* Checkbox Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {documentTypes.map((doc) => {
                        const isChecked = submittedDocsList.includes(doc.id);
                        return (
                          <label
                            key={doc.id}
                            className={`flex items-center gap-3 p-4 rounded-xl border transition cursor-pointer hover:shadow-sm ${
                              isChecked 
                                ? "bg-emerald-50/20 border-emerald-200 text-slate-800" 
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleToggleDoc(doc.id, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <span className="font-semibold text-slate-900 block">{doc.label.split(' (')[0]}</span>
                              <span className="text-[9px] text-slate-400">
                                {doc.id === "experience" ? "Optional document" : "Required document"}
                              </span>
                            </div>
                            {isChecked && (
                              <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center space-y-2">
                  <ClipboardList className="h-8 w-8 text-slate-400 mx-auto animate-pulse" />
                  <h4 className="font-bold text-slate-900">Google Drive Upload Folder Pending</h4>
                  <p className="text-slate-500 text-[11px] max-w-md mx-auto leading-relaxed">
                    Your customized Google Drive upload folder link will be shared here by the Admin shortly. Once shared, you can access the drive and complete your checklist verification.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Update password form */}
        <div className="lg:col-span-4 h-fit text-xs space-y-6">
          <form onSubmit={handlePasswordUpdate} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key className="text-slate-800 h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Change Account Password</h3>
            </div>

            <div>
              <label className="text-slate-500 font-semibold block mb-1">Old Account Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-500 font-semibold block mb-1">New Target Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters required"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-500 font-semibold block mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl transition cursor-pointer shadow-sm mt-2"
            >
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

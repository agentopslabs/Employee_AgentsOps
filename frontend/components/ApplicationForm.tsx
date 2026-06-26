import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Save, 
  Send, 
  Plus, 
  X, 
  CheckCircle, 
  GraduationCap, 
  Wrench, 
  User, 
  AlertTriangle,
  Lightbulb
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Application, ApplicationStatus, User as EmployeeUser } from "../types";

interface ApplicationFormProps {
  currentUser: EmployeeUser;
  application: Application | null;
  onRefreshAll: () => Promise<void>;
  onSelectTab: (tab: string) => void;
}

export default function ApplicationForm({
  currentUser,
  application,
  onRefreshAll,
  onSelectTab
}: ApplicationFormProps) {
  const { cardBg, cardHeaderBg } = useTheme();

  // Load local storage draft helper
  const getLocalDraft = (userId: string) => {
    if (!userId) return null;
    try {
      const saved = localStorage.getItem(`onboarding_form_${userId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  // Core Form State lazily initialized from props or local storage backup to prevent progress loss
  const [fullName, setFullName] = useState(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.fullName !== undefined) return local.fullName;
    return application?.fullName || currentUser?.name || "";
  });
  const [email, setEmail] = useState(() => application?.email || currentUser?.email || "");
  const [mobile, setMobile] = useState(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.mobile !== undefined) return local.mobile;
    return application?.mobile || currentUser?.mobile || "";
  });
  const [gender, setGender] = useState(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.gender !== undefined) return local.gender;
    return application?.gender || "";
  });

  const [highestQualification, setHighestQualification] = useState(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.highestQualification !== undefined) return local.highestQualification;
    return application?.highestQualification || "";
  });
  const [collegeName, setCollegeName] = useState(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.collegeName !== undefined) return local.collegeName;
    return application?.collegeName || "";
  });
  const [yearOfPassing, setYearOfPassing] = useState(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.yearOfPassing !== undefined) return local.yearOfPassing;
    return application?.yearOfPassing || "";
  });
  const [percentageOrCgpa, setPercentageOrCgpa] = useState(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.percentageOrCgpa !== undefined) return local.percentageOrCgpa;
    return application?.percentageOrCgpa || "";
  });

  // Technical skills tagging
  const [techSkillInput, setTechSkillInput] = useState("");
  const [technicalSkills, setTechnicalSkills] = useState<string[]>(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.technicalSkills !== undefined) return local.technicalSkills;
    return application?.technicalSkills || [];
  });

  // Other skills tagging
  const [otherSkillInput, setOtherSkillInput] = useState("");
  const [otherSkills, setOtherSkills] = useState<string[]>(() => {
    const local = getLocalDraft(currentUser?.id);
    const status = application?.status;
    const isLocked = status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.APPROVED;
    if (!isLocked && local && local.otherSkills !== undefined) return local.otherSkills;
    return application?.otherSkills || [];
  });

  const [formStatus, setFormStatus] = useState<ApplicationStatus>(() => application?.status || ApplicationStatus.NOT_STARTED);
  
  // feedback toasts
  const [message, setMessage] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Synchronize status changes ONLY if they change from the database (e.g. from DRAFT to APPROVED/REJECTED)
  useEffect(() => {
    if (application?.status && application.status !== formStatus) {
      setFormStatus(application.status);
    }
  }, [application?.status]);

  const hasInitializedRef = useRef(false);

  // Reset initialization flag when user changes
  useEffect(() => {
    hasInitializedRef.current = false;
  }, [currentUser?.id]);

  // Handle initial hydration or user swap event securely
  useEffect(() => {
    if (currentUser && !hasInitializedRef.current) {
      let localData: any = null;
      try {
        const saved = localStorage.getItem(`onboarding_form_${currentUser.id}`);
        if (saved) {
          localData = JSON.parse(saved);
        }
      } catch (e) {
        console.error("Failed to load local draft content", e);
      }

      const status = application?.status || ApplicationStatus.NOT_STARTED;
      const isDbLocked = status === ApplicationStatus.APPROVED;

      if (isDbLocked) {
        setFullName(application?.fullName || currentUser.name || "");
        setMobile(application?.mobile || currentUser.mobile || "");
        setGender(application?.gender || "");
        setHighestQualification(application?.highestQualification || "");
        setCollegeName(application?.collegeName || "");
        setYearOfPassing(application?.yearOfPassing || "");
        setPercentageOrCgpa(application?.percentageOrCgpa || "");
        setTechnicalSkills(application?.technicalSkills || []);
        setOtherSkills(application?.otherSkills || []);
      } else {
        setFullName(localData?.fullName !== undefined ? localData.fullName : (application?.fullName || currentUser.name || ""));
        setMobile(localData?.mobile !== undefined ? localData.mobile : (application?.mobile || currentUser.mobile || ""));
        setGender(localData?.gender !== undefined ? localData.gender : (application?.gender || ""));
        setHighestQualification(localData?.highestQualification !== undefined ? localData.highestQualification : (application?.highestQualification || ""));
        setCollegeName(localData?.collegeName !== undefined ? localData.collegeName : (application?.collegeName || ""));
        setYearOfPassing(localData?.yearOfPassing !== undefined ? localData.yearOfPassing : (application?.yearOfPassing || ""));
        setPercentageOrCgpa(localData?.percentageOrCgpa !== undefined ? localData.percentageOrCgpa : (application?.percentageOrCgpa || ""));
        setTechnicalSkills(localData?.technicalSkills !== undefined ? localData.technicalSkills : (application?.technicalSkills || []));
        setOtherSkills(localData?.otherSkills !== undefined ? localData.otherSkills : (application?.otherSkills || []));
        
        if (localData) {
          setMessage("Restored unsaved onboarding progress from local browser backup.");
        }
      }
      setEmail(application?.email || currentUser.email || "");
      setFormStatus(status);

      if (application) {
        hasInitializedRef.current = true;
      }
    }
  }, [currentUser?.id, application]);

  // Save to localStorage automatically as the user types/updates fields
  useEffect(() => {
    const isLocked = formStatus === ApplicationStatus.SUBMITTED || formStatus === ApplicationStatus.APPROVED;
    if (currentUser?.id && !isLocked) {
      const dataToSave = {
        fullName,
        mobile,
        gender,
        highestQualification,
        collegeName,
        yearOfPassing,
        percentageOrCgpa,
        technicalSkills,
        otherSkills,
      };
      localStorage.setItem(`onboarding_form_${currentUser.id}`, JSON.stringify(dataToSave));
    }
  }, [
    currentUser?.id,
    formStatus,
    fullName,
    mobile,
    gender,
    highestQualification,
    collegeName,
    yearOfPassing,
    percentageOrCgpa,
    technicalSkills,
    otherSkills,
  ]);

  function handleAddTechSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!techSkillInput.trim()) return;
    if (technicalSkills.includes(techSkillInput.trim())) {
      setTechSkillInput("");
      return;
    }
    setTechnicalSkills([...technicalSkills, techSkillInput.trim()]);
    setTechSkillInput("");
  }

  function handleRemoveTechSkill(tag: string) {
    setTechnicalSkills(technicalSkills.filter(t => t !== tag));
  }

  function handleAddOtherSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!otherSkillInput.trim()) return;
    if (otherSkills.includes(otherSkillInput.trim())) {
      setOtherSkillInput("");
      return;
    }
    setOtherSkills([...otherSkills, otherSkillInput.trim()]);
    setOtherSkillInput("");
  }

  function handleRemoveOtherSkill(tag: string) {
    setOtherSkills(otherSkills.filter(t => t !== tag));
  }

  // Submit profile database callback dispatcher
  async function handleSubmitForm(type: "draft" | "submitted") {
    setMessage("");
    setErrorStatus("");

    if (type === "submitted") {
      if (!fullName || !email || !mobile || !gender || !highestQualification || !collegeName || !yearOfPassing) {
        setErrorStatus("Demographic and educational details are mandatory. Please fill in all fields to proceed.");
        return;
      }
      if (technicalSkills.length === 0) {
        setErrorStatus("Please provide at least 1 technical skill to qualify for assessments.");
        return;
      }
    }

    setLoading(true);
    const payload = {
      employeeId: currentUser.id,
      fullName,
      email,
      mobile,
      gender,
      highestQualification,
      collegeName,
      yearOfPassing,
      percentageOrCgpa,
      technicalSkills,
      otherSkills,
      status: type === "draft" ? ApplicationStatus.DRAFT : ApplicationStatus.SUBMITTED
    };

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
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFormStatus(type === "draft" ? ApplicationStatus.DRAFT : ApplicationStatus.SUBMITTED);
        // Clear local storage backup since everything is persistent on the server database
        localStorage.removeItem(`onboarding_form_${currentUser.id}`);
        setMessage(
          type === "draft" 
            ? "Your application draft has been saved successfully." 
            : "Onboarding Application form submitted! You are now eligible to complete the assigned assessments."
        );
        await onRefreshAll();
        if (type === "submitted") {
          onSelectTab("employee-dashboard");
        }
      } else {
        setErrorStatus("Failed to submit data. Ensure backend API is online.");
      }
    } catch (e) {
      setErrorStatus("Connection timeout. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  const isAlreadySubmitted = formStatus === ApplicationStatus.APPROVED; 
  const displayStatusBanner = formStatus === ApplicationStatus.SUBMITTED || formStatus === ApplicationStatus.APPROVED;

  return (
    <div className="space-y-6 animate-fade-in text-left">
      
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Onboarding Application Form</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete your formal onboarding profile setup to authorize your access to assigned qualification tests.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-250 border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2.5 shadow-sm">
          <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {errorStatus && (
        <div className="p-4 bg-rose-50 border border-rose-250 border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2.5 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 animate-pulse" />
          <span>{errorStatus}</span>
        </div>
      )}

      {displayStatusBanner && (
        <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-800 text-xs flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900">Application Submitted</h4>
            <p className="text-slate-600 leading-normal">
              Your onboarding information was submitted for verification. If you need to make changes, you can edit your basic details or add/remove skillset tags below, then click <strong>Submit Application</strong> or <strong>Save Draft Profile</strong> to save your updates.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid Card Sheet */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 text-xs">
        
        {/* Section 1: Demographics */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <User className="h-4.5 w-4.5 text-indigo-500" /> Basic Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Full Name</label>
              <input
                type="text"
                required
                disabled={isAlreadySubmitted}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-1">E-Mail Address</label>
              <input
                type="email"
                required
                disabled
                value={email}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-450 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Mobile Contact Phone</label>
              <input
                type="tel"
                required
                disabled={isAlreadySubmitted}
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. +1 (555) 012-3456"
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Gender Identification</label>
              <select
                required
                disabled={isAlreadySubmitted}
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">-- Choose Gender --</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to declare">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Education Achievements */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <GraduationCap className="h-4.5 w-4.5 text-indigo-500" /> Academic Credentials
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Highest Qualification</label>
              <input
                type="text"
                required
                disabled={isAlreadySubmitted}
                value={highestQualification}
                onChange={(e) => setHighestQualification(e.target.value)}
                placeholder="e.g. Bachelor of Technology (CSE)"
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-1">College / Institute Name</label>
              <input
                type="text"
                required
                disabled={isAlreadySubmitted}
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="e.g. Standford University"
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Year of Passing</label>
              <input
                type="number"
                required
                disabled={isAlreadySubmitted}
                value={yearOfPassing}
                onChange={(e) => setYearOfPassing(e.target.value)}
                placeholder="2025"
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-500 font-semibold block mb-1">Cumulative Percentage / CGPA</label>
              <input
                type="text"
                disabled={isAlreadySubmitted}
                value={percentageOrCgpa}
                onChange={(e) => setPercentageOrCgpa(e.target.value)}
                placeholder="e.g. 8.4 CGPA or 84%"
                className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Technical Skills & Soft Skills tags */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Wrench className="h-4.5 w-4.5 text-indigo-505 text-indigo-500" /> Skillset Profiling
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Technical Skills */}
            <div className="space-y-2">
              <label className="text-slate-500 font-bold block mb-1">Primary Technical Skills</label>
              
               {!isAlreadySubmitted && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={techSkillInput}
                    onChange={(e) => setTechSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = techSkillInput.trim();
                        if (val && !technicalSkills.includes(val)) {
                          setTechnicalSkills([...technicalSkills, val]);
                        }
                        setTechSkillInput("");
                      }
                    }}
                    placeholder="e.g. React (Press Enter or Add Skills)"
                    className="bg-white border border-slate-200 text-slate-900 rounded-xl p-2.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = techSkillInput.trim();
                      if (val && !technicalSkills.includes(val)) {
                        setTechnicalSkills([...technicalSkills, val]);
                      }
                      setTechSkillInput("");
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 rounded-xl transition cursor-pointer text-xs"
                  >
                    Add Skills
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[70px]">
                {technicalSkills.length === 0 ? (
                  <span className="text-[10px] text-slate-400 font-mono italic">No technical skills added</span>
                ) : (
                  technicalSkills.map((tag, i) => (
                    <span key={i} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 text-[10px]">
                      {tag}
                      {!isAlreadySubmitted && (
                        <button type="button" onClick={() => handleRemoveTechSkill(tag)} className="hover:text-indigo-900 text-indigo-455 font-black">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Other / Soft Skills */}
            <div className="space-y-2">
              <label className="text-slate-500 font-bold block mb-1">Past Experience</label>
              
               {!isAlreadySubmitted && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otherSkillInput}
                    onChange={(e) => setOtherSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = otherSkillInput.trim();
                        if (val && !otherSkills.includes(val)) {
                          setOtherSkills([...otherSkills, val]);
                        }
                        setOtherSkillInput("");
                      }
                    }}
                    placeholder="e.g. 2 Years at Google (Press Enter or Add Skills)"
                    className="bg-white border border-slate-200 text-slate-900 rounded-xl p-2.5 flex-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = otherSkillInput.trim();
                      if (val && !otherSkills.includes(val)) {
                        setOtherSkills([...otherSkills, val]);
                      }
                      setOtherSkillInput("");
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 rounded-xl transition cursor-pointer text-xs"
                  >
                    Add Skills
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[70px]">
                {otherSkills.length === 0 ? (
                  <span className="text-[10px] text-slate-400 font-mono italic">No past experience added</span>
                ) : (
                  otherSkills.map((tag, i) => (
                    <span key={i} className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 text-[10px]">
                      {tag}
                      {!isAlreadySubmitted && (
                        <button type="button" onClick={() => handleRemoveOtherSkill(tag)} className="hover:text-slate-900 text-slate-555 font-black">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Buttons Footer */}
        {!isAlreadySubmitted && (
          <div className="flex justify-end gap-3.5 border-t border-slate-100 pt-6">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmitForm("draft")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <Save className="h-4 w-4" /> Save Draft Profile
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmitForm("submitted")}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Send className="h-4 w-4" /> Submit Application
            </button>
          </div>
        )}

      </div>

    </div>
  );
}

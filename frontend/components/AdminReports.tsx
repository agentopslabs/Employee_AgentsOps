import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  Printer, 
  HelpCircle, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Columns, 
  Calendar,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { User, Application, EmployeeDocument, AssignedTest, TestStatus, UserStatus, UserRole } from "../types";

interface AdminReportsProps {
  employees: User[];
  applications: Application[];
  documents: EmployeeDocument[];
  assignedTests: AssignedTest[];
}

export default function AdminReports({
  employees,
  applications,
  documents,
  assignedTests
}: AdminReportsProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  const [activeReportType, setActiveReportType] = useState<"employees" | "assessments" | "passfail" | "applications" | "documents">("employees");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const rowsPerPage = 5;

  // Statistics summaries
  const totalEmps = employees.length;
  const activeEmps = employees.filter(e => e.status === UserStatus.ACTIVE).length;
  const docsUploaded = documents.length;
  const examsCompleted = assignedTests.filter(t => t.status === TestStatus.COMPLETED).length;
  const passedCount = assignedTests.filter(t => t.status === TestStatus.COMPLETED && t.passed).length;

  // Generate rows based on active report category
  function getReportData() {
    switch (activeReportType) {
      case "employees":
        const filteredEmps = selectedEmployeeId 
          ? employees.filter(e => e.id === selectedEmployeeId)
          : employees;
        return filteredEmps.map(e => ({
          col1: e.name,
          col2: e.email,
          col3: e.mobile,
          col4: e.status.toUpperCase(),
          col5: new Date(e.createdAt).toLocaleDateString()
        })).filter(r => r.col1.toLowerCase().includes(searchTerm.toLowerCase()) || r.col2.toLowerCase().includes(searchTerm.toLowerCase()));

      case "assessments":
        const filteredAssigned = selectedEmployeeId
          ? assignedTests.filter(t => t.employeeId === selectedEmployeeId)
          : assignedTests;
        return filteredAssigned.map(t => {
          const emp = employees.find(e => e.id === t.employeeId);
          return {
            col1: emp ? emp.name : "Unknown Participant",
            col2: t.testName,
            col3: t.status.replace('_', ' ').toUpperCase(),
            col4: t.score !== undefined ? `${t.score}%` : "Not graded",
            col5: t.completedAt ? new Date(t.completedAt).toLocaleDateString() : "Pending"
          };
        }).filter(r => r.col1.toLowerCase().includes(searchTerm.toLowerCase()) || r.col2.toLowerCase().includes(searchTerm.toLowerCase()));

      case "passfail":
        const completedTests = assignedTests.filter(t => t.status === TestStatus.COMPLETED);
        const filteredPf = selectedEmployeeId
          ? completedTests.filter(t => t.employeeId === selectedEmployeeId)
          : completedTests;
        return filteredPf.map(t => {
          const emp = employees.find(e => e.id === t.employeeId);
          return {
            col1: emp ? emp.name : "N/A Candidate",
            col2: t.testName,
            col3: `${t.score}% Score`,
            col4: t.passed ? "PASSED" : "FAILED",
            col5: t.completedAt ? new Date(t.completedAt).toLocaleDateString() : "-"
          };
        }).filter(r => r.col1.toLowerCase().includes(searchTerm.toLowerCase()) || r.col4.toLowerCase().includes(searchTerm.toLowerCase()));

      case "applications":
        const filteredApps = selectedEmployeeId
          ? applications.filter(a => a.employeeId === selectedEmployeeId)
          : applications;
        return filteredApps.map(a => ({
          col1: a.fullName || "Unspecified Draft",
          col2: a.highestQualification || "No Degree",
          col3: a.collegeName || "No University",
          col4: a.status.toUpperCase(),
          col5: a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "Draft"
        })).filter(r => r.col1.toLowerCase().includes(searchTerm.toLowerCase()) || r.col4.toLowerCase().includes(searchTerm.toLowerCase()));

      case "documents":
        const filteredDocs = selectedEmployeeId
          ? documents.filter(d => d.employeeId === selectedEmployeeId)
          : documents;
        return filteredDocs.map(d => {
          const emp = employees.find(e => e.id === d.employeeId);
          return {
            col1: emp ? emp.name : "Anonymous Candidate",
            col2: d.type.toUpperCase(),
            col3: d.fileName,
            col4: d.status.toUpperCase(),
            col5: new Date(d.uploadedAt).toLocaleDateString()
          };
        }).filter(r => r.col1.toLowerCase().includes(searchTerm.toLowerCase()) || r.col2.toLowerCase().includes(searchTerm.toLowerCase()));

      default:
        return [];
    }
  }

  const reportsHeaders = {
    employees: ["Employee Name", "E-Mail Address", "Mobile Cellphone", "Security Access Status", "Joined Onboard Date"],
    assessments: ["Candidate Name", "Assigned Test Campaign", "Shorthand Status", "Exam Score Point", "Completed Timestamp"],
    passfail: ["Onboard Candidate", "Completed Assessment", "Awarded Score Criteria", "Pass/Fail Clear Status", "Graded Period"],
    applications: ["Applicant Candidate", "Completed Degree", "Educational Institute", "SaaS Progress Tag", "Submission Timestamp"],
    documents: ["Onboarding Trainee", "Attachment Category", "Physical Filename", "HR Status Code", "Uploaded Date"]
  };

  const activeHeaders = reportsHeaders[activeReportType];
  const activeRows = getReportData();

  // Reset page when tab, search term, or employee selection changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeReportType, searchTerm, selectedEmployeeId]);

  const totalPages = Math.ceil(activeRows.length / rowsPerPage) || 1;
  const paginatedRows = activeRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Export as CSV Excel mock download
  function handleExportExcel() {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [activeHeaders.join(",")]
      + "\n"
      + activeRows.map(e => [e.col1, e.col2, e.col3, e.col4, e.col5].join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AgentOps_Report_${activeReportType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Print simulation representing PDF export layout
  function handlePrintPDF() {
    window.print();
  }

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/5 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-xl font-black text-[#0A2540] flex items-center gap-2">
            Compliance & Assessment Reporting Desk
            <span className="text-xs bg-indigo-500/15 text-indigo-700 px-2 rounded-full font-mono font-medium border border-indigo-500/25">
              Auditing Center
            </span>
          </h1>
          <p className="text-xs text-slate-700 mt-1">
            Generate formal HR records detailing exam completion rates, document clearance audits, and active recruitment timelines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-705 border border-slate-700/60 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-bold py-2 px-3.5 rounded-lg transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Export MS Excel CSV
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 p-4 rounded-lg transition cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Export/Print PDF Report Sheet
          </button>
        </div>
      </div>

      {/* Categories select tabs row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { id: "employees", label: "Employee Accounts Status", count: totalEmps },
          { id: "assessments", label: "Assessment Campaigns", count: assignedTests.length },
          { id: "passfail", label: "Pass/Fail Statistics", count: examsCompleted },
          { id: "applications", label: "Onboarding Application Profiles", count: applications.length },
          { id: "documents", label: "Uploaded Files Status", count: docsUploaded }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveReportType(tab.id as any);
              setSearchTerm("");
            }}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeReportType === tab.id 
                ? "bg-indigo-600/10 border-indigo-500 text-cyan-400 font-extrabold shadow-sm" 
                : "bg-[#0a0d16]/30 hover:bg-slate-800/10 border-slate-200/10 dark:border-slate-800/80 text-slate-400 hover:text-white"
            }`}
          >
            <h4 className="text-[10px] uppercase font-bold tracking-wider text-[#0A2540]">category</h4>
            <div className="text-[11px] font-bold mt-1 line-clamp-1 text-slate-900">{tab.label}</div>
            <span className="text-[10px] text-indigo-700 font-mono font-bold block mt-1.5">{tab.count} active rows</span>
          </button>
        ))}
      </div>

      {/* Filter and Search inside reports */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by candidate name or other details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-500/5 dark:bg-slate-950 border border-slate-200/20 dark:border-slate-800 text-xs py-2.5 pl-10 pr-4 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Employee selector filter */}
        <div className="w-full md:w-64">
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="">-- All Employees --</option>
            {employees
              .filter(e => e.role === UserRole.EMPLOYEE)
              .map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email})
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Grid Table Display */}
      <div className={`rounded-xl ${cardBg} border border-slate-200/30 dark:border-slate-800/80 overflow-hidden shadow-sm`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[#0A2540] text-slate-205 text-slate-200 text-[10px] uppercase font-black tracking-wider border-b border-slate-850">
                {activeHeaders.map((head, i) => (
                  <th key={i} className={`p-4 ${i === 0 ? 'pl-6' : i === 4 ? 'text-right pr-6' : ''}`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/10 dark:divide-slate-800/70">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No matching generated rows match filter conditions.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-500/5 transition">
                    <td className="p-4 pl-6 font-bold text-slate-900">{row.col1}</td>
                    <td className="p-4 text-slate-800 font-medium">{row.col2}</td>
                    <td className="p-4 text-slate-800 font-mono text-[11px] font-semibold">{row.col3}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.col4.includes("ACTIVE") || row.col4.includes("APPROVED") || row.col4.includes("PASSED")
                          ? "bg-green-500/10 text-green-400" 
                          : row.col4.includes("INACTIVE") || row.col4.includes("REJECTED") || row.col4.includes("FAILED")
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-slate-800 text-slate-400"
                      }`}>
                        {row.col4}
                      </span>
                    </td>
                    <td className="p-4 text-right pr-6 text-slate-700 font-mono text-[10px] font-semibold">{row.col5}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {activeRows.length > 0 && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-200/50 flex items-center justify-between text-xs">
            <span className="text-slate-700 font-semibold">
              Showing <span className="font-black text-[#0A2540]">{(currentPage - 1) * rowsPerPage + 1}</span> to{" "}
              <span className="font-black text-[#0A2540]">
                {Math.min(currentPage * rowsPerPage, activeRows.length)}
              </span>{" "}
              of <span className="font-black text-[#0A2540]">{activeRows.length}</span> entries
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 rounded border border-slate-205 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {Array.from({ length: totalPages }).map((_, pageIdx) => {
                const pageNum = pageIdx + 1;
                const isCurrent = currentPage === pageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 rounded border text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? "bg-indigo-600 border-indigo-600 text-white font-black shadow-sm"
                        : "border-slate-205 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="p-1.5 rounded border border-slate-205 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

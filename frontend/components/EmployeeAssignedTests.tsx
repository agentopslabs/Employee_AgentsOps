import React from "react";
import { 
  BookOpen, 
  Clock, 
  Award, 
  Play, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";
import { AssignedTest, Test, TestStatus } from "../types";

interface EmployeeAssignedTestsProps {
  assignedTests: AssignedTest[];
  tests: Test[];
  onStartTest: (testRecord: AssignedTest) => void;
  isEligible: boolean;
  onSelectTab: (tab: string) => void;
}

export default function EmployeeAssignedTests({
  assignedTests,
  tests,
  onStartTest,
  isEligible,
  onSelectTab
}: EmployeeAssignedTestsProps) {
  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assigned Assessments</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete your requested onboarding credential quizzes and certification exams.
        </p>
      </div>

      {/* Profile Incomplete Disclaimer */}
      {!isEligible && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800 text-sm">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-900">Application Form Pending</h4>
            <p className="text-slate-600">
              You must submit your demographic profile details in the <strong>Application Form</strong> tab before starting any skill evaluation exams. 
            </p>
            <button
              onClick={() => onSelectTab("employee-application")}
              className="text-indigo-600 hover:text-indigo-805 font-semibold text-xs mt-2 inline-flex items-center gap-1 hover:underline"
            >
              Fill Application Form &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tests Grid */}
      {assignedTests.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-900 font-semibold text-sm">No tests assigned</h3>
          <p className="text-slate-505 text-slate-500 text-xs mt-1 max-w-sm mx-auto">
            All your required assessments have been completed, or HR hasn't queued any exams for your account track yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignedTests.map(record => {
            const template = tests.find(t => t.id === record.testId);
            const isCompleted = record.status === TestStatus.COMPLETED;
            const isInProgress = record.status === TestStatus.IN_PROGRESS;
            const passingPct = record.passingMarks || template?.passingMarks || 60;
            const durationMins = template?.duration || 30;

            return (
              <div 
                key={record.id} 
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{record.testName}</h3>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${
                      isCompleted 
                        ? (record.passed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200") 
                        : isInProgress 
                        ? "bg-amber-50 text-amber-700 border border-amber-200" 
                        : "bg-slate-50 text-slate-600 border border-slate-200"
                    }`}>
                      {isCompleted ? (record.passed ? "Passed" : "Failed") : record.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-3">
                    {template?.questions ? `Onboarding certification containing ${template.questions.length} selective multiple-choice evaluation questions.` : "Onboarding core test certification series."}
                  </p>

                  {/* Metadata labels */}
                  <div className="grid grid-cols-2 gap-4 mt-5 pb-5 border-b border-slate-100 text-xs text-slate-600 font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>Duration: {durationMins} mins</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-slate-400" />
                      <span>Passing limit: {passingPct}%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-1">
                  {isCompleted ? (
                    <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 block font-normal">Your Grade</span>
                        <span className="text-slate-950 font-bold font-mono text-sm">{record.score}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                        <CheckCircle className={`h-4 w-4 ${record.passed ? 'text-emerald-500' : 'text-slate-400'}`} />
                        <span>Completed</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      disabled={!isEligible}
                      onClick={() => {
                        if (document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen().catch(() => {});
                        }
                        onStartTest(record);
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition shadow-sm ${
                        isEligible 
                          ? "bg-slate-900 text-white hover:bg-slate-800 cursor-pointer" 
                          : "bg-slate-100 text-slate-450 text-slate-405 cursor-not-allowed border border-slate-200"
                      }`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      {isInProgress ? "Resume Active Test" : "Start Qualification Exam"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

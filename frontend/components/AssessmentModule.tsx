import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Clock, 
  HelpCircle, 
  Maximize, 
  Minimize, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  Send,
  Lock,
  Compass,
  MonitorPlay,
  Terminal,
  Activity,
  CheckCircle,
  XCircle,
  HelpCircle as QuestionIcon
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Test, Question, QuestionType, AssignedTest } from "../types";

interface AssessmentModuleProps {
  testRecord: AssignedTest;
  testTemplate: Test;
  onSubmitted: () => void;
  onExit: () => void;
}

export default function AssessmentModule({
  testRecord,
  testTemplate,
  onSubmitted,
  onExit
}: AssessmentModuleProps) {
  const { isDark, toggleTheme, cardBg, textPrimary, textSecondary } = useTheme();

  // Active question index
  const [activeIdx, setActiveIdx] = useState(0);

  // Selected Answers: questionId -> optionIndices[]
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number[]>>({});

  // Countdown timers (seconds)
  const [timeLeft, setTimeLeft] = useState(() => {
    if (testRecord.remainingTime !== undefined && testRecord.remainingTime !== null) {
      return testRecord.remainingTime;
    }
    return testTemplate.duration * 60;
  });

  // Full Screen modes visual toggle state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Grade/Save feedback
  const [savingState, setSavingState] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<AssignedTest | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Safe backdrop modal confirmation states
  const [confirmModal, setConfirmModal] = useState<{
    type: "pause" | "submit";
    message: string;
  } | null>(null);

  const answersRef = useRef(selectedAnswers);
  const timeLeftRef = useRef(timeLeft);
  const lastSeededIdRef = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    answersRef.current = selectedAnswers;
  }, [selectedAnswers]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Seed existing answers if resumed - track testRecord.id to prevent background polling from resetting candidate selections
  useEffect(() => {
    if (testRecord.id !== lastSeededIdRef.current) {
      lastSeededIdRef.current = testRecord.id;
      if (testRecord.answers) {
        setSelectedAnswers(testRecord.answers);
      } else {
        setSelectedAnswers({});
      }
    }
  }, [testRecord]);

  // Instant or on-demand sync of candidate progress to the server to prevent data loss on page refreshes
  async function saveProgressToServer(answersToSend: Record<string, number[]>, time: number) {
    if (isSubmittingRef.current || submitSuccess) return;
    setSavingState(true);
    try {
      await fetch(`/api/assigned-tests/${testRecord.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersToSend,
          remainingTime: time
        })
      });
    } catch (e) {
      console.error("[Autosave Error] failed syncing progress:", e);
    } finally {
      setTimeout(() => setSavingState(false), 200);
    }
  }

  // Launch countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto Submit!
          handleAutoSubmitOnTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Periodic Auto-Save Draft interval
  useEffect(() => {
    const autosave = setInterval(() => {
      handleAutosaveState();
    }, 8000); // every 8 seconds

    return () => clearInterval(autosave);
  }, []);

  // Integrity Check: Auto-submit on tab switch or browser focus loss
  useEffect(() => {
    async function handleAutoSubmitCheating() {
      if (isSubmittingRef.current || submitSuccess) return;
      console.log("[Integrity Check] Tab switched or focus lost. Submitting exam automatically...");
      await handleSubmitExam();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        handleAutoSubmitCheating();
      }
    }

    function onWindowBlur() {
      handleAutoSubmitCheating();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [submitSuccess]);

  // Request browser Full screen or overlay simulator
  function toggleDisplayFullScreen() {
    if (!isFullScreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  }

  // Automatically request fullscreen on mount and exit fullscreen on unmount
  useEffect(() => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    }

    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Monitor Esc key full screen exits
  useEffect(() => {
    function onFullScreenChange() {
      setIsFullScreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFullScreenChange);
    onFullScreenChange(); // Sync initial state
    return () => document.removeEventListener("fullscreenchange", onFullScreenChange);
  }, []);

  // Autosave answers payload to API
  async function handleAutosaveState() {
    if (isSubmittingRef.current || submitSuccess) return;
    setSavingState(true);
    try {
      await fetch(`/api/assigned-tests/${testRecord.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: answersRef.current,
          remainingTime: timeLeftRef.current
        })
      });
    } catch (e) {
      console.error("[Autosave] Sync error:", e);
    } finally {
      setTimeout(() => setSavingState(false), 300);
    }
  }

  // Answer selections toggles
  function handleToggleOption(qId: string, optIdx: number, qType: QuestionType) {
    const answersArr = selectedAnswers[qId] || [];
    let updated: Record<string, number[]>;

    if (qType === QuestionType.MULTIPLE_CHOICE) {
      // Toggle multiple checkboxes
      if (answersArr.includes(optIdx)) {
        updated = {
          ...selectedAnswers,
          [qId]: answersArr.filter(idx => idx !== optIdx)
        };
      } else {
        updated = {
          ...selectedAnswers,
          [qId]: [...answersArr, optIdx]
        };
      }
    } else {
      // Single choice or boolean
      updated = {
        ...selectedAnswers,
        [qId]: [optIdx]
      };
    }

    setSelectedAnswers(updated);
    saveProgressToServer(updated, timeLeft);
  }

  // Submit test
  async function handleSubmitExam(answersOverride?: Record<string, number[]>) {
    isSubmittingRef.current = true;
    setSavingState(true);
    setSubmitError("");
    const answersToSend = answersOverride || answersRef.current || selectedAnswers;
    try {
      const res = await fetch(`/api/assigned-tests/${testRecord.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersToSend }),
        keepalive: true
      });

      if (res.ok) {
        const payload = await res.json();
        setSubmitSuccess(payload);
      } else {
        isSubmittingRef.current = false;
        setSubmitError("Failed to submit and grade answers.");
      }
    } catch (e) {
      isSubmittingRef.current = false;
      setSubmitError("Failed to communicate with auto grading engine.");
    } finally {
      setSavingState(false);
    }
  }

  // Save progress and pause test (the confirm is handled in React UI before this is called)
  async function handlePauseAndExit() {
    setSavingState(true);
    try {
      const res = await fetch(`/api/assigned-tests/${testRecord.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: selectedAnswers, remainingTime: timeLeft })
      });
      if (res.ok) {
        onExit();
      } else {
        console.error("Failed to pause assessment cleanly on server.");
        onExit(); 
      }
    } catch (e) {
      console.error(e);
      onExit();
    } finally {
      setSavingState(false);
    }
  }

  function handleAutoSubmitOnTimeout() {
    console.log("[Auto-Submit] Timer exceeded!");
    handleSubmitExam();
  }

  const currentQ = testTemplate.questions[activeIdx];
  const totalQuestionsIndex = testTemplate.questions.length;
  const currentHasAnswer = !!(selectedAnswers[currentQ.id] && selectedAnswers[currentQ.id].length > 0);
  const allAnswered = testTemplate.questions.every(q => selectedAnswers[q.id] && selectedAnswers[q.id].length > 0);

  // Formatting utility
  function formatQuizTimer(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  // Timer alerts levels
  const isTimeCritical = timeLeft < 120; // less than 2 mins

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 overflow-y-auto flex flex-col justify-between ${
        isFullScreen ? "bg-white text-slate-800 p-6 md:p-10" : "bg-white/95 backdrop-blur-md p-4 md:p-8"
      }`}
    >
      {/* Top Header Controls bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center gap-3 text-left">
          <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100 text-indigo-600">
            <MonitorPlay className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#0A2540]">{testTemplate.name}</h2>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
              <span>Req Pass Ratio: {testTemplate.passingMarks}%</span>
              <span>•</span>
              {savingState ? (
                <span className="text-indigo-600 animate-pulse flex items-center gap-1">Saving answers...</span>
              ) : (
                <span className="text-slate-500">Auto-save connected</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3.5">
          {/* Fullscreen widget */}
          <button
            onClick={toggleDisplayFullScreen}
            className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
          >
            {isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          {/* TIMER */}
          <div className={`flex items-center gap-2 p-2 px-3.5 rounded-lg border font-mono text-xs font-bold ${
            isTimeCritical 
              ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse" 
              : "bg-slate-100 border-slate-200 text-indigo-650"
          }`}>
            <Clock className={`h-4.5 w-4.5 ${isTimeCritical ? 'animate-bounce' : ''}`} />
            <span>{formatQuizTimer(timeLeft)}</span>
          </div>

          <button
            onClick={() => setConfirmModal({
              type: "pause",
              message: "Any unsaved answers will be retained in state, but you will leave this assessment cycle. Proceed?"
            })}
            className="bg-slate-100 border border-slate-200 hover:bg-slate-200 text-xs text-slate-600 hover:text-slate-900 py-2 px-3.5 rounded-lg font-bold cursor-pointer animate-none"
          >
            Pause & Exit [X]
          </button>
        </div>
      </div>

      {submitError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 animate-bounce" />
          <span className="font-bold text-xs">{submitError}</span>
        </div>
      )}

      {/* Warning layout simulation about full screen */}
      {!isFullScreen && !submitSuccess && (
        <div className="mb-6 p-3 bg-indigo-50 border border-indigo-100 text-indigo-750 text-[10px] rounded-lg text-left flex items-center gap-2.5 leading-snug">
          <AlertTriangle className="h-4 w-4 text-indigo-600 flex-shrink-0" />
          <p className="text-indigo-950 font-medium">
            🛡 Candidate Notice: We recommend toggling <span className="font-extrabold text-indigo-600 cursor-pointer underline" onClick={toggleDisplayFullScreen}>FULL SCREEN MODE [Fullscreen]</span> to preserve integrity checks of the assessment layout and eliminate distracting browser notifications.
          </p>
        </div>
      )}

      {/* Main Panel Content split: Left question, Right index mapper */}
      {submitSuccess ? (
        // Successful submit results display screen
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-6">
          <div className={`p-8 bg-slate-50 border border-slate-200 rounded-2xl w-full text-xs space-y-5 leading-normal`}>
            {submitSuccess.passed ? (
              <div className="flex flex-col items-center">
                <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 animate-bounce">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black text-slate-800">CERTIFICATE PASSED!</h3>
                <p className="text-slate-600 mt-1 max-w-sm font-semibold">Congratulations! Your score met the passing criteria. Automated notification dispatched to HR.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-14 w-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-3 animate-pulse">
                  <XCircle className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black text-slate-800">ASSESSMENT FAILED</h3>
                <p className="text-slate-600 mt-1 max-w-xs font-semibold">Your grade fell below the minimum score threshold. Retaking this assessment is not permitted.</p>
              </div>
            )}

            <div className="p-4 bg-white font-mono rounded-lg border border-slate-200 flex justify-between gap-4 text-left">
              <div>
                <p><span className="text-slate-500">Participant:</span> <span className="text-slate-800 font-bold">Candidate Workspace</span></p>
                <p><span className="text-slate-500">Quiz:</span> <span className="text-slate-800 font-bold">{testTemplate.name}</span></p>
                <p><span className="text-slate-500">Criteria Passing score:</span> <span className="text-slate-800 font-bold">{testTemplate.passingMarks}%</span></p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">YOUR RESULT</span>
                <h2 className={`text-2xl font-black ${submitSuccess.passed ? 'text-green-600' : 'text-rose-600'}`}>
                  {submitSuccess.score}% ({submitSuccess.score} / 100 Marks)
                </h2>
                <span className={`text-[10px] font-bold ${submitSuccess.passed ? 'text-green-650' : 'text-rose-650'}`}>
                  {submitSuccess.passed ? "APPROVED" : "UNAPPROVED"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSubmitted}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs py-3 rounded-lg transition cursor-pointer"
            >
              Back to Dashboard Overview
            </button>
          </div>
        </div>
      ) : (
        // Interactive questionnaire panels
        <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-8 text-xs text-left mb-6">
          
          {/* Left panel: Active question */}
          <div className="md:col-span-8 flex flex-col justify-between">
            <div className="bg-slate-50 border border-slate-200/80 p-6 md:p-8 rounded-xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono border-b border-slate-200 pb-3">
                <span className="text-purple-700 font-extrabold uppercase">Question {activeIdx + 1} of {totalQuestionsIndex}</span>
                <span className="text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-bold">
                  Module: {currentQ.moduleName || "General"}
                </span>
                <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  Marks: {(100 / totalQuestionsIndex).toFixed(2)}
                </span>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.2 rounded uppercase">
                  {currentQ.type.replace('_', ' ')}
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 font-mono tracking-wide leading-relaxed">
                {currentQ.text}
              </h4>

              {/* Answers options rendering */}
              <div className="space-y-3 pt-2">
                {currentQ.options.map((opt, oIdx) => {
                  const answersArr = selectedAnswers[currentQ.id] || [];
                  const isSelected = answersArr.includes(oIdx);

                  return (
                    <div
                      key={oIdx}
                      onClick={() => handleToggleOption(currentQ.id, oIdx, currentQ.type)}
                      className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-indigo-50 border-indigo-500 text-indigo-950 shadow-md translate-x-1" 
                          : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* option index circle letter */}
                        <div className={`h-6 w-6 rounded-lg text-[11px] font-black font-mono flex items-center justify-center border ${
                          isSelected ? "bg-indigo-600 border-indigo-500 text-white" : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <span className="font-medium">{opt}</span>
                      </div>

                      {/* checkbox/radio visual decoration feedback */}
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        isSelected ? "bg-indigo-600 border-indigo-500" : "border-slate-300"
                      }`}>
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Back Forward Navigation triggers */}
            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx(activeIdx - 1)}
                className={`flex items-center gap-1.5 py-2 px-4 rounded-lg font-bold text-xs transition border ${
                  activeIdx === 0 
                    ? "text-slate-300 border-slate-200 bg-transparent cursor-not-allowed" 
                    : "text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer"
                }`}
              >
                <ChevronLeft className="h-4 w-4" /> Previous Question
              </button>

              {activeIdx === totalQuestionsIndex - 1 ? (
                <button
                  onClick={() => {
                    const unansweredCount = testTemplate.questions.filter(q => !selectedAnswers[q.id] || selectedAnswers[q.id].length === 0).length;
                    const confirmMsg = unansweredCount > 0 
                      ? `Warning: You have omitted ${unansweredCount} questions. Submit answers anyway for HR grading?`
                      : "Submit assessment and calculate scoring outcomes immediately?";
                    setConfirmModal({
                      type: "submit",
                      message: confirmMsg
                    });
                  }}
                  className="flex items-center gap-1.5 py-2 px-5 rounded-lg bg-gradient-to-r from-[#F1B814] to-[#f7cc4b] hover:from-[#f7cc4b] hover:to-[#F1B814] text-slate-950 font-black text-xs shadow-lg cursor-pointer uppercase"
                >
                  Submit Assessment <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setActiveIdx(activeIdx + 1)}
                  className="flex items-center gap-1.5 py-2 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer border border-transparent"
                >
                  {currentHasAnswer ? "Next Question" : "Skip Question"} <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right panel: Indexes navigator list */}
          <div className="md:col-span-4 space-y-4">
            <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-widest border-b border-slate-200 pb-2">
                📋 Questionnaire Index Sheet
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">Click indices below to quickly slide across assessment cards.</p>

              <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                {Object.entries(
                  testTemplate.questions.reduce((acc, q, idx) => {
                    const mod = q.moduleName || "General";
                    if (!acc[mod]) acc[mod] = [];
                    acc[mod].push({ q, originalIdx: idx });
                    return acc;
                  }, {} as Record<string, { q: Question; originalIdx: number }[]>)
                ).map(([moduleName, items]) => (
                  <div key={moduleName} className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                      <span className="text-[10px] font-black text-slate-500 tracking-wider uppercase">{moduleName}</span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {items.length} Qs • {((items.length / totalQuestionsIndex) * 100).toFixed(0)} Marks
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 pt-1">
                      {items.map(({ q, originalIdx }) => {
                        const hasAnswered = selectedAnswers[q.id] && selectedAnswers[q.id].length > 0;
                        const isActive = originalIdx === activeIdx;

                        return (
                          <button
                            key={q.id}
                            onClick={() => setActiveIdx(originalIdx)}
                            className={`h-9 rounded-lg font-mono text-[11px] font-bold flex flex-col items-center justify-center border relative cursor-pointer transition-all ${
                              isActive 
                                ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/10 font-black" 
                                : hasAnswered 
                                ? "bg-[#F1B814]/10 border-[#F1B814]/30 text-amber-800" 
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            }`}
                          >
                            {originalIdx + 1}
                            {hasAnswered && (
                              <span className="absolute bottom-1 right-1 h-1 w-1 rounded-full bg-[#F1B814]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-mono text-slate-500 uppercase">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-indigo-50 border border-indigo-500/40" /> Active screen</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-[#F1B814]/10 border border-[#F1B814]/40" /> Answered card</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-white border border-slate-200" /> Unanswered</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safe dialog backdrop overlay (immune to iframe browser blocking constraints) */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border-2 border-[#F1B814] rounded-2xl max-w-sm w-full p-6 text-left space-y-4 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-xs font-black uppercase text-[#0A2540] tracking-wider">
                {confirmModal.type === "pause" ? "Pause & Exit Test" : "Submit Assessment"}
              </h4>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed font-semibold">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={savingState}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingState}
                onClick={async () => {
                  if (confirmModal.type === "pause") {
                    await handlePauseAndExit();
                  } else {
                    await handleSubmitExam();
                  }
                  setConfirmModal(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-[#F1B814] hover:bg-[#f7cc4b] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {savingState ? (
                  <>
                    <span className="h-3 w-3 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

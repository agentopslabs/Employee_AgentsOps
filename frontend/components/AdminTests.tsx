import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit, 
  Copy, 
  Trash, 
  Save, 
  X, 
  FileCheck, 
  Layers, 
  Clock, 
  HelpCircle,
  HelpCircle as QuestionIcon,
  CheckCircle
} from "lucide-react";
import { useTheme } from "./ThemeContext";
import { Test, Question, QuestionType } from "../types";

interface AdminTestsProps {
  tests: Test[];
  onRefreshAll: () => void;
}

export default function AdminTests({
  tests,
  onRefreshAll
}: AdminTestsProps) {
  const { cardBg, cardHeaderBg, textPrimary, textSecondary } = useTheme();

  // Create/Edit State
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Form states
  const [testName, setTestName] = useState("");
  const [testDuration, setTestDuration] = useState(15);
  const [testPassingMarks, setTestPassingMarks] = useState(70);
  const [testIsPublished, setTestIsPublished] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Active question being edited in form
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);

  function handleStartCreate() {
    setEditingTest(null);
    setIsNew(true);
    setTestName("");
    setTestDuration(15);
    setTestPassingMarks(70);
    setTestIsPublished(true);
    setQuestions([
      {
        id: `q-${Date.now()}-1`,
        text: "Sample Single Match Question?",
        type: QuestionType.SINGLE_CHOICE,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswers: [0],
        moduleName: "General"
      }
    ]);
    setActiveQuestionId(`q-${Date.now()}-1`);
  }

  function handleStartEdit(test: Test) {
    setIsNew(false);
    setEditingTest(test);
    setTestName(test.name);
    setTestDuration(test.duration);
    setTestPassingMarks(test.passingMarks);
    setTestIsPublished(test.isPublished);
    setQuestions([...test.questions]);
    if (test.questions.length > 0) {
      setActiveQuestionId(test.questions[0].id);
    } else {
      setActiveQuestionId(null);
    }
  }

  // Duplicate test
  async function handleDuplicate(id: string) {
    try {
      const res = await fetch(`/api/tests/${id}/duplicate`, { method: "POST" });
      if (res.ok) {
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Delete test
  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/tests/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingTestId(null);
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Question manipulation within state form
  function handleAddQuestion() {
    const newQId = `q-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const newQ: Question = {
      id: newQId,
      text: "New Option Question Details?",
      type: QuestionType.SINGLE_CHOICE,
      options: ["True", "False"],
      correctAnswers: [0],
      moduleName: "General"
    };
    setQuestions([...questions, newQ]);
    setActiveQuestionId(newQId);
  }

  function handleUpdateQuestionModule(qId: string, val: string) {
    setQuestions(questions.map(q => q.id === qId ? { ...q, moduleName: val } : q));
  }

  function handleRemoveQuestion(qId: string) {
    if (questions.length <= 1) {
      alert("An assessment template must house at least 1 question.");
      return;
    }
    const updated = questions.filter(q => q.id !== qId);
    setQuestions(updated);
    if (activeQuestionId === qId) {
      setActiveQuestionId(updated[0].id);
    }
  }

  function handleUpdateQuestionText(qId: string, val: string) {
    setQuestions(questions.map(q => q.id === qId ? { ...q, text: val } : q));
  }

  function handleUpdateQuestionType(qId: string, val: QuestionType) {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        // Fallback options
        const opts = val === QuestionType.TRUE_FALSE ? ["True", "False"] : ["Option 1", "Option 2", "Option 3", "Option 4"];
        return {
          ...q,
          type: val,
          options: opts,
          correctAnswers: [0]
        };
      }
      return q;
    }));
  }

  function handleUpdateOption(qId: string, optIdx: number, val: string) {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const updatedOpts = [...q.options];
        updatedOpts[optIdx] = val;
        return { ...q, options: updatedOpts };
      }
      return q;
    }));
  }

  function handleAddOption(qId: string) {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return { ...q, options: [...q.options, `New Option ${q.options.length + 1}`] };
      }
      return q;
    }));
  }

  function handleRemoveOption(qId: string, optIdx: number) {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        if (q.options.length <= 2) {
          alert("Option counts cannot drop below 2 items.");
          return q;
        }
        const updatedOpts = q.options.filter((_, idx) => idx !== optIdx);
        // Correct answers index offsets adjustments
        const updatedCorrArr = q.correctAnswers
          .map(c => (c > optIdx ? c - 1 : c))
          .filter(c => c >= 0 && c < updatedOpts.length);
        
        return {
          ...q,
          options: updatedOpts,
          correctAnswers: updatedCorrArr.length > 0 ? updatedCorrArr : [0]
        };
      }
      return q;
    }));
  }

  function handleToggleCorrect(qId: string, optIdx: number, isMulti: boolean) {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        if (isMulti) {
          const arr = [...q.correctAnswers];
          if (arr.includes(optIdx)) {
            // keep at least 1 correct index
            if (arr.length === 1) return q;
            return { ...q, correctAnswers: arr.filter(c => c !== optIdx) };
          } else {
            return { ...q, correctAnswers: [...arr, optIdx] };
          }
        } else {
          return { ...q, correctAnswers: [optIdx] };
        }
      }
      return q;
    }));
  }

  async function handleSaveTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testName.trim()) return;

    const payload = {
      name: testName,
      duration: Number(testDuration),
      passingMarks: Number(testPassingMarks),
      questions,
      isPublished: testIsPublished
    };

    try {
      let res;
      if (isNew) {
        res = await fetch("/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else if (editingTest) {
        res = await fetch(`/api/tests/${editingTest.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res && res.ok) {
        setEditingTest(null);
        setIsNew(false);
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* List / Form layout */}
      {editingTest || isNew ? (
        // Test Creator / Editor Panel
        <form onSubmit={handleSaveTest} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-xl font-black text-[#0A2540] flex items-center gap-2">
                {isNew ? "Draft New Exam Assessment" : `Edit assessment: ${testName}`}
                <span className="text-xs font-mono font-medium tracking-tight bg-indigo-50 text-indigo-705 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Creator Mode
                </span>
              </h1>
              <p className="text-xs text-slate-700 mt-1">Configure duration timeouts, passing criteria, and questionnaire trees.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingTest(null);
                  setIsNew(false);
                }}
                className="bg-slate-100 text-slate-700 font-black text-xs py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-200 cursor-pointer uppercase transition-all"
              >
                Cancel Draft [X]
              </button>
              <button
                type="submit"
                className="bg-[#0A2540] hover:bg-[#0c1a30] text-white font-black text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-md cursor-pointer uppercase transition-all"
              >
                <Save className="h-4 w-4 text-[#F1B814]" /> Save Standard Template
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-xs">
            {/* Sidebar configurations settings */}
            <div className={`lg:col-span-4 rounded-xl bg-white border border-slate-200 p-6 space-y-4 h-fit shadow-sm`}>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                ⚙️ Core Parameters Setup
              </h4>
              <div className="space-y-3 leading-none">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Assessment Campaign Name</label>
                  <input
                    type="text"
                    required
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g. Core React Skill Exam"
                    className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1 text-[10px]">DURATION (MINS)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={120}
                      value={testDuration}
                      onChange={(e) => setTestDuration(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-bold block mb-1 text-[10px]">PASS SCORE (%)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={100}
                      value={testPassingMarks}
                      onChange={(e) => setTestPassingMarks(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-bold block">Randomize Question Order *</span>
                    <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded bg-white border border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-bold block">Clear Auto Submit on Timeout *</span>
                    <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded bg-white border border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-bold block">Candidate Published State</span>
                    <input
                      type="checkbox"
                      checked={testIsPublished}
                      onChange={(e) => setTestIsPublished(e.target.checked)}
                      className="h-3.5 w-3.5 rounded bg-white border border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Questions editing board */}
            <div className="lg:col-span-8 space-y-6">
              <div className={`rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm`}>
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-4.5 w-4.5 text-indigo-500" /> Compiled Questions Stack ({questions.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="bg-[#0A2540] hover:bg-[#0c1a30] text-white font-semibold p-1.5 px-3.5 rounded-lg flex items-center gap-1 shadow-md cursor-pointer transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#F1B814]" /> Append Question
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 min-h-[300px]">
                  {/* Left Column Questionnaire list map */}
                  <div className="md:col-span-4 border-r border-slate-200 bg-slate-50 max-h-[440px] overflow-y-auto">
                    {questions.map((q, idx) => (
                      <div
                        key={q.id}
                        onClick={() => setActiveQuestionId(q.id)}
                        className={`p-3.5 cursor-pointer text-left border-b border-slate-200/60 hover:bg-slate-100/80 flex justify-between gap-1 transition-all ${
                          activeQuestionId === q.id ? "bg-indigo-50/55 border-l-4 border-indigo-600" : ""
                        }`}
                      >
                        <div className="truncate flex-1">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-indigo-500">Question #{idx + 1}</p>
                          <h5 className="font-extrabold text-slate-800 py-0.5 truncate">{q.text}</h5>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono uppercase font-bold">
                              {q.type.replace('_',' ')}
                            </span>
                            <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono uppercase font-bold">
                              Mod: {q.moduleName || "General"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveQuestion(q.id);
                          }}
                          className="hover:text-red-500 text-slate-400"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Right Question Detail Customizer Form */}
                  <div className="md:col-span-8 p-5 space-y-4 max-h-[440px] overflow-y-auto scrollbar-thin">
                    {activeQuestionId ? (
                      (() => {
                        const activeQ = questions.find(q => q.id === activeQuestionId);
                        if (!activeQ) return null;
                        const isMultiple = activeQ.type === QuestionType.MULTIPLE_CHOICE;
                        
                        return (
                          <div className="space-y-4">
                            <div>
                              <label className="text-slate-700 font-bold block mb-1">Question Display Text</label>
                              <textarea
                                required
                                value={activeQ.text}
                                onChange={(e) => handleUpdateQuestionText(activeQ.id, e.target.value)}
                                rows={2}
                                className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none font-sans"
                              />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex-1">
                                <label className="text-slate-700 font-bold block mb-1">Input Format Type</label>
                                <select
                                  value={activeQ.type}
                                  onChange={(e) => handleUpdateQuestionType(activeQ.id, e.target.value as QuestionType)}
                                  className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:outline-none focus:ring-0 cursor-pointer"
                                >
                                  <option value={QuestionType.SINGLE_CHOICE}>Single Choice MCQ</option>
                                  <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choices MCQ</option>
                                  <option value={QuestionType.TRUE_FALSE}>True / False Binary Option</option>
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="text-slate-700 font-bold block mb-1">Module / Section Name</label>
                                <input
                                  type="text"
                                  required
                                  value={activeQ.moduleName || "General"}
                                  onChange={(e) => handleUpdateQuestionModule(activeQ.id, e.target.value)}
                                  placeholder="e.g. Verbal Ability, Technical Skills"
                                  className="w-full bg-white border border-slate-300 rounded p-2.5 text-slate-800 focus:border-indigo-500 focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Options Drafting */}
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-700 font-bold block">Draft Options Choice Checklist</span>
                                {activeQ.type !== QuestionType.TRUE_FALSE && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddOption(activeQ.id)}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-500 font-black uppercase"
                                  >
                                    [+ Append Choice Option]
                                  </button>
                                )}
                              </div>

                              <div className="space-y-2">
                                {activeQ.options.map((opt, oIdx) => {
                                  const isCorrect = activeQ.correctAnswers.includes(oIdx);
                                  return (
                                    <div key={oIdx} className="flex items-center gap-2">
                                      {/* check indicator */}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCorrect(activeQ.id, oIdx, isMultiple)}
                                        className={`h-6 w-6 rounded flex items-center justify-center font-black text-xs border transition cursor-pointer ${
                                          isCorrect 
                                            ? "bg-emerald-50 border-emerald-500/40 text-emerald-600" 
                                            : "bg-slate-50 border-slate-300 text-slate-400 hover:border-slate-400"
                                        }`}
                                        title="Toggle correct answer index selection state"
                                      >
                                        {isCorrect ? "✔" : ""}
                                      </button>
                                      
                                      <input
                                        type="text"
                                        required
                                        value={opt}
                                        disabled={activeQ.type === QuestionType.TRUE_FALSE}
                                        onChange={(e) => handleUpdateOption(activeQ.id, oIdx, e.target.value)}
                                        className="flex-1 bg-white border border-slate-300 rounded p-2 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-505"
                                      />

                                      {activeQ.type !== QuestionType.TRUE_FALSE && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveOption(activeQ.id, oIdx)}
                                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-[10px] text-amber-800 leading-snug mt-2 bg-amber-50 p-2.5 border border-amber-200 rounded-lg">
                                💡 Tip: Click the left bracket square box to mark option as CORRECT answers. Green indicators reveal standard correct values.
                              </p>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <QuestionIcon className="h-10 w-10 text-slate-700 animate-pulse mb-2" />
                        <p className="text-slate-500">Pick or append questions to customize answers configurations.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        // Standard Tests list View
        <>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200/5 dark:border-slate-800/80 pb-6">
            <div>
              <h1 className="text-xl font-black text-[#0A2540] flex items-center gap-2">
                Certification Custom Tests Configuration
                <span className="text-xs bg-cyan-500/15 text-cyan-705 px-2 rounded-full font-mono font-medium border border-cyan-500/25">
                  Settings Board
                </span>
              </h1>
              <p className="text-xs text-slate-700 mt-1">
                Establish MCQ and boolean grading assessments. Edit layouts, duplicate templates, delete configurations and toggle accessibility status.
              </p>
            </div>
            <button
              onClick={handleStartCreate}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Draft Assessment
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {tests.length === 0 ? (
              <p className="p-10 text-center text-slate-500 md:col-span-2">No tests created yet. Try drafting a certification.</p>
            ) : (
              tests.map(test => (
                <div 
                  key={test.id}
                  className={`rounded-xl ${cardBg} border border-slate-200 p-6 flex flex-col justify-between hover:scale-[1.01] hover:border-indigo-400 transition-all duration-300 relative group overflow-hidden text-left`}
                >
                  <div className="absolute right-3.5 top-3 bg-slate-100 p-1 rounded-md text-[10px] font-mono text-indigo-700 uppercase tracking-widest border border-slate-200">
                    ID: {test.id.substring(0, 12)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4.5 w-4.5 text-indigo-500" />
                      <span className={`text-[9px] uppercase px-2 py-0.2 rounded font-black border ${
                        test.isPublished 
                          ? "bg-green-500/10 text-green-700 border-green-500/20" 
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {test.isPublished ? "PUBLISHED" : "UNPUBLISHED"}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 mb-2 truncate max-w-[280px]">
                      {test.name}
                    </h3>

                    <div className="grid grid-cols-3 gap-3.5 border-t border-b border-slate-100 py-3 mb-4 leading-none">
                      <div>
                        <span className="text-[10px] text-slate-700 block font-semibold">TIME DURATION</span>
                        <span className="text-xs font-bold flex items-center gap-1 mt-1 text-slate-800">
                          <Clock className="h-3 w-3 text-cyan-600" /> {test.duration} mins
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-700 block font-semibold">PASS THRESHOLD</span>
                        <span className="text-xs font-bold flex items-center gap-1 mt-1 text-slate-800">
                          <CheckCircle className="h-3 w-3 text-emerald-600" /> {test.passingMarks}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-700 block font-semibold">QUESTIONS COUNT</span>
                        <span className="text-xs font-bold block mt-1 text-slate-800">
                          {test.questions.length} items
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1 mt-2">
                    <span className="text-[10px] text-slate-550 font-mono italic">
                      Formed: {new Date(test.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(test)}
                        className="bg-slate-900 hover:bg-slate-850 text-white font-bold p-1 px-2.5 rounded text-[10px] transition"
                      >
                        Edit Layout
                      </button>
                      <button
                        onClick={() => handleDuplicate(test.id)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 p-1 rounded transition"
                        title="Duplicate Template"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {deletingTestId === test.id ? (
                        <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded p-0.5 animate-pulse">
                          <span className="text-[9px] font-bold text-red-700 px-1 leading-none">Delete template?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(test.id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-[9px] px-1.5 py-0.5 rounded uppercase leading-none"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTestId(null)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] px-1.5 py-0.5 rounded border border-slate-300 leading-none"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingTestId(test.id)}
                          className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 p-1.5 rounded transition"
                          title="Delete Template"
                        >
                          <Trash className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

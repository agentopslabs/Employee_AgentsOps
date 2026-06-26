import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Highlighter, 
  Trash2, 
  Plus, 
  Check, 
  X, 
  HelpCircle, 
  Lock, 
  Eye, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle,
  HelpCircle as InfoIcon,
  MousePointerClick
} from "lucide-react";
import { DocumentAnnotation } from "../types";

interface DocumentAnnotationOverlayProps {
  documentId: string;
  isAdmin: boolean;
  onAnnotationCountChange?: (count: number) => void;
  children?: React.ReactNode;
}

export default function DocumentAnnotationOverlay({
  documentId,
  isAdmin,
  onAnnotationCountChange,
  children
}: DocumentAnnotationOverlayProps) {
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Annotation modes: "interact" (original viewer, no overlay blocker) or "annotate" (blocking overlay for pin drop/highlights)
  const [mode, setMode] = useState<"interact" | "annotate">("annotate");

  // Current logged in administrator name
  const [adminName, setAdminName] = useState("Admin Auditor");

  // Form states for creating a new annotation
  const [newAnnotation, setNewAnnotation] = useState<{
    x: number;
    y: number;
    type: "comment" | "highlight";
    color: string;
    text: string;
    width?: number;
    height?: number;
  } | null>(null);

  // Active hover/selected ID to focus or flash annotations
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Colors mapping for visualization
  const colorList = [
    { name: "Warning Amber", hex: "#fbbf24", bg: "bg-amber-400", border: "border-amber-500", highlightBg: "bg-amber-300/30" },
    { name: "Critical Rose", hex: "#f43f5e", bg: "bg-rose-500", border: "border-rose-600", highlightBg: "bg-rose-400/30" },
    { name: "Cyan Focus", hex: "#06b6d4", bg: "bg-cyan-500", border: "border-cyan-600", highlightBg: "bg-cyan-400/30" },
    { name: "Approved Green", hex: "#10b981", bg: "bg-emerald-500", border: "border-emerald-600", highlightBg: "bg-emerald-400/30" }
  ];

  // Load Administrator Details & Document Annotations
  useEffect(() => {
    let active = true;
    
    // Attempt to load administrator name
    const token = localStorage.getItem("agentops_jwt");
    if (token) {
      fetch("/api/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(userData => {
        if (active && userData && userData.name) {
          setAdminName(userData.name);
        }
      })
      .catch(() => {});
    }

    // Load existing annotations
    async function fetchAnnotations() {
      try {
        setLoading(true);
        const res = await fetch(`/api/documents/${documentId}/annotations`);
        if (!res.ok) throw new Error("Could not retrieve file annotations.");
        const data = await res.json();
        if (active) {
          setAnnotations(data);
          if (onAnnotationCountChange) {
            onAnnotationCountChange(data.length);
          }
        }
      } catch (e: any) {
        if (active) setErrorMsg(e.message || "Failed to load audit layers.");
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAnnotations();

    return () => {
      active = false;
    };
  }, [documentId]);

  // Handle transparent canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "annotate" || !isAdmin) return;

    // Prevent trigger if they are clicking a popup window or existing marker node
    const target = e.target as HTMLElement;
    if (target.closest(".annotation-popup") || target.closest(".annotation-marker")) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setNewAnnotation({
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      type: "comment",
      color: "#fbbf24", // yellow/amber default
      text: "",
      width: 30, // highlight standard width percent
      height: 6   // highlight standard height percent
    });
  };

  // Submit annotation to backend
  const handleSaveAnnotation = async () => {
    if (!newAnnotation || !newAnnotation.text.trim()) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: newAnnotation.x,
          y: newAnnotation.y,
          width: newAnnotation.type === "highlight" ? newAnnotation.width : undefined,
          height: newAnnotation.type === "highlight" ? newAnnotation.height : undefined,
          text: newAnnotation.text,
          author: adminName,
          color: newAnnotation.color,
          type: newAnnotation.type
        })
      });

      if (!res.ok) throw new Error("Failed to store audit marker.");
      const saved = await res.json();
      
      const updated = [...annotations, saved];
      setAnnotations(updated);
      if (onAnnotationCountChange) {
        onAnnotationCountChange(updated.length);
      }
      setNewAnnotation(null);
    } catch (e: any) {
      alert(e.message || "Communication failure.");
    }
  };

  // Delete annotation from backend
  const handleDeleteAnnotation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;

    try {
      const res = await fetch(`/api/documents/${documentId}/annotations/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Could not erase annotation layer.");
      
      const updated = annotations.filter(a => a.id !== id);
      setAnnotations(updated);
      if (onAnnotationCountChange) {
        onAnnotationCountChange(updated.length);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="w-full flex flex-col md:flex-row border border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative min-h-[500px]" id="annotation-main-wrapper">
      
      {/* 1. Left side Content Preview & Glass Layer Canvas */}
      <div className="flex-1 relative flex flex-col bg-slate-200">
        
        {/* Ribbon Header with audit control systems */}
        <div className="bg-slate-900 text-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-950 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="font-mono text-[10px] tracking-wide uppercase text-slate-300">
              Interactive Compliance Markup Panel
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-sans">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode("annotate");
                    setNewAnnotation(null);
                  }}
                  className={`px-2 py-1 rounded font-bold cursor-pointer transition flex items-center gap-1 ${
                    mode === "annotate" 
                      ? "bg-indigo-600 text-white" 
                      : "bg-slate-800 text-slate-300 hover:bg-slate-750"
                  }`}
                  title="Enable glass overlay to add highlights or comment pins"
                >
                  <MousePointerClick className="h-3 w-3 text-indigo-200" />
                  <span>Annotate Layer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("interact");
                    setNewAnnotation(null);
                  }}
                  className={`px-2 py-1 rounded font-bold cursor-pointer transition flex items-center gap-1 ${
                    mode === "interact" 
                      ? "bg-emerald-600 text-white" 
                      : "bg-slate-800 text-slate-300 hover:bg-slate-750"
                  }`}
                  title="Allow direct viewport interact zoom, scroll and print"
                >
                  <Eye className="h-3 w-3 text-emerald-200" />
                  <span>Interact PDF</span>
                </button>
              </>
            ) : (
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded font-mono">
                READ-ONLY AUDIT PREVIEW
              </span>
            )}
          </div>
        </div>

        {/* Informative Hint Bar */}
        {isAdmin && mode === "annotate" && (
          <div className="bg-amber-50 text-amber-900 px-4 py-1.5 border-b border-amber-200 text-[10px] flex items-center justify-between font-sans shadow-sm">
            <span className="font-semibold flex items-center gap-1.5">
              <InfoIcon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Annotation Mode Active: Click anywhere on the preview area below to drop a pin or highlight.</span>
            </span>
            <span className="text-[9px] font-mono select-none px-1.5 py-0.2 bg-amber-200/50 rounded text-amber-800">
              Responsive % Matrix
            </span>
          </div>
        )}

        {/* Outer view container representing the PDF frame */}
        <div 
          className="relative w-full overflow-hidden select-none bg-slate-800 flex items-center justify-center p-0.5" 
          id="canvas-gesture-stage"
          style={{ height: "460px" }}
        >
          {/* Glass Overlay Canvas (only intercepts when in annotation mode) */}
          {mode === "annotate" && isAdmin && (
            <div 
              onClick={handleCanvasClick}
              className="absolute inset-0 z-20 cursor-crosshair bg-indigo-500/[0.04] transition"
              id="compliance-matrix-glass-pane"
              title="Click on the document to add a secure comment pin or highlight box"
            />
          )}

          {/* Render Saved Annotations overlays responsive on top of stage */}
          <div className="absolute inset-0 pointer-events-none z-30" id="rendered-pins-portal">
            {annotations.map((ann) => {
              const matchesColor = colorList.find(c => c.hex === ann.color) || colorList[0];
              const isFocused = hoveredAnnotationId === ann.id;

              if (ann.type === "highlight") {
                return (
                  <div
                    key={ann.id}
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      width: `${ann.width || 30}%`,
                      height: `${ann.height || 6}%`,
                      opacity: isFocused ? 0.95 : 0.65,
                      transform: isFocused ? "scale(1.02)" : "scale(1)",
                      borderWidth: isFocused ? "2px" : "1px"
                    }}
                    className={`absolute pointer-events-auto rounded transition-all duration-150 border ${matchesColor.border} ${matchesColor.highlightBg} cursor-pointer group shadow-sm`}
                    onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                    onMouseLeave={() => setHoveredAnnotationId(null)}
                  >
                    {/* Tiny visual handle on highlight hovered */}
                    <div className="hidden group-hover:block absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900 text-[9px] text-white font-bold py-0.5 px-2 rounded whitespace-nowrap z-50 shadow font-sans">
                      {ann.text}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={ann.id}
                  style={{
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                  }}
                  className="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer group annotation-marker"
                  onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                  onMouseLeave={() => setHoveredAnnotationId(null)}
                >
                  <div
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-white border border-white font-bold text-[10px] transition-all duration-150 ${matchesColor.bg} ${
                      isFocused ? "scale-125 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" : "scale-100 shadow-sm"
                    }`}
                  >
                    <MessageSquare className="h-2.5 w-2.5 fill-white" />
                  </div>

                  {/* Pulsing visual halo */}
                  <span className={`absolute top-0 left-0 h-5 w-5 rounded-full -z-10 animate-ping opacity-25 ${matchesColor.bg}`} />

                  {/* Comment popover tooltip on hover */}
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-950 text-white p-3 rounded-lg w-52 shadow-2xl scale-0 group-hover:scale-100 transition-all origin-left z-50 font-sans pointer-events-none text-left">
                    <span className="block text-[8px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">
                      {ann.author}
                    </span>
                    <p className="text-[10px] font-medium leading-relaxed mb-1.5">{ann.text}</p>
                    <span className="block text-[7px] text-slate-400 text-right mt-1 font-mono">
                      {new Date(ann.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* POPULAR PLACEHOLDER FORM FOR DROPPED PIN (Create new annotation form popup) */}
          {newAnnotation && (
            <div
                style={{
                  top: `${newAnnotation.y > 60 ? newAnnotation.y - 45 : newAnnotation.y + 2}%`,
                  left: `${newAnnotation.x > 70 ? newAnnotation.x - 45 : newAnnotation.x + 2}%`,
                }}
                className="absolute z-40 bg-white border border-slate-350 shadow-2xl p-4 rounded-xl w-64 text-left annotation-popup space-y-3 font-sans border border-slate-200"
              >
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wide flex items-center gap-1 select-none">
                    {newAnnotation.type === "highlight" ? <Highlighter className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                    Add Annotation Drop
                  </span>
                  <button 
                    type="button"
                    onClick={() => setNewAnnotation(null)}
                    className="p-0.5 hover:bg-slate-100 rounded text-slate-400 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Coordinate metadata indicator */}
                <div className="text-[8px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded flex justify-between select-none">
                  <span>Relative Position:</span>
                  <span>X: {newAnnotation.x}% • Y: {newAnnotation.y}%</span>
                </div>

                {/* Annotation type selector */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewAnnotation({ ...newAnnotation, type: "comment" })}
                    className={`py-1 px-2 rounded-lg text-[10px] font-bold text-center cursor-pointer flex items-center justify-center gap-1 transition ${
                      newAnnotation.type === "comment"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span>Comment Pin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAnnotation({ ...newAnnotation, type: "highlight" })}
                    className={`py-1 px-2 rounded-lg text-[10px] font-bold text-center cursor-pointer flex items-center justify-center gap-1 transition ${
                      newAnnotation.type === "highlight"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Highlighter className="h-3 w-3 shrink-0" />
                    <span>Highlight Box</span>
                  </button>
                </div>

                {/* Color Selector */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Auditor Urgency Color</label>
                  <div className="flex gap-2">
                    {colorList.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setNewAnnotation({ ...newAnnotation, color: c.hex })}
                        style={{ backgroundColor: c.hex }}
                        className={`h-4 w-4 rounded-full transition cursor-pointer flex items-center justify-center shrink-0 ${
                          newAnnotation.color === c.hex 
                            ? "ring-2 ring-indigo-500 scale-110" 
                            : "opacity-85 hover:opacity-100"
                        }`}
                        title={c.name}
                      >
                        {newAnnotation.color === c.hex && <Check className="h-2.5 w-2.5 text-white stroke-[3px]" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Highlight width/height controls when type is highlight */}
                {newAnnotation.type === "highlight" && (
                  <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[9px] font-sans">
                    <div>
                      <span className="text-[8px] text-slate-400 block font-bold">Width %</span>
                      <input 
                        type="range" 
                        min="10" 
                        max="80" 
                        value={newAnnotation.width || 30}
                        onChange={(e) => setNewAnnotation({ ...newAnnotation, width: Number(e.target.value) })}
                        className="w-full accent-indigo-650 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                      />
                      <span className="font-mono text-slate-500 font-bold">{newAnnotation.width || 30}%</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-400 block font-bold">Height %</span>
                      <input 
                        type="range" 
                        min="3" 
                        max="25" 
                        value={newAnnotation.height || 6}
                        onChange={(e) => setNewAnnotation({ ...newAnnotation, height: Number(e.target.value) })}
                        className="w-full accent-indigo-650 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                      />
                      <span className="font-mono text-slate-500 font-bold">{newAnnotation.height || 6}%</span>
                    </div>
                  </div>
                )}

                {/* Message input */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Auditor Observation</label>
                  <textarea
                    required
                    value={newAnnotation.text}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, text: e.target.value })}
                    placeholder="Enter audit comment, flag, or instruction..."
                    rows={2}
                    className="w-full bg-white border border-slate-205 rounded-lg p-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] resize-none font-sans"
                  />
                </div>

                {/* Action button triggers */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveAnnotation}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-[10px] transition cursor-pointer text-center"
                  >
                    Apply Markup
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAnnotation(null)}
                    className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1.5 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          {/* Background element slots where iframe goes */}
          <div className="absolute inset-0 bg-slate-100 z-10 pointer-events-auto">
            {/* Direct slot for iframe backplane */}
            {children}
          </div>

        </div>

        {/* Footer info stats */}
        <div className="bg-slate-900 border-t border-slate-950 px-4 py-1 text-[9px] text-slate-400 flex justify-between select-none">
          <span>Coordinate Capture: Responsive Scale Matrix</span>
          <span>Verified Secure Link Sync</span>
        </div>
      </div>

      {/* 2. Side Panel List of Document Audit Items */}
      {showSidePanel && (
        <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-slate-200 bg-white flex flex-col h-[522px]" id="annotation-sidebar">
          
          {/* Header */}
          <div className="p-3 bg-slate-50 border-b border-slate-150 flex items-center justify-between text-left select-none">
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
              <span>Audit Log ({annotations.length})</span>
            </h4>
            <span className="text-[8px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded font-mono">
              V1.2
            </span>
          </div>

          {/* List content container */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-left" ref={scrollContainerRef}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <span className="text-xs">syncing logs...</span>
              </div>
            ) : errorMsg ? (
              <div className="p-3 bg-rose-50 text-rose-800 text-[10px] rounded leading-relaxed font-sans">
                {errorMsg}
              </div>
            ) : annotations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-2 px-4">
                <span className="p-2 bg-slate-50 text-slate-350 rounded-full">
                  <MessageSquare className="h-6 w-6 stroke-[1.5]" />
                </span>
                <p className="text-[10px] leading-normal font-medium text-slate-400">No annotations or highlights saved for this document.</p>
                {isAdmin && (
                  <p className="text-[9px] text-slate-350 italic">Switch to &quot;Annotate Layer&quot; and click on the document to add comments.</p>
                )}
              </div>
            ) : (
              annotations.map((ann) => {
                const isHovered = hoveredAnnotationId === ann.id;
                const matchesColor = colorList.find(c => c.hex === ann.color) || colorList[0];

                return (
                  <div
                    key={ann.id}
                    onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                    onMouseLeave={() => setHoveredAnnotationId(null)}
                    onClick={() => {
                      // Flashing feedback trigger or focus helper
                      setHoveredAnnotationId(ann.id);
                    }}
                    className={`p-3 rounded-lg border text-left transition-all duration-150 relative cursor-pointer group ${
                      isHovered 
                        ? "bg-slate-50/80 border-indigo-500 shadow-sm" 
                        : "bg-white border-slate-100 hover:border-slate-300"
                    }`}
                  >
                    {/* Urgency Color ribbon on the left side */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-all"
                      style={{ backgroundColor: ann.color }}
                    />

                    {/* Metadata Header */}
                    <div className="flex justify-between items-start pl-1">
                      <div className="truncate pr-4">
                        <span className="text-[10.5px] font-black text-slate-900 truncate block font-sans">
                          {ann.author}
                        </span>
                        <span className="text-[8px] text-slate-400 block font-mono">
                          {new Date(ann.createdAt).toLocaleDateString()} at {new Date(ann.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                          className="text-slate-400 hover:text-rose-600 opacity-50 hover:opacity-100 p-1 transition rounded cursor-pointer"
                          title="Erase annotation markup"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Annotation Content */}
                    <p className="text-[10.5px] text-slate-750 select-text leading-relaxed font-medium mt-1.5 pl-1 text-slate-600">
                      {ann.text}
                    </p>

                    {/* Badges for annotation status */}
                    <div className="mt-2 flex items-center justify-between pl-1">
                      <span className="text-[8px] text-slate-400 font-mono flex items-center gap-1 uppercase select-none">
                        {ann.type === "highlight" ? <Highlighter className="h-2.5 w-2.5 text-slate-400 shrink-0" /> : <MessageSquare className="h-2.5 w-2.5 text-slate-400 shrink-0" />}
                        {ann.type} ({Math.round(ann.x)}%, {Math.round(ann.y)}%)
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Help Guide */}
          <div className="p-3 bg-slate-50 border-t border-slate-150 text-[9px] text-slate-405 text-left text-slate-500 select-none">
            <span className="font-bold block text-slate-700 uppercase tracking-wider mb-0.5">Auditor Quick-Guide:</span>
            Annotations persist directly as responsive percentages. Resizing or rendering PDF viewers on tablets stays 100% accurate.
          </div>
        </div>
      )}

    </div>
  );
}

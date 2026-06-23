import React, { useRef } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import {
  Move,
  Square,
  Circle,
  ArrowRight,
  Trash2,
  Palette,
  Type,
  Pen,
} from "lucide-react";
import type { ElementType } from "../types";

export const Toolbar: React.FC = () => {
  const {
    currentTool,
    setTool,
    clearCanvas,
    deleteElement,
    currentStrokeColor,
    setStrokeColor,
    currentStrokeWidth,
    setStrokeWidth,
    selectedElementId,
  } = useCanvasStore() as any;

  const colorInputRef = useRef<HTMLInputElement | null>(null);

  const handleTrashClick = () => {
    if (selectedElementId) {
      deleteElement(selectedElementId);
    } else {
      clearCanvas();
    }
  };

  const tools = [
    { id: "select", label: "Pan / Select Tool", icon: <Move size={18} /> },
    { id: "rectangle", label: "Rectangle Shape", icon: <Square size={18} /> },
    { id: "circle", label: "Circle Shape", icon: <Circle size={18} /> },
    { id: "arrow", label: "Arrow Flow", icon: <ArrowRight size={18} /> },
    { id: "text", label: "Text Annotation", icon: <Type size={18} /> },
    { id: "freehand", label: "Pen Tool", icon: <Pen size={18} /> },
  ];

  return (
    <div 
      className="toolbar" 
      style={{
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#2a2a2a",
        padding: "8px 16px",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        zIndex: 10000,
        border: "1px solid #3e3e3e",
      }}
    >
      <div style={{ display: "flex", gap: "4px" }}>
        {tools.map((tool) => {
          const isActive = currentTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id as ElementType | "select")}
              title={tool.label}
              style={{
                background: isActive ? "#6366f1" : "transparent",
                color: "#fff",
                border: "none",
                padding: "8px",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {tool.icon}
            </button>
          );
        })}
      </div>

      <div style={{ width: "1px", height: "20px", background: "#3e3e3e" }} />

      <div style={{ display: "flex", alignItems: "center", position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => colorInputRef.current?.click()}
          title="Choose Line Color"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 8px",
            background: "#1e1e1e",
            borderRadius: "6px",
            border: "1px solid #444",
            height: "34px",
            minWidth: "54px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: currentStrokeColor || "#ffffff",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />
          <Palette size={14} style={{ color: "#9ca3af" }} />
        </button>

        <input
          ref={colorInputRef}
          type="color"
          value={currentStrokeColor || "#ffffff"}
          onChange={(e) => setStrokeColor(e.target.value)}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ width: "1px", height: "20px", background: "#3e3e3e" }} />

      <select
        value={Number(currentStrokeWidth) || 2}
        onChange={(e) => setStrokeWidth(Number(e.target.value))}
        style={{
          background: "#1e1e1e",
          color: "#fff",
          border: "1px solid #444",
          padding: "6px 8px",
          borderRadius: "6px",
          outline: "none",
          cursor: "pointer",
          height: "34px",
        }}
      >
        <option value={2}>Thin Line (2px)</option>
        <option value={4}>Medium Line (4px)</option>
        <option value={8}>Thick Line (8px)</option>
      </select>

      <div style={{ width: "1px", height: "20px", background: "#3e3e3e" }} />

      <button
        onClick={handleTrashClick}
        title={selectedElementId ? "Delete Selected Element" : "Clear Entire Canvas Workspace"}
        style={{
          background: "transparent",
          color: "#ef4444",
          border: selectedElementId ? "1px solid #ef4444" : "none",
          backgroundColor: selectedElementId ? "rgba(239, 68, 68, 0.1)" : "transparent",
          padding: "8px",
          borderRadius: "6px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};
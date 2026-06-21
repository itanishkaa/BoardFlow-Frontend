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
    selectedElementId,
  } = useCanvasStore();

  const handleTrashClick = () => {
    if (selectedElementId) {
      deleteElement(selectedElementId);
      return;
    }

    clearCanvas();
  };

  const tools = [
    { id: "select", label: "Pan / Select Tool", icon: <Move size={18} /> },
    { id: "rectangle", label: "Rectangle Shape", icon: <Square size={18} /> },
    { id: "circle", label: "Circle Shape", icon: <Circle size={18} /> },
    { id: "arrow", label: "Arrow Flow", icon: <ArrowRight size={18} /> },
    { id: 'text', label: 'Text Annotation', icon: <Type size={18} /> },
  ];

  const colorInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="toolbar">
      {tools.map((tool) => {
        const isActive = currentTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => setTool(tool.id as ElementType | "select")}
            title={tool.label}
            className={`toolbar-button ${isActive ? "is-active" : ""}`}
          >
            {tool.icon}
          </button>
        );
      })}

      <div
        style={{
          width: "1px",
          height: "20px",
          background: "#3e3e3e",
          margin: "0 4px",
        }}
      />

      {/* Render soft preset color dots */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          position: "relative",
          padding: "0 4px",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => colorInputRef.current?.click()}
          title="Choose Line Color"
          className="toolbar-button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            background: "#2a2a2a",
            borderRadius: "6px",
            border: "1px solid #3e3e3e",
            height: "32px", // Standardizes height across your button layouts
            minWidth: "48px", // Guarantees a minimum width layout boundary
            cursor: "pointer",
          }}
        >
          {/* Live Dynamic Color Indicator Ball */}
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "50%",
              backgroundColor: currentStrokeColor,
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          />
          <Palette size={14} style={{ color: "#9ca3af" }} />
        </button>

        {/* Hidden Native Input Field Trigger */}
        <input
          ref={colorInputRef}
          type="color"
          value={currentStrokeColor}
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

      {/* Visual Divider separator */}
      <div
        style={{
          width: "1px",
          height: "24px",
          background: "#3e3e3e",
          margin: "0 4px",
        }}
      />

      {/* Global Flush Utility Trigger */}
      <button
        onClick={handleTrashClick}
        title="Clear Canvas Workspace"
        className="toolbar-button"
        style={{ color: "#ef4444" }} // Elegant modern minimalist red hue accent
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

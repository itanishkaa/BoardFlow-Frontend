import React, { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../store/useCanvasStore";
import type { Point, CanvasElement } from "../types";
import { getElementAtPosition } from "../utils/geometry";

export const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    remoteCursors,
    remoteDrawingPreviews,
    remoteTypingIndicators, // 🔥 Bound from the new Zustand store structure
    updateCursorPosition,
    updateDrawingPreview,
    leaveCanvasWorkspace,
    elements,
    camera,
    updateCamera,
    currentTool,
    addElement,
    currentStrokeColor,
    currentStrokeWidth,
    currentFillColor,
    selectedElementId,
    setSelectedElementId,
    updateElementPosition,
    deleteElement,
    boardId, // 🔥 Extract real boardId dynamically 
    socket,
  } = useCanvasStore();

  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const startPanPoint = useRef<Point>({ x: 0, y: 0 });
  const startDrawingPoint = useRef<Point>({ x: 0, y: 0 });
  const [previewElement, setPreviewElement] = useState<CanvasElement | null>(null);
  const lastPointerPoint = useRef<Point>({ x: 0, y: 0 });
  
  const [textEditor, setTextEditor] = useState<{
    id: string;
    x: number;
    y: number;
    worldX: number;
    worldY: number;
    isEditingExisting: boolean; // 🛠️ Fixed typo structure
    initialText?: string;
  } | null>(null);

  useEffect(() => {
    if (!textEditor) return;
    const focusTimeout = setTimeout(() => {
      textAreaRef.current?.focus();
    }, 50);
    return () => clearTimeout(focusTimeout);
  }, [textEditor]);

  const getEventWorldPoint = (e: React.PointerEvent | React.WheelEvent | React.MouseEvent): Point => {
    return {
      x: (e.clientX - camera.x) / camera.zoom,
      y: (e.clientY - camera.y) / camera.zoom,
    };
  };

  const getTextBoxSize = (text: string) => {
    const lines = (text || "Type something...").split("\n");
    const width = Math.max(150, ...lines.map((line) => line.length * 9)) + 12;
    const height = Math.max(30, lines.length * 20) + 12;
    return { width, height, lines };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      render();
    };

    const drawElement = (context: CanvasRenderingContext2D, el: CanvasElement) => {
      context.strokeStyle = el.strokeColor;
      context.lineWidth = el.strokeWidth || 2;
      context.fillStyle = el.strokeColor;

      if (el.type === "rectangle") {
        context.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === "circle") {
        context.beginPath();
        const radiusX = Math.abs(el.width / 2);
        const radiusY = Math.abs(el.height / 2);
        const centerX = el.x + radiusX;
        const centerY = el.y + radiusY;
        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        context.stroke();
      } else if (el.type === "arrow") {
        context.beginPath();
        context.moveTo(el.x, el.y);
        const targetX = el.x + el.width;
        const targetY = el.y + el.height;
        context.lineTo(targetX, targetY);
        context.stroke();

        const angle = Math.atan2(targetY - el.y, targetX - el.x);
        const headLength = 12;
        context.beginPath();
        context.moveTo(targetX, targetY);
        context.lineTo(
          targetX - headLength * Math.cos(angle - Math.PI / 6),
          targetY - headLength * Math.sin(angle - Math.PI / 6),
        );
        context.moveTo(targetX, targetY);
        context.lineTo(
          targetX - headLength * Math.cos(angle + Math.PI / 6),
          targetY - headLength * Math.sin(angle + Math.PI / 6),
        );
        context.stroke();
      } else if (el.type === "text" && el.text) {
        context.font = "16px Inter, sans-serif";
        context.textBaseline = "top";
        const lines = el.text.split("\n");
        const lineHeight = 20;
        lines.forEach((line, index) => {
          context.fillText(line, el.x, el.y + index * lineHeight);
        });
      } 
      // 🔥 1. ADDED: SMOOTH FREEHAND PATH RENDERING ENGINE
      else if (el.type === "freehand" && (el as any).points) {
        const points = (el as any).points as Point[];
        if (points.length < 2) return;
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2;
          const yc = (points[i].y + points[i + 1].y) / 2;
          context.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        context.stroke();
      }
    };

    const render = () => {
      ctx.fillStyle = "#1e1e1e";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      drawGrid(ctx, camera);

      elements.forEach((element) => drawElement(ctx, element));

      Object.values(remoteDrawingPreviews).forEach((element) => {
        ctx.save();
        ctx.setLineDash([6, 4]);
        drawElement(ctx, element);
        ctx.restore();
      });

      // 🔥 2. ADDED: REAL-TIME COLLABORATIVE TYPING INDICATORS OVERLAY RENDERING
      Object.entries(remoteTypingIndicators).forEach(([userId, indicator]) => {
        const { width, height, lines } = getTextBoxSize(indicator.text);

        ctx.save();
        ctx.fillStyle = "#222222";
        ctx.fillRect(indicator.worldX, indicator.worldY, width, height);

        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2 / camera.zoom;
        ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
        ctx.strokeRect(indicator.worldX, indicator.worldY, width, height);

        ctx.setLineDash([]);
        ctx.fillStyle = indicator.text ? "#ffffff" : "#8b8b8b";
        ctx.font = "16px Inter, sans-serif";
        ctx.textBaseline = "top";
        lines.forEach((line, index) => {
          ctx.fillText(line || "Type something...", indicator.worldX + 6, indicator.worldY + 6 + index * 20);
        });

        ctx.fillStyle = "rgba(99, 102, 241, 0.85)";
        ctx.font = "12px Inter, sans-serif";
        ctx.fillText(`Guest (${userId.slice(0, 4)}) editing`, indicator.worldX, indicator.worldY - 18);
        ctx.restore();
      });

      Object.values(remoteCursors).forEach((cursor) => {
        ctx.save();
        ctx.translate(cursor.x, cursor.y);
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 15);
        ctx.lineTo(4, 15);
        ctx.lineTo(0, 20);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#2d2d2d";
        ctx.strokeStyle = "#3e3e3e";
        ctx.lineWidth = 1 / camera.zoom;

        const text = `Guest (${cursor.userId.slice(0, 4)})`;
        ctx.font = `${10 / camera.zoom}px Inter`;
        const textWidth = ctx.measureText(text).width;

        ctx.fillRect(12, 12, textWidth + 8, 14);
        ctx.strokeRect(12, 12, textWidth + 8, 14);

        ctx.fillStyle = "#9ca3af";
        ctx.fillText(text, 16, 22);
        ctx.restore();
      });

      if (previewElement) {
        ctx.save();
        ctx.setLineDash([6, 4]);
        drawElement(ctx, previewElement);
        ctx.restore();
      }

      if (selectedElementId) {
        const selectedEl = elements.find((el) => el.id === selectedElementId);
        if (selectedEl) {
          ctx.save();
          ctx.strokeStyle = "#6366f1";
          ctx.lineWidth = 1.5 / camera.zoom;
          ctx.setLineDash([4, 4]);

          const offset = 4 / camera.zoom;

          if (selectedEl.type === "arrow") {
            const minX = Math.min(selectedEl.x, selectedEl.x + selectedEl.width);
            const minY = Math.min(selectedEl.y, selectedEl.y + selectedEl.height);
            const maxX = Math.max(selectedEl.x, selectedEl.x + selectedEl.width);
            const maxY = Math.max(selectedEl.y, selectedEl.y + selectedEl.height);
            ctx.strokeRect(minX - offset, minY - offset, maxX - minX + offset * 2, maxY - minY + offset * 2);
          } else {
            ctx.strokeRect(
              selectedEl.x - offset,
              selectedEl.y - offset,
              selectedEl.width + offset * 2,
              selectedEl.height + offset * 2,
            );
          }
          ctx.restore();
        }
      }

      ctx.restore();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [elements, camera, previewElement, remoteCursors, remoteDrawingPreviews, remoteTypingIndicators]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.tagName === "INPUT") {
        return;
      }
      if (selectedElementId && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        deleteElement(selectedElementId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementId, deleteElement]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const worldPoint = getEventWorldPoint(e);
    lastPointerPoint.current = worldPoint;

    if (currentTool === "text") {
      setSelectedElementId(null);
      updateDrawingPreview(null);
      if (socket) {
        socket.emit("TYPING_STATUS", {
          boardId,
          worldX: worldPoint.x,
          worldY: worldPoint.y,
          isTyping: true,
          text: "",
        });
      }
      setTextEditor({
        id: crypto.randomUUID(),
        x: e.clientX,
        y: e.clientY,
        worldX: worldPoint.x,
        worldY: worldPoint.y,
        isEditingExisting: false,
      });
      return;
    }

    if (currentTool === "select" && e.button === 0) {
      const clickedElement = getElementAtPosition(elements, worldPoint);

      if (clickedElement) {
        setSelectedElementId(clickedElement.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPanning(false);
      } else {
        setSelectedElementId(null);
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPanning(true);
        startPanPoint.current = { x: e.clientX - camera.x, y: e.clientY - camera.y };
      }
    } else if (e.button === 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      startPanPoint.current = { x: e.clientX - camera.x, y: e.clientY - camera.y };
    } else {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      startDrawingPoint.current = worldPoint;
      
      // 🔥 3. ADDED: INITIALIZE THE FREEHAND PATH ARRAY SCHEMATICS ON CLICK
      if (currentTool === "freehand") {
        const nextPreviewElement = {
          id: "preview",
          type: "freehand" as const,
          x: worldPoint.x,
          y: worldPoint.y,
          width: 0,
          height: 0,
          strokeColor: currentStrokeColor,
          strokeWidth: currentStrokeWidth,
          points: [worldPoint],
        };
        setPreviewElement(nextPreviewElement as any);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const worldPoint = getEventWorldPoint(e);
    updateCursorPosition(worldPoint.x, worldPoint.y);

    if (currentTool === "text") return;

    if (currentTool === "select" && selectedElementId && e.currentTarget.hasPointerCapture(e.pointerId) && !isPanning) {
      const dx = worldPoint.x - lastPointerPoint.current.x;
      const dy = worldPoint.y - lastPointerPoint.current.y;
      updateElementPosition(selectedElementId, dx, dy);
      lastPointerPoint.current = worldPoint;
    } else if (isPanning) {
      updateCamera({ x: e.clientX - startPanPoint.current.x, y: e.clientY - startPanPoint.current.y });
    } else if (isDrawing && currentTool !== "select") {
      const currentWorldPoint = getEventWorldPoint(e);

      // 🔥 4. ADDED: TRACK FREEHAND PATHS BY APPENDING COORDINATES INTERNALLY
      if (currentTool === "freehand" && previewElement && previewElement.type === "freehand") {
        const updatedPoints = [...((previewElement as any).points || []), currentWorldPoint];
        const xs = updatedPoints.map((p) => p.x);
        const ys = updatedPoints.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const nextPreviewElement = {
          ...previewElement,
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          points: updatedPoints,
        };
        setPreviewElement(nextPreviewElement as any);
        updateDrawingPreview(nextPreviewElement as any);
      } else if (currentTool !== "freehand") {
        let x = 0, y = 0, width = 0, height = 0;

        if (currentTool === "arrow") {
          x = startDrawingPoint.current.x;
          y = startDrawingPoint.current.y;
          width = currentWorldPoint.x - startDrawingPoint.current.x;
          height = currentWorldPoint.y - startDrawingPoint.current.y;
        } else {
          x = Math.min(startDrawingPoint.current.x, currentWorldPoint.x);
          y = Math.min(startDrawingPoint.current.y, currentWorldPoint.y);
          width = Math.abs(currentWorldPoint.x - startDrawingPoint.current.x);
          height = Math.abs(currentWorldPoint.y - startDrawingPoint.current.y);
        }

        const nextPreviewElement: CanvasElement = {
          id: "preview",
          type: currentTool as any,
          x,
          y,
          width,
          height,
          strokeColor: currentStrokeColor,
          fillColor: currentFillColor,
          strokeWidth: currentStrokeWidth,
        };

        setPreviewElement(nextPreviewElement);
        updateDrawingPreview(nextPreviewElement);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (currentTool === "text") return;

    if (isPanning) {
      setIsPanning(false);
    } else if (isDrawing) {
      setIsDrawing(false);

      if (previewElement) {
        const isFreehand = previewElement.type === "freehand";
        const hasLength = Math.abs(previewElement.width) > 4 || Math.abs(previewElement.height) > 4;
        
        if (isFreehand || hasLength) {
          addElement({
            ...previewElement,
            id: crypto.randomUUID(),
            strokeColor: currentStrokeColor,
            fillColor: currentFillColor,
          });
        }
      }
      setPreviewElement(null);
      updateDrawingPreview(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = e.deltaY < 0 ? camera.zoom * zoomFactor : camera.zoom / zoomFactor;
    newZoom = Math.max(0.25, Math.min(4, newZoom));

    const mouseWorldBeforeZoom = getEventWorldPoint(e);
    updateCamera({
      zoom: newZoom,
      x: e.clientX - mouseWorldBeforeZoom.x * newZoom,
      y: e.clientY - mouseWorldBeforeZoom.y * newZoom,
    });
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: currentTool === "select" ? (isPanning ? "grabbing" : "grab") : currentTool === "text" ? "text" : "crosshair",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={leaveCanvasWorkspace}
        onWheel={handleWheel}
        onDoubleClick={(e) => {
          const worldPoint = getEventWorldPoint(e);
          const clickedElement = getElementAtPosition(elements, worldPoint);
          if (clickedElement && clickedElement.type === "text") {
            setSelectedElementId(null);
            setTextEditor({
              id: clickedElement.id,
              x: e.clientX,
              y: e.clientY,
              worldX: clickedElement.x,
              worldY: clickedElement.y,
              isEditingExisting: true,
              initialText: clickedElement.text || "",
            });
          }
        }}
      />

      {textEditor && (
        <textarea
          ref={textAreaRef}
          placeholder="Type something..."
          defaultValue={textEditor.initialText || ""}
          style={{
            position: "absolute",
            top: textEditor.worldY * camera.zoom + camera.y,
            left: textEditor.worldX * camera.zoom + camera.x,
            background: "#222222",
            color: currentStrokeColor,
            border: "2px dashed #6366f1",
            outline: "none",
            font: "16px Inter, sans-serif",
            transformOrigin: "top left",
            transform: `scale(${camera.zoom})`,
            padding: "6px",
            margin: 0,
            resize: "both",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            minWidth: "160px",
            minHeight: "36px",
            zIndex: 9999,
            pointerEvents: "auto",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          // 🔥 5. ADDED: LIVE BROADCAST OF STRING VALUES TO COLLABORATORS ON KEYSTROKE
          onChange={(e) => {
            const text = e.target.value;
            if (socket) {
              socket.emit("TYPING_STATUS", {
                boardId,
                worldX: textEditor.worldX,
                worldY: textEditor.worldY,
                isTyping: true,
                text,
              });
            }
          }}
          onBlur={(e) => {
            const val = e.target.value.trim();

            // 🔥 6. FIXED: Cleaned up hardcoded boardId configurations
            if (socket) {
              socket.emit("TYPING_STATUS", { boardId, worldX: 0, worldY: 0, isTyping: false, text: "" });
            }

            if (val) {
              if (textEditor.isEditingExisting) {
                useCanvasStore.getState().updateElementPosition(textEditor.id, 0, 0);
                const updatedElement = elements.find((el) => el.id === textEditor.id);
                if (updatedElement) {
                  const finalPayload = { ...updatedElement, text: val };
                  if (socket) {
                    socket.emit("ELEMENT_UPDATE", { boardId, element: finalPayload });
                  }
                }
              } else {
                addElement({
                  id: textEditor.id,
                  type: "text",
                  x: textEditor.worldX,
                  y: textEditor.worldY,
                  width: 150,
                  height: 30,
                  strokeColor: currentStrokeColor,
                  strokeWidth: currentStrokeWidth,
                  text: val,
                });
              }
            } else if (textEditor.isEditingExisting) {
              deleteElement(textEditor.id);
            }

            setTextEditor(null);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              if (socket) {
                socket.emit("TYPING_STATUS", { boardId, worldX: 0, worldY: 0, isTyping: false, text: "" });
              }
              setTextEditor(null);
            }
          }}
        />
      )}
    </div>
  );
};

const drawGrid = (ctx: CanvasRenderingContext2D, camera: any) => {
  const gridSize = 40;
  ctx.strokeStyle = "#252525";
  ctx.lineWidth = 1 / camera.zoom;

  const startX = Math.floor(-camera.x / camera.zoom / gridSize) * gridSize;
  const endX = startX + window.innerWidth / camera.zoom + gridSize;
  const startY = Math.floor(-camera.y / camera.zoom / gridSize) * gridSize;
  const endY = startY + window.innerHeight / camera.zoom + gridSize;

  for (let x = startX; x < endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y < endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
};

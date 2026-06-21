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
    updateCursorPosition,
    updateDrawingPreview,
    leaveCanvasWorkspace,
    elements,
    camera,
    updateCamera,
    currentTool,
    addElement,
    currentStrokeColor,
    currentFillColor,
    selectedElementId,
    setSelectedElementId,
    updateElementPosition,
    deleteElement,
  } = useCanvasStore();

  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const startPanPoint = useRef<Point>({ x: 0, y: 0 });
  const startDrawingPoint = useRef<Point>({ x: 0, y: 0 });
  const [previewElement, setPreviewElement] = useState<CanvasElement | null>(
    null,
  );
  const lastPointerPoint = useRef<Point>({ x: 0, y: 0 });
  const [textEditor, setTextEditor] = useState<{
    id: string;
    x: number; // Screen coordinate space positioning parameters
    y: number;
    worldX: number; // Infinite space placement records
    worldY: number;
  } | null>(null);

  useEffect(() => {
    if (!textEditor) return;

    requestAnimationFrame(() => {
      textAreaRef.current?.focus();
    });
  }, [textEditor]);

  const getEventWorldPoint = (
    e: React.PointerEvent | React.WheelEvent,
  ): Point => {
    return {
      x: (e.clientX - camera.x) / camera.zoom,
      y: (e.clientY - camera.y) / camera.zoom,
    };
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

    // Advanced drawing helper to support geometric structures
    const drawElement = (
      context: CanvasRenderingContext2D,
      el: CanvasElement,
    ) => {
      context.strokeStyle = el.strokeColor;
      context.lineWidth = el.strokeWidth;
      context.fillStyle = el.strokeColor;

      if (el.type === "rectangle") {
        context.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.type === "circle") {
        context.beginPath();
        // Calculate bounding circle center and radius dimensions
        const radiusX = Math.abs(el.width / 2);
        const radiusY = Math.abs(el.height / 2);
        const centerX = el.x + radiusX;
        const centerY = el.y + radiusY;

        context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        context.stroke();
      } else if (el.type === "arrow") {
        context.beginPath();
        context.moveTo(el.x, el.y);
        // For arrows, width and height store the destination point delta adjustments
        const targetX = el.x + el.width;
        const targetY = el.y + el.height;
        context.lineTo(targetX, targetY);
        context.stroke();

        // Render arrowhead tip mathematically
        const angle = Math.atan2(targetY - el.y, targetX - el.x);
        const headLength = 12; // Length of head segments
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

      Object.values(remoteCursors).forEach((cursor) => {
        ctx.save();
        // Move matrix position directly to the user's world coordinates
        ctx.translate(cursor.x, cursor.y);

        // Draw a sleek custom cursor tip
        ctx.fillStyle = "#3b82f6"; // Bright collaborative blue indicator
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(10, 15);
        ctx.lineTo(4, 15);
        ctx.lineTo(0, 20);
        ctx.closePath();
        ctx.fill();

        // Draw a subtle user tag block next to the cursor arrow
        ctx.fillStyle = "#2d2d2d";
        ctx.strokeStyle = "#3e3e3e";
        ctx.lineWidth = 1 / camera.zoom;

        const text = `Guest (${cursor.userId.slice(0, 4)})`;
        ctx.font = `${10 / camera.zoom}px Inter`;
        const textWidth = ctx.measureText(text).width;

        // Tag capsule background
        ctx.fillRect(12, 12, textWidth + 8, 14);
        ctx.strokeRect(12, 12, textWidth + 8, 14);

        // Tag capsule text
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
          ctx.strokeStyle = "#6366f1"; // Elegant indigo focus accent color
          ctx.lineWidth = 1.5 / camera.zoom;
          ctx.setLineDash([4, 4]); // Clean dashed outline look

          const offset = 4 / camera.zoom; // Clean spacing margin offset boundary

          if (selectedEl.type === "arrow") {
            // For arrows, draw a bounding box around their start and end points
            const minX = Math.min(
              selectedEl.x,
              selectedEl.x + selectedEl.width,
            );
            const minY = Math.min(
              selectedEl.y,
              selectedEl.y + selectedEl.height,
            );
            const maxX = Math.max(
              selectedEl.x,
              selectedEl.x + selectedEl.width,
            );
            const maxY = Math.max(
              selectedEl.y,
              selectedEl.y + selectedEl.height,
            );
            ctx.strokeRect(
              minX - offset,
              minY - offset,
              maxX - minX + offset * 2,
              maxY - minY + offset * 2,
            );
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
  }, [elements, camera, previewElement, remoteCursors, remoteDrawingPreviews]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if an element is currently highlighted and a destructive key is typed
      if (selectedElementId && (e.key === "Delete" || e.key === "Backspace")) {
        // Prevent browser default actions (like navigating backward on backspace)
        e.preventDefault();
        deleteElement(selectedElementId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedElementId, deleteElement]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const worldPoint = getEventWorldPoint(e);
    lastPointerPoint.current = worldPoint;

    if (currentTool === "select" && e.button === 0) {
      const clickedElement = getElementAtPosition(elements, worldPoint);

      if (clickedElement) {
        setSelectedElementId(clickedElement.id);
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPanning(false); // We are moving an element, not panning the camera
      } else {
        setSelectedElementId(null);
        // Fallback back to standard canvas space panning
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPanning(true);
        startPanPoint.current = {
          x: e.clientX - camera.x,
          y: e.clientY - camera.y,
        };
      }
    } else if (e.button === 1) {
      // Middle-click tracking remains pure panning
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      startPanPoint.current = {
        x: e.clientX - camera.x,
        y: e.clientY - camera.y,
      };
    } else {
      if (currentTool === "text") {
        // Create a unique id ahead of time for editing references
        setSelectedElementId(null);
        setTextEditor({
          id: crypto.randomUUID(),
          x: e.clientX,
          y: e.clientY,
          worldX: worldPoint.x,
          worldY: worldPoint.y,
        });
        return;
      }
      // Shape drawing branch triggers
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDrawing(true);
      startDrawingPoint.current = worldPoint;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const worldPoint = getEventWorldPoint(e);
    updateCursorPosition(worldPoint.x, worldPoint.y);
    if (
      currentTool === "select" &&
      selectedElementId &&
      e.currentTarget.hasPointerCapture(e.pointerId) &&
      !isPanning
    ) {
      const dx = worldPoint.x - lastPointerPoint.current.x;
      const dy = worldPoint.y - lastPointerPoint.current.y;

      updateElementPosition(selectedElementId, dx, dy);
      lastPointerPoint.current = worldPoint;
    } else if (isPanning) {
      updateCamera({
        x: e.clientX - startPanPoint.current.x,
        y: e.clientY - startPanPoint.current.y,
      });
    } else if (isDrawing && currentTool !== "select") {
      const currentWorldPoint = getEventWorldPoint(e);

      let x = 0,
        y = 0,
        width = 0,
        height = 0;

      if (currentTool === "arrow") {
        // Arrow needs true vector direction tracking vectors
        x = startDrawingPoint.current.x;
        y = startDrawingPoint.current.y;
        width = currentWorldPoint.x - startDrawingPoint.current.x;
        height = currentWorldPoint.y - startDrawingPoint.current.y;
      } else {
        // Bounding calculation mechanics for square and circle frames
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
        strokeWidth: 2,
      };

      setPreviewElement(nextPreviewElement);
      updateDrawingPreview(nextPreviewElement);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (currentTool === "text") {
      return;
    }

    if (isPanning) {
      setIsPanning(false);
    } else if (isDrawing) {
      setIsDrawing(false);

      if (
        previewElement &&
        (Math.abs(previewElement.width) > 4 ||
          Math.abs(previewElement.height) > 4)
      ) {
        addElement({
          ...previewElement,
          id: crypto.randomUUID(),
          strokeColor: currentStrokeColor,
          fillColor: currentFillColor,
        });
      }
      setPreviewElement(null);
      updateDrawingPreview(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom =
      e.deltaY < 0 ? camera.zoom * zoomFactor : camera.zoom / zoomFactor;
    newZoom = Math.max(0.25, Math.min(4, newZoom));

    const mouseWorldBeforeZoom = getEventWorldPoint(e);
    updateCamera({
      zoom: newZoom,
      x: e.clientX - mouseWorldBeforeZoom.x * newZoom,
      y: e.clientY - mouseWorldBeforeZoom.y * newZoom,
    });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        style={{
          cursor:
            currentTool === "select"
              ? isPanning
                ? "grabbing"
                : "grab"
              : currentTool === "text"
                ? "text"
                : "crosshair",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={leaveCanvasWorkspace}
        onWheel={handleWheel}
      />

      {/* FLOATING TEXT CONSOLE OVERLAY INPUT ENGINE */}
      {/* FLOATING TEXT CONSOLE OVERLAY INPUT ENGINE */}
      {textEditor && (
        <textarea
          ref={textAreaRef}
          autoFocus
          placeholder="Type something..."
          style={{
            position: "absolute",
            // Calculate layout coordinates relative to current zoom matrices
            top: textEditor.worldY * camera.zoom + camera.y,
            left: textEditor.worldX * camera.zoom + camera.x,
            background: "#1e1e1e", // Solid workspace background blocks text behind it
            color: currentStrokeColor,
            border: "1.5px dashed #6366f1",
            outline: "none",
            font: `16px Inter, sans-serif`, // Keeps text sizing normal during input insertion
            transformOrigin: "top left",
            transform: `scale(${camera.zoom})`, // Scales neatly alongside infinite layouts
            padding: "4px",
            margin: 0,
            resize: "both",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            minWidth: "150px",
            minHeight: "34px",
            zIndex: 1000,
            pointerEvents: "auto",
            userSelect: "text",
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val) {
              addElement({
                id: textEditor.id,
                type: "text",
                x: textEditor.worldX,
                y: textEditor.worldY,
                width: 150,
                height: 30,
                strokeColor: currentStrokeColor,
                strokeWidth: 2,
                text: val,
              });
            }
            setTextEditor(null);
          }}
          onKeyDown={(e) => {
            // Commit changes cleanly on Enter without a shift break modifier
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setTextEditor(null);
            }
            e.stopPropagation();
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

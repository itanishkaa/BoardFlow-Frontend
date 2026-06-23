import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type { Camera, CanvasElement, ElementType } from "../types";

export interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
}

export interface TypingIndicator {
  worldX: number;
  worldY: number;
  text: string;
}

interface CanvasState {
  elements: CanvasElement[];
  remoteDrawingPreviews: Record<string, CanvasElement>;
  remoteCursors: Record<string, RemoteCursor>;
  remoteTypingIndicators: Record<string, TypingIndicator>;
  camera: Camera;
  currentTool: ElementType | "select";
  socket: Socket | null;
  boardId: string;
  currentStrokeColor: string;
  currentStrokeWidth: number;
  currentFillColor: string | null;
  selectedElementId: string | null;

  disconnectSocket: () => void;
  clearCanvas: () => void;
  clearRemoteCanvas: () => void;
  leaveCanvasWorkspace: () => void;
  deleteElement: (id: string) => void;
  initSocket: (boardId: string) => void;
  setTool: (tool: ElementType | "select") => void;
  updateCamera: (cameraPartial: Partial<Camera>) => void;
  addElement: (element: CanvasElement) => void;
  addRemoteElement: (element: CanvasElement) => void;
  updateDrawingPreview: (element: CanvasElement | null) => void;
  updateCursorPosition: (x: number, y: number) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFillColor: (color: string | null) => void;
  setSelectedElementId: (id: string | null) => void;
  updateElementPosition: (id: string, dx: number, dy: number) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: [],
  remoteDrawingPreviews: {},
  remoteCursors: {},
  remoteTypingIndicators: {},
  camera: { x: 0, y: 0, zoom: 1 },
  currentTool: "select",
  socket: null,
  boardId: "",
  currentStrokeColor: "#ffffff",
  currentStrokeWidth: 2,
  currentFillColor: null,
  selectedElementId: null,

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  clearCanvas: () => {
    set({ elements: [], selectedElementId: null, remoteDrawingPreviews: {} });
    const { socket, boardId } = get();
    if (socket) {
      socket.emit("BOARD_CLEAR", { boardId });
    }
  },

  clearRemoteCanvas: () => {
    set({ elements: [], remoteDrawingPreviews: {}, selectedElementId: null });
  },

  leaveCanvasWorkspace: () => {
    const { socket, boardId } = get();
    if (socket) {
      socket.emit("CURSOR_LEAVE", { boardId });
    }
  },

  initSocket: (boardId: string) => {
    if (get().socket) return;

    const socketInstance = io("http://localhost:3000");

    socketInstance.on("connect", () => {
      console.log("⚡ Connected to BoardFlow Realtime Engine:", socketInstance.id);
      socketInstance.emit("JOIN_BOARD", { boardId });
    });

    socketInstance.on("LOAD_BOARD_ELEMENTS", (historicalElements: CanvasElement[]) => {
      set({ elements: historicalElements });
      console.log(`📦 Loaded ${historicalElements.length} persistent elements from DB.`);
    });

    socketInstance.on("ELEMENT_CREATED_REMOTE", (remoteElement: CanvasElement) => {
      get().addRemoteElement(remoteElement);
    });

    socketInstance.on("DRAWING_PREVIEW_REMOTE", (data: { userId: string; element: CanvasElement | null }) => {
      set((state) => {
        const updatedPreviews = { ...state.remoteDrawingPreviews };
        if (data.element) {
          updatedPreviews[data.userId] = data.element;
        } else {
          delete updatedPreviews[data.userId];
        }
        return { remoteDrawingPreviews: updatedPreviews };
      });
    });

    socketInstance.on("TYPING_STATUS_REMOTE", (data: { userId: string; worldX: number; worldY: number; isTyping: boolean; text: string }) => {
      set((state) => {
        const updatedIndicators = { ...state.remoteTypingIndicators };
        if (!data.isTyping) {
          delete updatedIndicators[data.userId];
        } else {
          updatedIndicators[data.userId] = { worldX: data.worldX, worldY: data.worldY, text: data.text };
        }
        return { remoteTypingIndicators: updatedIndicators };
      });
    });

    socketInstance.on("BOARD_CLEARED_REMOTE", () => {
      get().clearRemoteCanvas();
    });

    socketInstance.on("CURSOR_UPDATED_REMOTE", (data: RemoteCursor) => {
      set((state) => ({
        remoteCursors: { ...state.remoteCursors, [data.userId]: data },
      }));
    });

    socketInstance.on("CURSOR_REMOVED_REMOTE", (data: { userId: string }) => {
      set((state) => {
        const updatedCursors = { ...state.remoteCursors };
        const updatedPreviews = { ...state.remoteDrawingPreviews };
        const updatedTyping = { ...state.remoteTypingIndicators };
        delete updatedCursors[data.userId];
        delete updatedPreviews[data.userId];
        delete updatedTyping[data.userId];
        return {
          remoteCursors: updatedCursors,
          remoteDrawingPreviews: updatedPreviews,
          remoteTypingIndicators: updatedTyping
        };
      });
    });

    socketInstance.on("ELEMENT_UPDATED_REMOTE", (updatedElement: CanvasElement) => {
      set((state) => ({
        elements: state.elements.map((el) =>
          el.id === updatedElement.id ? updatedElement : el,
        ),
      }));
    });

    socketInstance.on("ELEMENT_DELETED_REMOTE", (deletedId: string) => {
      set((state) => ({
        elements: state.elements.filter((el) => el.id !== deletedId),
        selectedElementId: state.selectedElementId === deletedId ? null : state.selectedElementId,
      }));
    });

    set({ socket: socketInstance, boardId });
  },

  setTool: (tool) => set({ currentTool: tool }),

  updateCamera: (cameraPartial) =>
    set((state) => ({ camera: { ...state.camera, ...cameraPartial } })),

  addElement: (element) => {
    set((state) => ({ elements: [...state.elements, element] }));

    const { socket, boardId } = get();
    if (socket) {
      socket.emit("ELEMENT_CREATE", { 
        boardId, 
        element: {
          ...element,
          points: element.type === 'freehand' ? (element as any).points : undefined
        }
      });
    }
  },

  addRemoteElement: (element) => {
    set((state) => ({ elements: [...state.elements, element] }));
  },

  updateDrawingPreview: (element) => {
    const { socket, boardId } = get();
    if (socket) {
      socket.emit("DRAWING_PREVIEW", { boardId, element });
    }
  },

  updateCursorPosition: (x: number, y: number) => {
    const { socket, boardId } = get();
    if (socket) {
      socket.emit("CURSOR_MOVE", { boardId, x, y });
    }
  },

  setStrokeColor: (color: string) => set({ currentStrokeColor: color }),
  setStrokeWidth: (width: number) => set({ currentStrokeWidth: width }),
  setFillColor: (color: string | null) => set({ currentFillColor: color }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  updateElementPosition: (id, dx, dy) => {
    set((state) => {
      const updatedElements = state.elements.map((el) => {
        if (el.id !== id) return el;

        if (el.type === "freehand" && (el as any).points) {
          const shiftedPoints = (el as any).points.map((p: any) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));
          return { ...el, x: el.x + dx, y: el.y + dy, points: shiftedPoints };
        }

        return { ...el, x: el.x + dx, y: el.y + dy };
      });

      const targetElement = updatedElements.find((el) => el.id === id);
      const { socket, boardId } = get();
      if (socket && targetElement) {
        socket.emit("ELEMENT_UPDATE", { boardId, element: targetElement });
      }

      return { elements: updatedElements };
    });
  },

  deleteElement: (id) => {
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
    }));

    const { socket, boardId } = get();
    if (socket) {
      socket.emit("ELEMENT_DELETE", { boardId, elementId: id });
    }
  },
}));

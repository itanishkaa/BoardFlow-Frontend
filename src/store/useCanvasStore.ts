import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type { Camera, CanvasElement, ElementType } from "../types";

export interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
}

interface CanvasState {
  elements: CanvasElement[];
  remoteDrawingPreviews: Record<string, CanvasElement>;
  camera: Camera;
  currentTool: ElementType | "select";
  socket: Socket | null;
  boardId: string;
  currentStrokeColor: string;
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
  setFillColor: (color: string | null) => void;
  setSelectedElementId: (id: string | null) => void;
  updateElementPosition: (id: string, dx: number, dy: number) => void;
  remoteCursors: Record<string, RemoteCursor>;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  elements: [],
  remoteDrawingPreviews: {},
  remoteCursors: {},
  camera: { x: 0, y: 0, zoom: 1 },
  currentTool: "select",
  socket: null,
  boardId: "",
  currentStrokeColor: "#ffffff", // Clean white lines default
  currentFillColor: null,
  selectedElementId: null,

  // Initialize Socket connection and bind remote event listeners
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
    // If a socket connection is already running, avoid duplicating handshakes
    if (get().socket) return;

    // Connect specifically to the Socket.io Gateway running on Port 3000
    const socketInstance = io("http://localhost:3000");

    socketInstance.on("connect", () => {
      console.log(
        "⚡ Connected to BoardFlow Realtime Engine:",
        socketInstance.id,
      );
      socketInstance.emit("JOIN_BOARD", { boardId });
    });

    // Capture and load initial historical elements out of the database data arrays
    socketInstance.on(
      "LOAD_BOARD_ELEMENTS",
      (historicalElements: CanvasElement[]) => {
        set({ elements: historicalElements });
        console.log(
          `📦 Loaded ${historicalElements.length} persistent elements from database storage.`,
        );
      },
    );

    socketInstance.on(
      "ELEMENT_CREATED_REMOTE",
      (remoteElement: CanvasElement) => {
        get().addRemoteElement(remoteElement);
      },
    );

    socketInstance.on(
      "DRAWING_PREVIEW_REMOTE",
      (data: { userId: string; element: CanvasElement | null }) => {
        set((state) => {
          const updatedPreviews = { ...state.remoteDrawingPreviews };
          if (data.element) {
            updatedPreviews[data.userId] = data.element;
          } else {
            delete updatedPreviews[data.userId];
          }
          return { remoteDrawingPreviews: updatedPreviews };
        });
      },
    );

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
        delete updatedCursors[data.userId];
        delete updatedPreviews[data.userId];
        return {
          remoteCursors: updatedCursors,
          remoteDrawingPreviews: updatedPreviews,
        };
      });
    });

    socketInstance.on(
      "ELEMENT_UPDATED_REMOTE",
      (updatedElement: CanvasElement) => {
        set((state) => ({
          elements: state.elements.map((el) =>
            el.id === updatedElement.id ? updatedElement : el,
          ),
        }));
      },
    );

    socketInstance.on("ELEMENT_DELETED_REMOTE", (deletedId: string) => {
      set((state) => ({
        elements: state.elements.filter((el) => el.id !== deletedId),
        // Clear selection if the deleted element was the one we had selected
        selectedElementId:
          state.selectedElementId === deletedId
            ? null
            : state.selectedElementId,
      }));
    });

    set({ socket: socketInstance, boardId });
  },

  setTool: (tool) => set({ currentTool: tool }),

  updateCamera: (cameraPartial) =>
    set((state) => ({ camera: { ...state.camera, ...cameraPartial } })),

  // Local user creates a shape -> save locally AND emit to backend pipeline
  addElement: (element) => {
    set((state) => ({ elements: [...state.elements, element] }));

    const { socket, boardId } = get();
    if (socket) {
      // Stream the action down to our NestJS gateway broker
      socket.emit("ELEMENT_CREATE", { boardId, element });
    }
  },

  // Remote updates -> inject into our rendering array without re-emitting
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

  setFillColor: (color: string | null) => set({ currentFillColor: color }),

  setSelectedElementId: (id) => set({ selectedElementId: id }),

  updateElementPosition: (id, dx, dy) => {
    set((state) => {
      const updatedElements = state.elements.map((el) => {
        if (el.id !== id) return el;

        // Shift coordinate spaces by delta changes
        if (el.type === "arrow") {
          return { ...el, x: el.x + dx, y: el.y + dy };
        } else {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
      });

      const targetElement = updatedElements.find((el) => el.id === id);
      const { socket, boardId } = get();
      if (socket && targetElement) {
        // Broadcast movement deltas over WebSockets
        socket.emit("ELEMENT_UPDATE", { boardId, element: targetElement });
      }

      return { elements: updatedElements };
    });
  },

  deleteElement: (id) => {
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementId:
        state.selectedElementId === id ? null : state.selectedElementId,
    }));

    const { socket, boardId } = get();
    if (socket) {
      // Notify backend pipeline to remove it from database & other clients
      socket.emit("ELEMENT_DELETE", { boardId, elementId: id });
    }
  },
}));

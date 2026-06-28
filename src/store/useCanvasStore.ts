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

const getRecentBoardsStorageKey = (username: string | null) =>
  username
    ? `boardflow_recent_boards_${username}`
    : "boardflow_recent_boards_guest";

const loadVisitedBoards = (username: string | null) =>
  JSON.parse(localStorage.getItem(getRecentBoardsStorageKey(username)) || "[]");

const SESSION_KEY = "boardflow_user";
const SESSION_ACTIVITY_KEY = "boardflow_session_activity";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const clearAuthSession = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_ACTIVITY_KEY);
};

const resetAuthSessionActivity = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SESSION_ACTIVITY_KEY, Date.now().toString());
};

const isAuthSessionExpired = () => {
  if (typeof window === "undefined") return false;

  const lastActivity = Number(
    window.sessionStorage.getItem(SESSION_ACTIVITY_KEY) || 0,
  );

  if (!lastActivity) return false;
  return Date.now() - lastActivity > SESSION_TIMEOUT_MS;
};

const getStoredUsername = () => {
  if (typeof window === "undefined") return null;

  const username = window.sessionStorage.getItem(SESSION_KEY);
  if (!username) return null;

  if (isAuthSessionExpired()) {
    clearAuthSession();
    return null;
  }

  resetAuthSessionActivity();
  return username;
};

const initialUsername = getStoredUsername();

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  return `${window.location.protocol}//${window.location.hostname}:3000`;
};

const getElementBounds = (element: CanvasElement) => {
  if (element.type === "freehand") {
    const points = (element as any).points || [];
    if (points.length > 0) {
      const xs = points.map((point: any) => point.x);
      const ys = points.map((point: any) => point.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
  }

  const x2 = element.x + element.width;
  const y2 = element.y + element.height;
  return {
    minX: Math.min(element.x, x2),
    minY: Math.min(element.y, y2),
    maxX: Math.max(element.x, x2),
    maxY: Math.max(element.y, y2),
  };
};

const getCameraForElements = (elements: CanvasElement[]): Camera | null => {
  if (elements.length === 0) return null;

  const bounds = elements.map(getElementBounds);
  const minX = Math.min(...bounds.map((bound) => bound.minX));
  const minY = Math.min(...bounds.map((bound) => bound.minY));
  const maxX = Math.max(...bounds.map((bound) => bound.maxX));
  const maxY = Math.max(...bounds.map((bound) => bound.maxY));
  const boardWidth = Math.max(1, maxX - minX);
  const boardHeight = Math.max(1, maxY - minY);
  const padding = 120;
  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 720;
  const availableWidth = Math.max(240, viewportWidth - padding * 2);
  const availableHeight = Math.max(180, viewportHeight - padding * 2);
  const zoom = Math.min(
    1,
    availableWidth / boardWidth,
    availableHeight / boardHeight,
  );

  return {
    zoom,
    x: (viewportWidth - boardWidth * zoom) / 2 - minX * zoom,
    y: (viewportHeight - boardHeight * zoom) / 2 - minY * zoom,
  };
};

interface CanvasState {
  elements: CanvasElement[];
  remoteDrawingPreviews: Record<string, CanvasElement>;
  remoteCursors: Record<string, RemoteCursor>;
  remoteTypingIndicators: Record<string, TypingIndicator>;
  camera: Camera;
  currentTool: ElementType | "select" | "fill";
  socket: Socket | null;
  presenceSocket: Socket | null;
  boardId: string;
  currentStrokeColor: string;
  currentStrokeWidth: number;
  currentFillColor: string | null;
  selectedElementId: string | null;
  historyStack: CanvasElement[][];
  futureStack: CanvasElement[][];
  username: string | null;
  boardName: string;
  visitedBoards: Array<{ id: string; title: string; updatedAt: string }>;
  activeUsersByBoard: Record<string, string[]>;

  setBoardName: (name: string) => void;
  initPresenceSocket: (boardIds: string[]) => void;
  disconnectPresenceSocket: () => void;
  disconnectSocket: () => void;
  clearCanvas: () => void;
  clearRemoteCanvas: () => void;
  leaveCanvasWorkspace: () => void;
  deleteElement: (id: string) => void;
  initSocket: (boardId: string) => void;
  setTool: (tool: ElementType | "select" | "fill") => void;
  updateCamera: (cameraPartial: Partial<Camera>) => void;
  addElement: (element: CanvasElement) => void;
  addRemoteElement: (element: CanvasElement) => void;
  updateDrawingPreview: (element: CanvasElement | null) => void;
  updateCursorPosition: (x: number, y: number) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setFillColor: (color: string | null) => void;
  setSelectedElementId: (id: string | null) => void;
  updateElementStyle: (
    id: string,
    style: Partial<
      Pick<CanvasElement, "strokeColor" | "strokeWidth" | "fillColor">
    >,
  ) => void;
  updateElementPosition: (id: string, dx: number, dy: number) => void;
  undo: () => void;
  redo: () => void;
  saveHistorySnapshot: () => void;
  setUsername: (name: string) => void;
  logoutUser: () => void;
  trackVisitedBoard: (boardId: string, currentServerName?: string) => void;
  removeVisitedBoard: (boardId: string) => void;
  syncElementPosition: (id: string) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => {
  let sessionTimer: number | null = null;

  const clearSessionTimer = () => {
    if (sessionTimer !== null) {
      window.clearTimeout(sessionTimer);
      sessionTimer = null;
    }
  };

  const scheduleSessionTimeout = () => {
    clearSessionTimer();

    if (typeof window === "undefined") return;
    if (!get().username) return;

    sessionTimer = window.setTimeout(() => {
      if (get().username && isAuthSessionExpired()) {
        get().logoutUser();
      } else if (get().username) {
        resetAuthSessionActivity();
        scheduleSessionTimeout();
      }
    }, SESSION_TIMEOUT_MS);
  };

  const registerSessionActivity = () => {
    resetAuthSessionActivity();
    scheduleSessionTimeout();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("mousemove", registerSessionActivity, {
      passive: true,
    });
    window.addEventListener("keydown", registerSessionActivity, {
      passive: true,
    });
    window.addEventListener("click", registerSessionActivity, {
      passive: true,
    });
    window.addEventListener("scroll", registerSessionActivity, {
      passive: true,
    });
    window.addEventListener("touchstart", registerSessionActivity, {
      passive: true,
    });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (get().username && isAuthSessionExpired()) {
          get().logoutUser();
        } else {
          registerSessionActivity();
        }
      }
    });

    if (initialUsername) {
      registerSessionActivity();
    }
  }

  return {
  elements: [],
  remoteDrawingPreviews: {},
  remoteCursors: {},
  remoteTypingIndicators: {},
  camera: { x: 0, y: 0, zoom: 1 },
  currentTool: "select",
  socket: null,
  presenceSocket: null,
  boardId: "",
  currentStrokeColor: "#ffffff",
  currentStrokeWidth: 2,
  currentFillColor: null,
  selectedElementId: null,
  historyStack: [],
  futureStack: [],
  username: initialUsername,
  boardName: "Untitled Workspace",
  visitedBoards: loadVisitedBoards(initialUsername),
  activeUsersByBoard: {},

  syncElementPosition: (id) => {
    const { socket, boardId, elements } = get();

    const element = elements.find((el) => el.id === id);

    if (!element || !socket) return;

    socket.emit("ELEMENT_UPDATE", {
      boardId,
      element,
    });
  },

  setBoardName: (name: string) => {
    const { boardId, socket, username } = get();
    set({ boardName: name });

    if (socket) {
      socket.emit("BOARD_RENAME", { boardId, name });
    }

    const recentStorageKey = getRecentBoardsStorageKey(username);
    const currentRecent = JSON.parse(
      localStorage.getItem(recentStorageKey) || "[]",
    );
    const updatedList = currentRecent.map((board: any) =>
      board.id === boardId ? { ...board, title: name } : board,
    );

    localStorage.setItem(recentStorageKey, JSON.stringify(updatedList));
    set({ visitedBoards: updatedList });
  },

  setUsername: (name: string) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_KEY, name);
    }
    resetAuthSessionActivity();
    scheduleSessionTimeout();
    set({ username: name, visitedBoards: loadVisitedBoards(name) });
  },

  logoutUser: () => {
    clearSessionTimer();
    get().disconnectPresenceSocket();
    clearAuthSession();
    set({
      username: null,
      visitedBoards: [],
      boardName: "Untitled Workspace",
      activeUsersByBoard: {},
    });
  },

  initPresenceSocket: (boardIds) => {
    const uniqueBoardIds = Array.from(new Set(boardIds));
    if (uniqueBoardIds.length === 0) {
      set({ activeUsersByBoard: {} });
      return;
    }

    let presenceSocket = get().presenceSocket;
    if (!presenceSocket) {
      presenceSocket = io(getSocketUrl());
      presenceSocket.on(
        "PRESENCE_SUMMARY",
        (data: { boardId: string; users: string[]; onlineCount: number }) => {
          set((state) => ({
            activeUsersByBoard: {
              ...state.activeUsersByBoard,
              [data.boardId]: data.users,
            },
          }));
        },
      );
      set({ presenceSocket });
    }

    presenceSocket.emit("WATCH_BOARD_PRESENCE", { boardIds: uniqueBoardIds });
  },

  disconnectPresenceSocket: () => {
    const { presenceSocket } = get();
    if (presenceSocket) {
      presenceSocket.disconnect();
      set({ presenceSocket: null });
    }
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  clearCanvas: () => {
    get().saveHistorySnapshot();
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

    const socketInstance = io(getSocketUrl());

    socketInstance.on("connect", () => {
      console.log(
        "⚡ Connected to BoardFlow Realtime Engine:",
        socketInstance.id,
      );
      socketInstance.emit("JOIN_BOARD", { boardId, username: get().username });
    });

    socketInstance.on(
      "BOARD_LOADED",
      (data: { elements: any[]; boardName: string }) => {
        const camera = getCameraForElements(data.elements);
        set({
          elements: data.elements,
          boardName: data.boardName || "Untitled Workspace",
          boardId,
          ...(camera ? { camera } : {}),
        });
        get().trackVisitedBoard(boardId, data.boardName);
      },
    );

    socketInstance.on(
      "BOARD_STATE_REQUEST",
      (data: { requesterId: string }) => {
        const { elements, boardName } = get();
        socketInstance.emit("BOARD_STATE_RESPONSE", {
          boardId,
          requesterId: data.requesterId,
          elements,
          boardName,
        });
      },
    );

    socketInstance.on(
      "BOARD_STATE_RESPONSE",
      (data: { elements: CanvasElement[]; boardName?: string }) => {
        if (data.elements.length === 0) return;
        const camera = getCameraForElements(data.elements);

        set({
          elements: data.elements,
          boardName: data.boardName || get().boardName,
          ...(camera ? { camera } : {}),
        });
        get().trackVisitedBoard(boardId, data.boardName);
      },
    );

    socketInstance.on("BOARD_RENAMED_REMOTE", (data: { name: string }) => {
      set({ boardName: data.name });
    });

    socketInstance.on(
      "ACTIVE_USERS_UPDATED",
      (data: { boardId: string; users: string[]; onlineCount: number }) => {
        set((state) => ({
          activeUsersByBoard: {
            ...state.activeUsersByBoard,
            [data.boardId]: data.users,
          },
        }));
      },
    );

    socketInstance.on(
      "ELEMENT_CREATED_REMOTE",
      (remoteElement: CanvasElement) => {
        set((state) => ({ elements: [...state.elements, remoteElement] }));
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

    socketInstance.on(
      "TYPING_STATUS_REMOTE",
      (data: {
        userId: string;
        worldX: number;
        worldY: number;
        isTyping: boolean;
        text: string;
      }) => {
        set((state) => {
          const updatedIndicators = { ...state.remoteTypingIndicators };
          if (!data.isTyping) {
            delete updatedIndicators[data.userId];
          } else {
            updatedIndicators[data.userId] = {
              worldX: data.worldX,
              worldY: data.worldY,
              text: data.text,
            };
          }
          return { remoteTypingIndicators: updatedIndicators };
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
        const updatedTyping = { ...state.remoteTypingIndicators };
        delete updatedCursors[data.userId];
        delete updatedPreviews[data.userId];
        delete updatedTyping[data.userId];
        return {
          remoteCursors: updatedCursors,
          remoteDrawingPreviews: updatedPreviews,
          remoteTypingIndicators: updatedTyping,
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

  addElement: (element) => {
    get().saveHistorySnapshot();
    set((state) => ({ elements: [...state.elements, element] }));

    const { socket, boardId } = get();
    if (socket) {
      socket.emit("ELEMENT_CREATE", {
        boardId,
        element: {
          ...element,
          points:
            element.type === "freehand" ? (element as any).points : undefined,
        },
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

  setStrokeColor: (color) => set({ currentStrokeColor: color }),
  setStrokeWidth: (width) => set({ currentStrokeWidth: width }),
  setFillColor: (color) => set({ currentFillColor: color }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  updateElementStyle: (id, style) => {
    get().saveHistorySnapshot(); // 👈 Fixed: Retain style tracking states inside undo/redo framework
    set((state) => {
      const updatedElements = state.elements.map((el) =>
        el.id === id ? { ...el, ...style } : el,
      );

      const targetElement = updatedElements.find((el) => el.id === id);
      const { socket, boardId } = get();
      if (socket && targetElement) {
        socket.emit("ELEMENT_UPDATE", { boardId, element: targetElement });
      }

      return { elements: updatedElements };
    });
  },

  updateElementPosition: (id, dx, dy) => {
    set((state) => ({
      elements: state.elements.map((el) => {
        if (el.id !== id) return el;

        if (el.type === "freehand" && (el as any).points) {
          const shiftedPoints = (el as any).points.map((p: any) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));

          return {
            ...el,
            x: el.x + dx,
            y: el.y + dy,
            points: shiftedPoints,
          };
        }

        return {
          ...el,
          x: el.x + dx,
          y: el.y + dy,
        };
      }),
    }));
  },

  deleteElement: (id) => {
    get().saveHistorySnapshot();
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedElementId:
        state.selectedElementId === id ? null : state.selectedElementId,
    }));

    const { socket, boardId } = get();
    if (socket) {
      socket.emit("ELEMENT_DELETE", { boardId, elementId: id });
    }
  },

  saveHistorySnapshot: () => {
    set((state) => ({
      historyStack: [
        ...state.historyStack,
        JSON.parse(JSON.stringify(state.elements)),
      ],
      futureStack: [],
    }));
  },

  undo: () => {
    const { historyStack, elements, socket, boardId } = get();
    if (historyStack.length === 0) return;

    const previousSnapshot = historyStack[historyStack.length - 1];
    const remainingHistory = historyStack.slice(0, historyStack.length - 1);
    const currentSnapshot = JSON.parse(JSON.stringify(elements));

    set({
      elements: previousSnapshot,
      historyStack: remainingHistory,
      futureStack: [...get().futureStack, currentSnapshot],
      selectedElementId: null,
    });

    // 🚀 Optimizing networking: Trigger a single update operation instead of pushing items iteratively
    if (socket) {
      socket.emit("BOARD_REPLACE_ALL", { boardId, elements: previousSnapshot });
    }
  },

  redo: () => {
    const { futureStack, elements, socket, boardId } = get();
    if (futureStack.length === 0) return;

    const nextSnapshot = futureStack[futureStack.length - 1];
    const remainingFuture = futureStack.slice(0, futureStack.length - 1);
    const currentSnapshot = JSON.parse(JSON.stringify(elements));

    set({
      elements: nextSnapshot,
      historyStack: [...get().historyStack, currentSnapshot],
      futureStack: remainingFuture,
      selectedElementId: null,
    });

    if (socket) {
      socket.emit("BOARD_REPLACE_ALL", { boardId, elements: nextSnapshot });
    }
  },

  trackVisitedBoard: (boardId: string, currentServerName?: string) => {
    const recentStorageKey = getRecentBoardsStorageKey(get().username);
    const currentRecent = JSON.parse(
      localStorage.getItem(recentStorageKey) || "[]",
    );
    const existingBoard = currentRecent.find((b: any) => b.id === boardId);
    const updatedList = currentRecent.filter((b: any) => b.id !== boardId);

    const boardTitle =
      currentServerName ||
      (existingBoard ? existingBoard.title : `Workspace Layout (${boardId})`);

    updatedList.unshift({
      id: boardId,
      title: boardTitle,
      updatedAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    const trimmedList = updatedList.slice(0, 5);
    localStorage.setItem(recentStorageKey, JSON.stringify(trimmedList));
    set({ visitedBoards: trimmedList, boardName: boardTitle });
  },

  removeVisitedBoard: (boardId: string) => {
    const recentStorageKey = getRecentBoardsStorageKey(get().username);
    const currentRecent = JSON.parse(
      localStorage.getItem(recentStorageKey) || "[]",
    );
    const updatedList = currentRecent.filter((board: any) => board.id !== boardId);

    localStorage.setItem(recentStorageKey, JSON.stringify(updatedList));
    set({ visitedBoards: updatedList });
  },
  };
});

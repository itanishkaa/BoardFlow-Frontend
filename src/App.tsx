import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { Dashboard } from "./components/Dashboard";
import { useCanvasStore } from "./store/useCanvasStore";
import { Home, Link2 } from "lucide-react";

// This wrapper component extracts the dynamic board ID parameter from your URL string
function BoardWorkspaceWrapper() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const username = useCanvasStore((state: any) => state.username);
  const initSocket = useCanvasStore((state) => state.initSocket);
  const disconnectSocket = useCanvasStore((state) => state.disconnectSocket);

  const trackVisitedBoard = useCanvasStore((state) => state.trackVisitedBoard);

  const boardName = useCanvasStore((state: any) => state.boardName);
  const setBoardName = useCanvasStore((state: any) => state.setBoardName);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const copyShareLink = async () => {
    const shareUrl = window.location.href;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setShareStatus("copied");
      window.setTimeout(() => setShareStatus("idle"), 1600);
    } catch {
      setShareStatus("failed");
      window.setTimeout(() => setShareStatus("idle"), 2400);
    }
  };

  useEffect(() => {
    if (id && username) {
      // 🚀 Dynamically connect to the EXACT scope matching the URL params!
      initSocket(id);
      trackVisitedBoard(id);
    }

    return () => {
      disconnectSocket();
    };
  }, [id, username, initSocket, disconnectSocket, trackVisitedBoard]);

  if (!username) {
    return <Navigate to="/" replace state={{ redirectTo: `/board/${id}` }} />;
  }

  return (
    <div className="app-shell">
      <Canvas />
      <Toolbar />
      <div
        className="info-banner"
        style={{ display: "flex", alignItems: "center", gap: "12px" }}
      >
        {/* Live Editing Input Element */}
        <input
          type="text"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          placeholder="Rename Workspace..."
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid #444",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "13px",
            fontWeight: 600,
            outline: "none",
            width: "160px",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
          onBlur={(e) => (e.target.style.borderColor = "#444")}
        />

        <span className="info-banner__divider">|</span>
        <span style={{ color: "#3b82f6", fontWeight: 600 }}>
          Active Room: {id}
        </span>
        <span className="info-banner__divider">|</span>
        <button
          onClick={copyShareLink}
          title="Copy Share Link"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "transparent",
            border: "none",
            color: "#9ca3af",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
            padding: 0,
          }}
        >
          <Link2 size={13} />{" "}
          {shareStatus === "copied"
            ? "Copied"
            : shareStatus === "failed"
              ? "Copy failed"
              : "Share"}
        </button>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "transparent",
            border: "none",
            color: "#9ca3af",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <Home size={13} />
          Dashboard
        </button>
        <span className="info-banner__divider">|</span>
        <span>
          Left-Click + Drag to pan • Scroll to zoom • Realtime Sync Active
        </span>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dashboard Landing Route */}
        <Route path="/" element={<Dashboard />} />

        {/* Dynamic Isolated Board Workspaces */}
        <Route path="/board/:id" element={<BoardWorkspaceWrapper />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

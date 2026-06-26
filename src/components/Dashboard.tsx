import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCanvasStore } from "../store/useCanvasStore";
import {
  Plus,
  LayoutGrid,
  Clock,
  Users,
  UserCheck,
  LogOut,
  Trash2,
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    username,
    setUsername,
    logoutUser,
    visitedBoards,
    removeVisitedBoard,
    activeUsersByBoard,
    initPresenceSocket,
    disconnectPresenceSocket,
  } = useCanvasStore() as any;
  const [inputName, setInputName] = useState("");
  const redirectTo = (location.state as { redirectTo?: string } | null)
    ?.redirectTo;
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    board: any | null;
  }>({
    open: false,
    board: null,
  });

  useEffect(() => {
    if (!username) {
      setInputName("");
    }
  }, [username]);

  useEffect(() => {
    if (!username || visitedBoards.length === 0) return;

    initPresenceSocket(visitedBoards.map((board: any) => board.id));
    return () => disconnectPresenceSocket();
  }, [username, visitedBoards, initPresenceSocket, disconnectPresenceSocket]);

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      // Check if username already exists in any active users
      const allActiveUsers = Object.values(activeUsersByBoard).flat() as string[];
      if (allActiveUsers.includes(inputName.trim())) {
        alert("Username already exists. Please choose a different name.");
        return;
      }
      setUsername(inputName.trim());
      if (redirectTo) {
        navigate(redirectTo);
      }
    }
  };

  const handleCreateNewBoard = () => {
    const uniqueBoardId = crypto.randomUUID().slice(0, 8);
    navigate(`/board/${uniqueBoardId}`);
  };

  const handleDeleteWorkspace = (event: React.MouseEvent, board: any) => {
    event.stopPropagation();

    setDeleteModal({
      open: true,
      board,
    });
  };

  const confirmDeleteWorkspace = () => {
    if (deleteModal.board) {
      removeVisitedBoard(deleteModal.board.id);
    }

    setDeleteModal({
      open: false,
      board: null,
    });
  };

  // 🛡️ AUTH SHIELD: If no username is registered, force Guest Entry input view
  if (!username) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          backgroundColor: "#1e1e1e",
          color: "#fff",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            backgroundColor: "#2d2d2d",
            borderRadius: "12px",
            border: "1px solid #3e3e3e",
            padding: "32px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.5px",
              }}
            >
              BoardFlow
            </h1>
            <p
              style={{ margin: "6px 0 0", color: "#9ca3af", fontSize: "14px" }}
            >
              Enter guest mode to start collaborating
            </p>
          </div>

          <form
            onSubmit={handleGuestSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "#9ca3af",
                  marginBottom: "6px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Your Screen Alias
              </label>
              <input
                type="text"
                required
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="e.g. Frontend Dev"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  background: "#1e1e1e",
                  border: "1px solid #444",
                  color: "#fff",
                  outline: "none",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "12px",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <UserCheck size={16} /> Enter Workspace Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 🏠 MAIN DASHBOARD VIEW (Unlocked for Authenticated Guest Profiles)
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        backgroundColor: "#1e1e1e",
        color: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "640px" }}>
        {/* Top Account Profile Metadata HUD */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.5px",
              }}
            >
              Welcome, {username} 👋
            </h1>
            <p
              style={{ margin: "4px 0 0", color: "#9ca3af", fontSize: "14px" }}
            >
              Collaborative vector boards
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleCreateNewBoard}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#3b82f6",
                color: "#fff",
                border: "none",
                padding: "10px 16px",
                borderRadius: "8px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
              }}
            >
              <Plus size={16} /> Create Board
            </button>
            <button
              onClick={() => {
                logoutUser();
              }}
              title="Logout Profile"
              style={{
                background: "#2d2d2d",
                border: "1px solid #444",
                color: "#9ca3af",
                padding: "10px",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Dynamic visited list tracking card wrapper */}
        <div
          style={{
            backgroundColor: "#2d2d2d",
            borderRadius: "12px",
            border: "1px solid #3e3e3e",
            padding: "24px",
          }}
        >
          <h3
            style={{
              margin: "0 0 16px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <LayoutGrid size={14} /> Your Visited Workspaces
          </h3>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {visitedBoards.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: "14px",
                  border: "1px dashed #444",
                  borderRadius: "8px",
                }}
              >
                No active canvas history found. Create a new board or follow an
                active team link to populate logs!
              </div>
            ) : (
              visitedBoards.map((board: any) => {
                const activeUsers = activeUsersByBoard[board.id] || [];

                return (
                  <div
                    key={board.id}
                    onClick={() => navigate(`/board/${board.id}`)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px",
                      backgroundColor: "#1e1e1e",
                      border: "1px solid #3e3e3e",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      gap: "16px",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "#3b82f6")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "#3e3e3e")
                    }
                  >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#fff",
                        marginBottom: "4px",
                      }}
                    >
                      {board.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>
                      Room Hash ID: {board.id}
                    </div>
                    {activeUsers.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          marginTop: "10px",
                          color: "#9ca3af",
                          fontSize: "12px",
                        }}
                      >
                        {(() => {
                          const uniqueUsers = Array.from(new Set(activeUsers));
                          return (
                            <>
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  color: "#22c55e",
                                  fontWeight: 600,
                                }}
                              >
                                <Users size={13} /> {uniqueUsers.length} Active{" "}
                                {uniqueUsers.length === 1
                                  ? "Collaborator"
                                  : "Collaborators"}
                              </span>
                              {uniqueUsers.length > 1 && (
                                <span>{uniqueUsers.slice(0, 3).join(" • ")}</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontSize: "12px",
                      color: "#9ca3af",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Clock size={12} /> Last Visited: {board.updatedAt}
                    </span>
                    <button
                      onClick={(event) => handleDeleteWorkspace(event, board)}
                      title="Remove from Recent Workspaces"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        padding: "6px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      {deleteModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() =>
            setDeleteModal({
              open: false,
              board: null,
            })
          }
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "#2d2d2d",
              border: "1px solid #3e3e3e",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: "12px",
                color: "#fff",
                fontSize: "18px",
              }}
            >
              Remove Workspace?
            </h3>

            <p
              style={{
                color: "#9ca3af",
                fontSize: "14px",
                lineHeight: 1.6,
                marginBottom: "24px",
              }}
            >
              Are you sure you want to remove{" "}
              <strong style={{ color: "#fff" }}>
                {deleteModal.board?.title}
              </strong>{" "}
              from your recent workspaces?
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
              }}
            >
              <button
                onClick={() =>
                  setDeleteModal({
                    open: false,
                    board: null,
                  })
                }
                style={{
                  background: "#1e1e1e",
                  border: "1px solid #444",
                  color: "#9ca3af",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                onClick={confirmDeleteWorkspace}
                style={{
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

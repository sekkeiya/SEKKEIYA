import React, { useState, useEffect } from "react";
import { Box, Tooltip, IconButton, Divider, Collapse } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import FolderSharedRoundedIcon from "@mui/icons-material/FolderSharedRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";

import { useAuth } from "@/features/auth/context/AuthContext";
import { collection, onSnapshot, query, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/shared/config/firebase";
import { signOut } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BRAND } from "../ui/theme";
import { useGlobalPanelStore, MiniSidebar } from "sekkeiya-global-panel";
import { useBoardStore } from "@/shared/store/useBoardStore";
import { getBoardRoute } from "@/shared/utils/boardRouting";
import useBoards from "@/shared/hooks/useBoards";

// Replaced inline AppIcons and MiniSidebar

const ExpandedSidebarItem = ({ icon, label, href, onClick, onExpand, onDelete, endAdornment, active }) => {
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (!href) return;
    if (e.ctrlKey || e.metaKey) {
      window.open(href, "_blank");
    } else {
      if (href.startsWith("http") || href.startsWith("/app/")) {
        window.location.assign(href);
      } else {
        window.location.assign(href); 
      }
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 2,
        py: 0.75,
        borderRadius: 1.5,
        mx: 1.5,
        color: active ? "#fff" : "rgba(255,255,255,0.7)",
        bgcolor: active ? "rgba(255,255,255,0.08)" : "transparent",
        "&:hover": {
          bgcolor: "rgba(255,255,255,0.06)",
          color: "#fff",
        },
        "&:hover .delete-btn": {
          opacity: 1,
        }
      }}
    >
      <Box 
        onClick={handleClick}
        sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, cursor: "pointer", overflow: "hidden" }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
          {icon}
        </Box>
        <Box sx={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Box>
      </Box>

      {onDelete && (
        <IconButton 
          className="delete-btn"
          size="small" 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          sx={{ opacity: 0, transition: "opacity 0.2s", color: "error.main", p: 0.5, ml: href ? 0 : "auto" }}
        >
          <DeleteRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}

      {endAdornment && (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onExpand?.(e); }}
          sx={{ p: 0.5, ml: 0.5, color: "inherit", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}
        >
          {endAdornment}
        </IconButton>
      )}
    </Box>
  );
};

const BoardAccordion = ({ board, isTeam = false, activeBoardId, activeChatId, onSelectBoard, onSelectChat }) => {
  const isActiveBoard = activeBoardId === board.id;
  const [open, setOpen] = useState(isActiveBoard);
  const [chats, setChats] = useState([]);
  
  useEffect(() => {
    if (!open) return;
    const q = query(collection(db, `boards/${board.id}/chats`));
    const unsub = onSnapshot(q, (snap) => {
      // client-side sort to avoid requiring composite indexes initially
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fetched.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChats(fetched);
    });
    return unsub;
  }, [board.id, open]);

  const handleCreateChat = async () => {
    try {
      const q = collection(db, `boards/${board.id}/chats`);
      const newChatRef = await addDoc(q, {
        title: "新規チャット",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onSelectChat(board.id, newChatRef.id);
      if (!open) setOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Box sx={{ mb: 0.5 }}>
      <ExpandedSidebarItem 
        icon={isTeam ? <FolderSharedRoundedIcon sx={{ fontSize: 18, color: isActiveBoard ? "#3498db" : "inherit" }} /> : <LockRoundedIcon sx={{ fontSize: 18, color: isActiveBoard ? "#9b59b6" : "inherit" }} />} 
        label={board.name} 
        active={isActiveBoard}
        onClick={() => onSelectBoard(board.id)} 
        onExpand={() => setOpen(!open)}
        endAdornment={open ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, opacity: 0.7 }} /> : <KeyboardArrowRightRoundedIcon sx={{ fontSize: 18, opacity: 0.7 }} />}
      />
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 6, pr: 1.5, py: 0.5, borderLeft: `1px solid rgba(255,255,255,0.1)`, ml: 3.5 }}>
          {chats.length === 0 ? (
            <Box sx={{ py: 1, fontSize: 12, color: 'text.secondary' }}>チャットはありません</Box>
          ) : (
            chats.map(chat => {
              const isActiveChat = activeChatId === chat.id;
              return (
                <Box
                  key={chat.id}
                  onClick={() => onSelectChat(board.id, chat.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.5,
                    py: 1,
                    mb: 0.5,
                    cursor: "pointer",
                    borderRadius: 1,
                    color: isActiveChat ? "#fff" : "rgba(255,255,255,0.6)",
                    bgcolor: isActiveChat ? "rgba(255,255,255,0.12)" : "transparent",
                    borderLeft: isActiveChat ? `2px solid #3498db` : `2px solid transparent`,
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.06)",
                      color: "#fff",
                    }
                  }}
                >
                  <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14, color: isActiveChat ? "#3498db" : "inherit" }} />
                  <Box sx={{ fontSize: 12, fontWeight: isActiveChat ? 600 : 400, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {chat.title || "名称未設定チャット"}
                  </Box>
                </Box>
              )
            })
          )}
          <Box
            onClick={handleCreateChat}
            sx={{
              display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, cursor: "pointer",
              color: "rgba(255,255,255,0.5)", borderRadius: 1, fontSize: 12, mt: 0.5,
              "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: "#fff" }
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 14 }} /> 新規チャットを作成
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

const ExpandedSidebar = ({ onClose, onCreateProject, activeTab, onSelectTab }) => {
  const { myBoards, teamBoards } = useBoards();
  const { currentApp, currentBoardId, setCurrentBoardId, setCurrentChatId, currentChatId } = useBoardStore();
  const navigate = useNavigate();

  const handleSelectBoard = (boardId) => {
    setCurrentBoardId(boardId);
    navigate(getBoardRoute(currentApp, boardId));
  };

  const handleSelectChat = (boardId, chatId) => {
    setCurrentBoardId(boardId);
    setCurrentChatId(chatId);
    navigate(getBoardRoute(currentApp, boardId));
  };

  return (
    <Box
      sx={{
        width: 240,
        height: "100vh",
        bgcolor: "rgba(10, 12, 16, 0.95)",
        borderRight: `1px solid ${BRAND.line}`,
        display: "flex",
        flexDirection: "column",
        py: 1.5,
        boxShadow: "4px 0 24px rgba(0,0,0,0.4)",
        overflowY: "auto",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, mb: 1, pl: 3 }}>
        <Box sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.9)" }}>MENU</Box>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon sx={{ color: "rgba(255,255,255,0.5)", fontSize: 18 }} />
        </IconButton>
      </Box>

      <Divider sx={{ opacity: 0.1, my: 1, mx: 2 }} />

      <ExpandedSidebarItem icon={<HomeRoundedIcon sx={{ fontSize: 20 }} />} label="ホーム" onClick={() => onSelectTab("home")} />
      <ExpandedSidebarItem icon={<HubRoundedIcon sx={{ fontSize: 20 }} />} label="ハブ" onClick={() => onSelectTab("hub")} />

      <Divider sx={{ opacity: 0.1, my: 1.5, mx: 2 }} />
      
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mb: 0.5 }}>
        <Box sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>My Boards</Box>
        <IconButton size="small" onClick={() => navigate("/dashboard/boards")} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}>
          <AddRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      {myBoards.map(p => (
        <BoardAccordion key={p.id} board={p} activeBoardId={currentBoardId} activeChatId={currentChatId} onSelectBoard={handleSelectBoard} onSelectChat={handleSelectChat} />
      ))}

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, mt: 2, mb: 0.5 }}>
        <Box sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>Team Boards</Box>
        <IconButton size="small" onClick={() => navigate("/dashboard/boards")} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" } }}>
          <AddRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      {teamBoards.map(p => (
        <BoardAccordion key={p.id} board={p} isTeam activeBoardId={currentBoardId} activeChatId={currentChatId} onSelectBoard={handleSelectBoard} onSelectChat={handleSelectChat} />
      ))}
    </Box>
  );
};

export default function LeftSidebar({ onSelectProject, activeTab, onSelectTab }) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const { myBoards, teamBoards } = useBoards();
  const boards = [...myBoards, ...teamBoards];
  const { currentApp, currentBoardId, recentApps } = useBoardStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const storeActivePanel = useGlobalPanelStore((state) => state.activePanel);
  const activePanelState = searchParams.get("panel") || storeActivePanel;

  const setSidebarExpanded = useGlobalPanelStore(state => state.setSidebarExpanded);

  React.useEffect(() => {
    setSidebarExpanded(isExpanded);
  }, [isExpanded, setSidebarExpanded]);

  const handleCreateProject = (type) => {
    alert("ボード作成機能はBoard Managementに移行予定です");
  };

  const handleTogglePanel = (panelName) => {
    const next = new URLSearchParams(searchParams);
    if (activePanelState === panelName) {
      next.delete("panel");
    } else {
      next.set("panel", panelName);
    }
    setSearchParams(next);
  };

  return (
    <Box
      sx={{
        display: "flex",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 50,
      }}
    >
      <MiniSidebar
        currentApp={currentApp || "sekkeiya"}
        currentBoardId={currentBoardId}
        boards={boards}
        user={user}
        onNavigate={(path) => navigate(path)}
        onNavigateExternal={(url) => window.location.assign(url)}
        onOpenChat={() => handleTogglePanel("chat")}
        onOpenDrive={() => handleTogglePanel("drive")}
        activePanelState={activePanelState}
        onLogout={async () => {
          try {
            await signOut(auth);
            window.location.assign("/");
          } catch (e) {
            console.error(e);
            window.location.assign("/");
          }
        }}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        recentApps={recentApps}
      />
      
      {isExpanded && (
        <ExpandedSidebar
          onClose={() => setIsExpanded(false)}
          onCreateProject={handleCreateProject}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
        />
      )}
    </Box>
  );
}

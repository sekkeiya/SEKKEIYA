import React, { useState } from "react";
import { 
  Drawer, Box, Typography, IconButton, Button, 
  CircularProgress, Chip, Dialog, DialogTitle, 
  DialogContent, DialogActions 
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import { useSectionHistory } from "../hooks/useSectionHistory";
import { restoreFromSnapshot } from "../api/sectionUtils";

/**
 * 共有のセクション履歴ドロワー
 * @param {boolean} open
 * @param {function} onClose
 * @param {string} projectId
 * @param {string} section
 * @param {string} currentUser - 実行ユーザー (主に "system" または userID)
 */
export default function HistoryDrawer({ open, onClose, projectId, section, currentUser = "system" }) {
  const { history, loading } = useSectionHistory(projectId, section);
  
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const handleOpenPreview = (item) => {
    setSelectedVersion(item);
  };

  const handleClosePreview = () => {
    if (restoreLoading) return;
    setSelectedVersion(null);
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;
    setRestoreLoading(true);
    try {
      await restoreFromSnapshot(projectId, section, selectedVersion.id, currentUser);
      setSelectedVersion(null);
      // ドロワーは開いたままでOK（新しいVersionが一番上に積まれる）
    } catch (err) {
      console.error("Failed to restore:", err);
      alert("復元に失敗しました");
    } finally {
      setRestoreLoading(false);
    }
  };

  const renderTimelineItem = (item, index) => {
    const isLatest = index === 0;
    const dateStr = item.changedAt?.toMillis ? new Date(item.changedAt.toMillis()).toLocaleString() : "日時不明";
    
    // アイコンや色の判定
    const isAi = item.source?.includes("ai");
    const isRestored = item.isRestored;
    const iconColor = isRestored ? "#f6d365" : (isAi ? "#a18cd1" : "#4facfe");
    const Icon = isAi ? AutoAwesomeRoundedIcon : (isRestored ? RestoreRoundedIcon : PersonRoundedIcon);

    return (
      <Box key={item.id} sx={{ display: "flex", mb: 3, position: "relative" }}>
        {/* Connector line (except last) */}
        {index !== history.length - 1 && (
          <Box sx={{ position: "absolute", left: 15, top: 32, bottom: -24, width: 2, bgcolor: "rgba(255,255,255,0.1)" }} />
        )}
        
        {/* Dot / Icon */}
        <Box sx={{ 
          width: 32, height: 32, borderRadius: "50%", 
          bgcolor: `rgba(${isRestored ? '246,211,101' : (isAi ? '161,140,209' : '79,172,254')}, 0.1)`, 
          border: `1px solid ${iconColor}`, 
          display: "flex", alignItems: "center", justifyContent: "center", mt: 0.5, zIndex: 1 
        }}>
          <Icon sx={{ fontSize: 16, color: iconColor }} />
        </Box>
        
        {/* Content */}
        <Box sx={{ ml: 2, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ color: "#fff", fontWeight: 800 }}>Version {item.version}</Typography>
            {isLatest && <Chip label="Current" size="small" sx={{ height: 16, fontSize: "0.6rem", bgcolor: "rgba(67, 233, 123, 0.2)", color: "#43e97b", fontWeight: 800 }} />}
            {isRestored && <Chip label={`Restored from v${item.restoredFromVersion}`} size="small" sx={{ height: 16, fontSize: "0.6rem", bgcolor: "rgba(246, 211, 101, 0.2)", color: "#f6d365", fontWeight: 800 }} />}
          </Box>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block", mb: 1 }}>{dateStr}</Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)" }}>{item.summary}</Typography>
          {item.reason && (
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mt: 0.5, display: "block", fontStyle: "italic" }}>
              理由: {item.reason}
            </Typography>
          )}

          {!isLatest && (
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => handleOpenPreview(item)}
              sx={{ mt: 1.5, borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", textTransform: "none", py: 0.2 }}
            >
              復元プレビュー
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 400 },
            bgcolor: "#111",
            borderLeft: "1px solid rgba(255,255,255,0.1)",
            backgroundImage: "none",
            p: 3
          }
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <HistoryRoundedIcon sx={{ color: "rgba(255,255,255,0.7)" }} />
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>変更履歴 ({section})</Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: "rgba(255,255,255,0.5)" }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={24} sx={{ color: "rgba(255,255,255,0.3)" }} />
          </Box>
        ) : history.length === 0 ? (
          <Typography sx={{ color: "rgba(255,255,255,0.4)", textAlign: "center", py: 5, fontSize: "0.9rem" }}>
            まだ履歴がありません。<br/>データが変更されるとここに記録されます。
          </Typography>
        ) : (
          <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
            {history.map((item, i) => renderTimelineItem(item, i))}
          </Box>
        )}
      </Drawer>

      {/* Restore Confirmation Dialog */}
      <Dialog 
        open={!!selectedVersion} 
        onClose={handleClosePreview}
        PaperProps={{ sx: { bgcolor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3, minWidth: { xs: 300, sm: 400 } } }}
      >
        <DialogTitle sx={{ color: "#fff", fontWeight: 800, pb: 1 }}>
          対象バージョンへ復元しますか？
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 2 }}>
            現在の {section} セクションのデータを破棄し、以下の状態に完全に上書きします。
          </Typography>
          <Box sx={{ p: 2, bgcolor: "rgba(0,0,0,0.3)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.05)" }}>
            <Typography variant="subtitle2" sx={{ color: "#fff", mb: 0.5 }}>Version {selectedVersion?.version}</Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)" }}>{selectedVersion?.summary}</Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)", display: "block", mt: 1 }}>
              復元データ: {selectedVersion?.snapshot?.items?.length || 0} アイテム
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "#f6d365", display: "block", mt: 2, fontWeight: 700 }}>
            ※ 復元前データが失われないよう、実行と同時に現在の状態も新しい履歴としてバックアップ保存されます。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleClosePreview} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }} disabled={restoreLoading}>
            キャンセル
          </Button>
          <Button 
            variant="contained" 
            color="warning" 
            onClick={handleRestore}
            disabled={restoreLoading}
            startIcon={restoreLoading ? <CircularProgress size={16} color="inherit" /> : <RestoreRoundedIcon />}
            sx={{ fontWeight: 800, textTransform: "none", borderRadius: 2 }}
          >
            {restoreLoading ? "復元中..." : "このバージョンに復元する"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

import React, { useState } from "react";
import { Box, Typography, Button, Paper, CircularProgress, Chip } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { resolveDraftStatus } from "../api/sectionUtils";

/**
 * AIによる新しいドラフト案が存在するときに表示するバナー
 * @param {Object} draft - Draft object
 * @param {string} projectId
 * @param {string} section
 * @param {function} onAccept - 適用時のコールバック（親側でCurrent上書き等を実行）
 * @param {function} onDiscard - 破棄時のコールバック
 */
export default function DraftPreviewBanner({ draft, projectId, section, onAccept, onDiscard }) {
  const [processing, setProcessing] = useState(false);

  if (!draft) return null;

  const handleAccept = async () => {
    setProcessing(true);
    try {
      if (onAccept) await onAccept(draft.data);
      await resolveDraftStatus(projectId, section, draft.id, "accepted");
    } catch (err) {
      console.error("Failed to accept draft:", err);
      alert("適用に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  const handleDiscard = async () => {
    setProcessing(true);
    try {
      if (onDiscard) await onDiscard(draft.data);
      await resolveDraftStatus(projectId, section, draft.id, "rejected");
    } catch (err) {
      console.error("Failed to discard draft:", err);
    } finally {
      setProcessing(false);
    }
  };

  const timeStr = draft.createdAt?.toMillis ? new Date(draft.createdAt.toMillis()).toLocaleString() : "日時不明";

  return (
    <Paper 
      sx={{ 
        p: 3, 
        mb: 5, 
        bgcolor: "rgba(161,140,209,0.1)", 
        border: "1px solid #a18cd1", 
        borderRadius: 4,
        display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "space-between", alignItems: "center",
        boxShadow: "0 8px 32px rgba(161,140,209,0.2)"
      }}
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ width: 44, height: 44, borderRadius: "50%", bgcolor: "rgba(161,140,209,0.2)", display: "flex", alignItems: "center", justifyContent: "center", mt: 0.5 }}>
          <AutoAwesomeRoundedIcon sx={{ color: "#a18cd1", fontSize: 24 }} />
        </Box>
        <Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5 }}>
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800 }}>AIからの新しい提案があります</Typography>
            <Chip label="Draft" size="small" sx={{ bgcolor: "#a18cd1", color: "#fff", fontWeight: 800, height: 20, fontSize: "0.7rem" }} />
          </Box>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
            生成日時: {timeStr}
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", display: "block", mt: 0.5 }}>
            ※このデータはまだ確定していません。適用を押すことで現在のデータが上書きされ、新しい履歴として保存されます。
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
        <Button 
          variant="outlined" 
          onClick={handleDiscard}
          disabled={processing}
          startIcon={<CloseRoundedIcon />}
          sx={{ color: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.2)", borderRadius: 8, textTransform: "none", fontWeight: 700 }}
        >
          破棄する
        </Button>
        <Button 
          variant="contained" 
          onClick={handleAccept}
          disabled={processing}
          startIcon={processing ? <CircularProgress size={16} color="inherit" /> : <CheckRoundedIcon />}
          sx={{ 
            bgcolor: "#a18cd1", color: "#fff", borderRadius: 8, textTransform: "none", fontWeight: 800, px: 3,
            "&:hover": { bgcolor: "#b4a1df" }
          }}
        >
          提案を適用する
        </Button>
      </Box>
    </Paper>
  );
}

import React, { useMemo, useState, useCallback } from "react";
import { Button, Menu, MenuItem, ListItemText, ListItemIcon, Divider } from "@mui/material";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import ViewAgendaRoundedIcon from "@mui/icons-material/ViewAgendaRounded";
import InsertLinkRoundedIcon from "@mui/icons-material/InsertLinkRounded";

import { createLayoutShare } from "@layout/features/layout/utils/layoutShareUtils"; // ←あなたの場所に合わせて

export default function ShareMenuButton({
  uid,
  boardType,
  boardId,
  baseId,
  planId,
  optionId,
  snapshot, // { boardName, baseName, planName, optionName, baseGlbUrl, layout }
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const disabledReason = useMemo(() => {
    if (!uid) return "ログインが必要です";
    if (!boardId) return "boardId がありません";
    if (!baseId) return "baseId がありません";
    if (!planId) return "planId がありません";
    if (!optionId) return "optionId がありません";
    if (!snapshot?.layout) return "layout がありません";
    return "";
  }, [uid, boardId, baseId, planId, optionId, snapshot]);

  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const doShare = useCallback(
    async (catalogScope) => {
      try {
        handleClose();

        const shareId = await createLayoutShare({
          ownerUid: uid,
          source: { boardType, boardId, baseId, planId, optionId },
          snapshot,
          visibility: "public",
          catalogScope, // "project" | "base" | "plan" | "option"
        });

        // Viewer は「今見ている案」を開く（?base&plan&option を付ける）
        const viewerUrl =
          `${window.location.origin}/layout/viewer/${shareId}` +
          `?base=${encodeURIComponent(baseId)}` +
          `&plan=${encodeURIComponent(planId)}` +
          `&option=${encodeURIComponent(optionId)}`;

        window.open(viewerUrl, "_blank", "noopener,noreferrer");

        // URLコピーもしておく（好みで）
        await navigator.clipboard.writeText(viewerUrl);
      } catch (err) {
        console.error(err);
        alert("共有に失敗しました");
      }
    },
    [uid, boardType, boardId, baseId, planId, optionId, snapshot, handleClose]
  );

  return (
    <>
      <Button
        variant="contained"
        startIcon={<ShareRoundedIcon />}
        onClick={handleOpen}
        disabled={!!disabledReason}
        title={disabledReason || "共有範囲を選択"}
      >
        共有
      </Button>

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => doShare("project")}>
          <ListItemIcon><AccountTreeRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="プロジェクトごと" secondary="全 Base / 全 Plan / 全 Option を閲覧可能" />
        </MenuItem>

        <MenuItem onClick={() => doShare("base")}>
          <ListItemIcon><LayersRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Base ごと" secondary="この Base 配下のみ（全 Plan / 全 Option）" />
        </MenuItem>

        <MenuItem onClick={() => doShare("plan")}>
          <ListItemIcon><ViewAgendaRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Plan ごと" secondary="この Plan の全 Option のみ" />
        </MenuItem>

        <Divider />

        <MenuItem onClick={() => doShare("option")}>
          <ListItemIcon><InsertLinkRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Option ごと" secondary="この Option だけ（切替なし）" />
        </MenuItem>
      </Menu>
    </>
  );
}

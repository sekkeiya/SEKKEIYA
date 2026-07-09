// src/features/layout/components/Header/components/ProjectTabs.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Tabs, Tab, Tooltip, IconButton, Typography, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import { useWorkspaceTabs } from "../../../contexts/WorkspaceTabsContext";
import OpenProjectDialog from "./OpenProjectDialog.jsx";

function shortId(id) {
  const s = String(id || "");
  if (s.length <= 12) return s || "-";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * ProjectTabs
 * ✅ tabs の id は「boardKey（/boards/:boardKey）」で統一する
 *
 * 改修:
 * - タブ切替に時間がかかる場合でも「切替中」を明確に見せる
 *   - クリック直後に pendingId を持つ
 *   - currentBoardKey が pendingId に追いつくまでスピナー表示
 *   - 150ms遅延で瞬間切替のチラつきを抑制
 */
export default function ProjectTabs({
  currentBoardKey,
  currentBoardName,
  currentBoardId, // 任意（今は使わない）
}) {
  const theme = useTheme();
  const { tabs, activeId, setActive, closeTab, openTab, updateTabTitle } = useWorkspaceTabs();

  // ---------------------------
  // 現在ボード名を context へ同期（id=boardKey で！）
  // ---------------------------
  useEffect(() => {
    const id = String(currentBoardKey || "").trim();
    const name = String(currentBoardName || "").trim();
    if (!id || !name) return;
    updateTabTitle(id, name);
  }, [currentBoardKey, currentBoardName, updateTabTitle]);

  // ---------------------------
  // ✅ switching UX
  // ---------------------------
  const [pendingId, setPendingId] = useState(null); // ユーザーが「行きたい先」
  const [showSwitching, setShowSwitching] = useState(false); // 遅延表示用
  const pendingTimerRef = useRef(null);
  const hardTimeoutRef = useRef(null);

  const canonicalCurrentId = useMemo(() => String(currentBoardKey || "").trim(), [currentBoardKey]);

  // pendingId を出したら 150ms 後に “切替中表示” をON（瞬間切替は出さない）
  useEffect(() => {
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    if (!pendingId) {
      setShowSwitching(false);
      return;
    }
    pendingTimerRef.current = window.setTimeout(() => setShowSwitching(true), 150);
    return () => {
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    };
  }, [pendingId]);

  // ルート（currentBoardKey）が pendingId に追いついたら終了
  useEffect(() => {
    if (!pendingId) return;
    if (!canonicalCurrentId) return;

    if (canonicalCurrentId === pendingId) {
      setPendingId(null);
      setShowSwitching(false);
      if (hardTimeoutRef.current) window.clearTimeout(hardTimeoutRef.current);
    }
  }, [canonicalCurrentId, pendingId]);

  // 万が一遷移が失敗/止まった時の保険（10秒で解除）
  useEffect(() => {
    if (hardTimeoutRef.current) window.clearTimeout(hardTimeoutRef.current);
    if (!pendingId) return;

    hardTimeoutRef.current = window.setTimeout(() => {
      setPendingId(null);
      setShowSwitching(false);
    }, 10000);

    return () => {
      if (hardTimeoutRef.current) window.clearTimeout(hardTimeoutRef.current);
    };
  }, [pendingId]);

  const isSwitching = !!pendingId && pendingId !== canonicalCurrentId;
  const switchingVisible = isSwitching && showSwitching;

  // ---------------------------
  // dialog
  // ---------------------------
  const [open, setOpen] = useState(false);

  const handleChangeTab = useCallback(
    (_e, nextId) => {
      const id = String(nextId || "").trim();
      if (!id) return;

      // ✅ ここで “切替中” を即予約（UIフィードバック）
      if (id !== canonicalCurrentId) setPendingId(id);

      setActive(id); // ✅ id は boardKey
    },
    [setActive, canonicalCurrentId]
  );

  const handleClickPlus = useCallback(() => setOpen(true), []);
  const handleCloseDialog = useCallback(() => setOpen(false), []);

  // ✅ OpenProjectDialog 側は { workspaceId, name, path } を返す
  const handlePickProject = useCallback(
    ({ workspaceId, name, path }) => {
      const id = String(workspaceId || "").trim();
      if (!id) return;

      openTab({
        boardId: id, // ✅ openTab の boardId は「tabsのid」として扱うので workspaceId を渡す
        title: name,
        path,
      });

      // 追加で開く→そのままアクティブにするならここで setActive/pending を入れてもOK
      // setPendingId(id); setActive(id);

      setOpen(false);
    },
    [openTab]
  );

  const tabValue = useMemo(() => {
    // Tabsは value が tabs に存在しないと警告が出るのでガード
    if (activeId && tabs.some((t) => t?.id === activeId)) return activeId;
    if (tabs[0]?.id) return tabs[0].id;
    return false;
  }, [activeId, tabs]);

  // “切替中” のスピナーをどのタブに載せるか
  const spinningTabId = useMemo(() => (switchingVisible ? pendingId : null), [switchingVisible, pendingId]);

  return (
    <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, gap: 1, position: "relative" }}>
      <Tabs
        value={tabValue}
        onChange={handleChangeTab}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          minHeight: 34,
          "& .MuiTabs-flexContainer": { gap: 0.5 },
          "& .MuiTab-root": {
            minHeight: 34,
            height: 34,
            px: 1.25,
            textTransform: "none",
            borderRadius: 999,
            color: alpha(theme.palette.common.white, 0.78),
            border: `1px solid ${alpha(theme.palette.common.white, 0.10)}`,
            background: "color-mix(in srgb, var(--brand-surface) 45%, transparent)",
            minWidth: 120,
            maxWidth: 260,
          },
          "& .MuiTab-root.Mui-selected": {
            color: theme.palette.common.white,
            background: "color-mix(in srgb, var(--brand-surface) 85%, transparent)",
            borderColor: alpha(theme.palette.common.white, 0.18),
          },
          "& .MuiTabs-indicator": { display: "none" },
        }}
      >
        {tabs.map((t) => {
          const tabId = String(t?.id || "").trim();
          const isSpinning = spinningTabId && tabId === spinningTabId;

          const label = (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minWidth: 0,
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {t?.title || `Project-${shortId(t?.id)}`}
              </Typography>

              {/* ✅ 切替中スピナー（該当タブだけ） */}
              {isSpinning ? <CircularProgress size={12} /> : null}

              {/* ❗ Tabはbuttonなので IconButton(button) を入れない（nested button回避） */}
              <Box
                component="span"
                role="button"
                aria-label="Close tab"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeTab(t?.id);
                }}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  color: alpha(theme.palette.common.white, 0.70),
                  "&:hover": {
                    color: theme.palette.common.white,
                    background: alpha(theme.palette.common.white, 0.10),
                  },
                  flex: "0 0 auto",
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: 14 }} />
              </Box>
            </Box>
          );

          return <Tab key={t.id} value={t.id} label={label} disableRipple />;
        })}
      </Tabs>

      <Tooltip title="Open Project">
        <IconButton
          size="small"
          onClick={handleClickPlus}
          sx={{
            width: 30,
            height: 30,
            borderRadius: 999,
            border: `1px solid ${alpha(theme.palette.common.white, 0.14)}`,
            background: "color-mix(in srgb, var(--brand-surface) 55%, transparent)",
            "&:hover": { background: "color-mix(in srgb, var(--brand-surface) 80%, transparent)" },
          }}
        >
          <AddRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* ✅ “切替中” のサブ表示（任意だが分かりやすい） */}
      {switchingVisible ? (
        <Box
          sx={{
            position: "absolute",
            left: 0,
            bottom: -18,
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            px: 0.75,
            py: 0.25,
            borderRadius: 999,
            border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
            background: "color-mix(in srgb, var(--brand-surface) 60%, transparent)",
            color: alpha(theme.palette.common.white, 0.85),
            fontSize: 11,
            pointerEvents: "none",
            maxWidth: "100%",
          }}
        >
          <CircularProgress size={12} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            切り替え中…
          </Typography>
        </Box>
      ) : null}

      <OpenProjectDialog open={open} onClose={handleCloseDialog} onPick={handlePickProject} />
    </Box>
  );
}

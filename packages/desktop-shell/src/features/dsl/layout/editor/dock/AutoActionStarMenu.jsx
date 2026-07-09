// AutoActionStarMenu.jsx
// 左ドック下部の★FAB。ホバーで各自動アクションのボタンが★の「下」に縦並びで
// 上から順に「ふわっと」展開する（Walkthrough のスピードダイヤル思想）。
//   - クリックすると「選択中」にし、下部パネルと右サイドバーを開く。
//       gallery 系（自動マテリアル/家具/ライティング/ラベル）
//         … 下部にスタイル選択ギャラリー（←→＋Enter/Space）＋右サイドバーに専用詳細。
//       panel 系（自動レイアウト/パース生成/動画生成）
//         … ボトムパネル（結果/Shot グリッド）＋右サイドバーに設定。
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import PhotoCameraRoundedIcon from "@mui/icons-material/PhotoCameraRounded";
import MovieCreationRoundedIcon from "@mui/icons-material/MovieCreationRounded";

import { useAutoActionStore } from "../../store/useAutoActionStore";
import { useUiRightSidebarStore } from "../../store/uiRightSidebarStore";
import { useUiSelectionStore } from "../../store/uiSelectionStore";
import { useStructureLabelStore } from "../../store/useStructureLabelStore";
import { applySelectionScope } from "../../utils/applySelectionScope";

// 自動アクション選択時に切り替えるトップツールバーのモード（スコープ）。
//   自動マテリアル → Material / 自動ラベル → Label / 自動ライティング → Lighting / それ以外 → Item
// トップの各スコープと右サイドバー専用パネルを揃えるため、対応するものは同じ scope を使う。
const SCOPE_BY_AUTO = {
  autoZone: "zone",
  autoSelect: "item",
  autoLayout: "item",
  autoReplace: "item",
  autoFurMat: "item",
  autoLighting: "lighting",
  autoRender: "item",
  autoMovie: "item",
  autoMaterial: "material",
  autoLabel: "label",
};

// すべて下部ギャラリー＋右サイドバー専用パネルで完結する。
const ITEMS = [
  { key: "autoZone",     label: "自動ゾーニング",      color: "#2dd4bf", icon: <DashboardRoundedIcon /> },
  { key: "autoSelect",   label: "自動家具選定",        color: "light-dark(#0676a8, #38bdf8)", icon: <ChecklistRoundedIcon /> },
  { key: "autoLayout",   label: "自動レイアウト",      color: "light-dark(#5704a9, #c084fc)", icon: <AutoFixHighRoundedIcon /> },
  { key: "autoReplace",  label: "自動家具差し替え",    color: "light-dark(#aa4e03, #fb923c)", icon: <SwapHorizRoundedIcon /> },
  { key: "autoMaterial", label: "自動マテリアル",      color: "#34d399", icon: <AutoFixHighRoundedIcon /> },
  { key: "autoFurMat",   label: "自動家具マテリアル",  color: "light-dark(#2f07a6, #a78bfa)", icon: <StyleRoundedIcon /> },
  { key: "autoLabel",    label: "自動ラベル",          color: "light-dark(#0c8da1, #22d3ee)", icon: <CategoryRoundedIcon /> },
  { key: "autoLighting", label: "自動ライティング",    color: "light-dark(#aa7c03, #fbbf24)", icon: <LightbulbRoundedIcon /> },
  { key: "autoRender",   label: "自動パース生成",      color: "light-dark(#054ea8, #60a5fa)", icon: <PhotoCameraRoundedIcon /> },
  { key: "autoMovie",    label: "自動動画生成",        color: "light-dark(#a10d5a, #f472b6)", icon: <MovieCreationRoundedIcon /> },
];

// 右サイドバーで AutoActionSidePanel（汎用の種別パネル）を使う種別。
// autoLayout は AutoLayoutSidePanel、autoSelect は FurnitureSelectionPanel、
// autoRender/autoMovie は Media 設定、autoAI は AutoAiSidePanel（いずれも selectedAuto 駆動）。
const MATERIAL_KINDS = ["autoMaterial", "autoFurMat", "autoLabel", "autoLighting", "autoReplace"];

export default function AutoActionStarMenu() {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const rootRef = useRef(null);

  const setActiveSide   = useAutoActionStore((s) => s.setActiveSide);
  const selectedAuto    = useAutoActionStore((s) => s.selectedAuto);
  const setSelectedAuto = useAutoActionStore((s) => s.setSelectedAuto);
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);
  const setSelectedItemId = useUiSelectionStore((s) => s.setSelectedItemId);

  // ホバーで開閉（少し遅延して閉じる）。ただし自動アクション選択中は閉じない。
  const openNow = () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } setOpen(true); };
  const closeSoon = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      if (useAutoActionStore.getState().selectedAuto) return; // 選択中はホバーを外れても閉じない
      setOpen(false);
    }, 220);
  };
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  // 選択中はメニューを開いた状態に保つ（外部から selectedAuto が立った場合も含む）
  useEffect(() => { if (selectedAuto) setOpen(true); }, [selectedAuto]);

  // 関係のない余白をクリックしたら閉じて選択解除。
  // - ★メニュー / 下部ギャラリー / 右サイドバー（data-auto-keep）/ モーダル・ポップアップ内は対象外
  // - オービット等のドラッグ（移動量大）は無視
  useEffect(() => {
    if (!open && !selectedAuto) return;
    let dx = 0, dy = 0;
    const onDown = (e) => { dx = e.clientX; dy = e.clientY; };
    const onUp = (e) => {
      if (Math.hypot(e.clientX - dx, e.clientY - dy) > 6) return; // ドラッグは無視
      const t = e.target;
      if (!t || typeof t.closest !== "function") return;
      if (rootRef.current?.contains(t)) return;
      if (t.closest("[data-auto-keep], .MuiModal-root, .MuiPopover-root, .MuiDialog-root")) return;
      setOpen(false);
      setSelectedAuto(null);
      setActiveSide(null);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
    };
  }, [open, selectedAuto, setSelectedAuto, setActiveSide]);

  const handleClickItem = useCallback((item) => {
    setSelectedAuto(item.key);
    // 右サイドバーに何が出ていても、競合する選択は解除してから専用 Properties を開く。
    // すでに開いている Scene / History は閉じ、Properties だけを表示する。
    setSelectedItemId?.(null);
    useStructureLabelStore.getState().clearSelection?.();
    setRightPanel("scene", false);
    setRightPanel("history", false);
    setRightPanel("properties", true);
    // material系のみ AutoActionSidePanel(activeSide)。layout/render/movie は selectedAuto で別パネル。
    setActiveSide(MATERIAL_KINDS.includes(item.key) ? item.key : null);
    // トップツールバーのモードも対応するスコープへ切替（自動マテリアル=Material / 自動ラベル=Label / 他=Item）。
    const scope = SCOPE_BY_AUTO[item.key];
    if (scope) applySelectionScope(scope);
  }, [setSelectedAuto, setSelectedItemId, setRightPanel, setActiveSide]);

  const aiSelected = selectedAuto === "autoAI";
  const handleAiClick = useCallback(() => {
    // AIおまかせ：下部ギャラリーにテイスト選択（Enter/Space で実行）＋右サイドバーに AI 設定を表示。
    setSelectedItemId?.(null);
    useStructureLabelStore.getState().clearSelection?.();
    setActiveSide(null);
    setSelectedAuto("autoAI");
    setRightPanel("scene", false);
    setRightPanel("history", false);
    setRightPanel("properties", true);
  }, [setSelectedItemId, setActiveSide, setSelectedAuto, setRightPanel]);

  return (
    <Box
      ref={rootRef}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
      sx={{
        position: "absolute",
        left: 16,
        // 左ドック(top:160)の下に元の間隔(200)を保って配置。
        top: 360,
        zIndex: 62,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 1,
        pointerEvents: "auto",
      }}
    >
      {/* ★ FAB（ホバーで下に展開）＋ 隣に AI実行 ボタン */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          title="自動アクション"
          sx={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            color: "var(--brand-fg)",
            background: open
              ? `linear-gradient(180deg, ${alpha("#33405f", 0.95)} 0%, ${alpha("#1a2540", 0.92)} 100%)`
              : `linear-gradient(180deg, ${alpha("#4f8cff", 0.95)} 0%, ${alpha("#2c5fff", 0.92)} 100%)`,
            border: `1px solid ${alpha("#7eaaff", 0.6)}`,
            boxShadow: `0 8px 24px ${alpha("#2c5fff", open ? 0.25 : 0.45)}`,
            transition: "transform 0.18s cubic-bezier(0.22,1,0.36,1), filter 0.15s, background 0.2s",
            opacity: open ? 1 : 0.9,
            "&:hover": { filter: "brightness(1.1)", opacity: 1 },
            "&:active": { transform: "scale(0.94)" },
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ fontSize: 20 }} />
        </Box>

        {/* AI実行：全自動アクションをAIが組み合わせて最終成果物まで一気に生成 */}
        {open && (
          <Box
            onClick={handleAiClick}
            title="AI実行：全自動アクションを組み合わせて内装〜パースまで一気に生成"
            sx={{
              display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0,
              pl: 0.6, pr: 1.4, py: 0.6, borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", color: "var(--brand-fg)",
              background: aiSelected
                ? `linear-gradient(180deg, ${alpha("#c084fc", 0.5)} 0%, ${alpha("#7c3aed", 0.5)} 100%)`
                : `linear-gradient(180deg, ${alpha("#a855f7", 0.92)} 0%, ${alpha("#6d28d9", 0.92)} 100%)`,
              border: `1px solid ${alpha("#d8b4fe", aiSelected ? 0.95 : 0.6)}`,
              boxShadow: aiSelected
                ? `0 0 0 2px ${alpha("#c084fc", 0.5)}, 0 8px 22px ${alpha("#7c3aed", 0.5)}`
                : `0 8px 22px ${alpha("#7c3aed", 0.45)}`,
              backdropFilter: "blur(8px)",
              animation: "autoFanDrop 0.32s cubic-bezier(0.22,1,0.36,1) backwards",
              transition: "transform 0.12s, filter 0.15s, box-shadow 0.18s",
              "&:hover": { filter: "brightness(1.12)", transform: "translateX(2px)" },
            }}
          >
            <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 900, letterSpacing: 0.3 }}>AI実行</Typography>
          </Box>
        )}
      </Box>

      {/* 展開アクション（★の「下」に縦並び・上から順にふわっと） */}
      {open && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
          {ITEMS.map((a, i) => {
            const isSelected = selectedAuto === a.key;
            return (
              <Box
                key={a.key}
                onClick={() => handleClickItem(a)}
                title={a.label}
                sx={{
                  pointerEvents: "auto",
                  display: "flex", alignItems: "center", gap: 1,
                  pl: 0.6, pr: 1.4, py: 0.6, borderRadius: 999, cursor: "pointer",
                  color: "var(--brand-fg)",
                  background: isSelected ? `color-mix(in srgb, ${a.color} 28%, transparent)` : alpha("#0b1020", 0.9),
                  border: `1px solid ${alpha(a.color, isSelected ? 0.95 : 0.5)}`,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${`color-mix(in srgb, ${a.color} 50%, transparent)`}, 0 8px 22px ${`color-mix(in srgb, ${a.color} 40%, transparent)`}`
                    : `0 6px 20px ${alpha("#000", 0.45)}`,
                  backdropFilter: "blur(8px)",
                  whiteSpace: "nowrap",
                  transition: "transform 0.12s, filter 0.15s, background 0.18s, box-shadow 0.18s",
                  // 上から順に降りてくる「ふわっと」アニメ
                  animation: "autoFanDrop 0.32s cubic-bezier(0.22,1,0.36,1) backwards",
                  animationDelay: `${i * 55}ms`,
                  "&:hover": { filter: "brightness(1.15)", transform: "translateX(2px)" },
                  "@keyframes autoFanDrop": {
                    "0%": { opacity: 0, transform: "translateY(-10px) scale(0.92)" },
                    "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
                  },
                }}
              >
                <Box
                  sx={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: alpha(a.color, isSelected ? 0.35 : 0.22), color: a.color,
                    "& svg": { fontSize: 18 },
                  }}
                >
                  {a.icon}
                </Box>
                <Typography sx={{ fontSize: "0.74rem", fontWeight: isSelected ? 800 : 700 }}>{a.label}</Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

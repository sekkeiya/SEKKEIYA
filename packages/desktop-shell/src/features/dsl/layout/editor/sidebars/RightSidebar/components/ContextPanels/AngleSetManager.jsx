// AngleSetManager.jsx
// 右サイドバー（パース/動画 設定）に置く「アングルセット」管理 UI。
//   - 開閉可能なセクション
//   - ＋ で新規セット作成 → そのセットに入れるアングルを一覧から選んで登録（多対多）
//   - 各セットの選択切替・改名・削除・アングル追加
// アクティブセットは useShotStore.activeSetId（still/movie 共通）。下部ギャラリーが連動。
import React, { useState, useCallback, useEffect } from "react";
import { Box, Stack, Typography, IconButton, Tooltip, Collapse } from "@mui/material";
import { alpha } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CollectionsRoundedIcon from "@mui/icons-material/CollectionsRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import PlaylistAddRoundedIcon from "@mui/icons-material/PlaylistAddRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";

import { useShotStore, shotsOfSet } from "../../../../../store/useShotStore";
import AngleOrganizerDialog from "./AngleOrganizerDialog";
import { useAutoActionStore } from "../../../../../store/useAutoActionStore";

const SectionLabel = ({ children }) => (
  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", letterSpacing: 0.4 }}>
    {children}
  </Typography>
);

// kind: そのパネルのモード（still/movie）。件数・ピッカーはこの kind で扱う。
export default function AngleSetManager({ kind, accent = "#6c87ff" }) {
  const shots       = useShotStore((s) => s.shots);
  const sets        = useShotStore((s) => s.sets);
  const activeSetId = useShotStore((s) => s.activeSetId);
  const addSet      = useShotStore((s) => s.addSet);
  const renameSet   = useShotStore((s) => s.renameSet);
  const removeSet   = useShotStore((s) => s.removeSet);
  const setActiveSetId   = useShotStore((s) => s.setActiveSetId);
  const toggleShotInSet  = useShotStore((s) => s.toggleShotInSet);

  const [open, setOpen] = useState(true);            // セクション開閉
  const [editingId, setEditingId] = useState(null);  // 改名中のセット
  const [editingName, setEditingName] = useState("");
  const [pickerSetId, setPickerSetId] = useState(null); // アングル登録ピッカー対象のセット
  const [organizerOpen, setOrganizerOpen] = useState(false); // アングル整理ダイアログ

  // 自動パース生成 / 自動動画生成 の「アングル選択モード」中は、名前編集の入力に
  // カーソル（フォーカス）を乗せない。下部ギャラリーの Enter/Space（現在のアングル追加 /
  // 自動アングル生成）は INPUT フォーカス中だと無効化されるため、入力にフォーカスがあると
  // すぐに操作できなくなる。モード中は編集を閉じてフォーカスを外す。
  const isAnglePickMode = useAutoActionStore(
    (s) => s.selectedAuto === "autoRender" || s.selectedAuto === "autoMovie"
  );
  useEffect(() => {
    if (isAnglePickMode && editingId !== null) {
      setEditingId(null);
      setEditingName("");
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) el.blur();
    }
  }, [isAnglePickMode, editingId]);

  const countOf = useCallback(
    (setId) => shotsOfSet(shots, sets, setId, kind).length,
    [shots, sets, kind],
  );

  const startEdit = (g) => { setEditingId(g.id); setEditingName(g.name); };
  const commitEdit = () => {
    if (editingId && editingName.trim()) renameSet(editingId, editingName.trim());
    setEditingId(null); setEditingName("");
  };

  const handleCreate = () => {
    const id = addSet();           // 作成＋アクティブ化
    setOpen(true);
    setPickerSetId(id);            // 続けてアングルを登録するピッカーを開く
  };

  const rows = [{ id: null, name: "未分類" }, ...sets];
  const pickerSet = pickerSetId ? sets.find((g) => g.id === pickerSetId) : null;
  const kindShots = shots.filter((sh) => (sh.kind ?? "still") === kind); // ピッカー候補（全アングル）

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* ヘッダー（開閉トグル＋新規作成） */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: open ? 0.6 : 0 }}>
        <IconButton size="small" onClick={() => setOpen((v) => !v)} sx={{ p: 0.2, color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)" }}>
          <ExpandMoreRoundedIcon sx={{ fontSize: 16, transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.18s" }} />
        </IconButton>
        <CollectionsRoundedIcon sx={{ fontSize: 13, color: alpha(accent, 0.9) }} />
        <SectionLabel>アングルセット</SectionLabel>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="アングル整理（カテゴリ・タグで一覧管理）">
          <IconButton size="small" onClick={() => setOrganizerOpen(true)}
            sx={{ p: 0.3, color: "color-mix(in srgb, var(--brand-fg) 65%, transparent)", "&:hover": { color: accent, background: alpha(accent, 0.12) } }}>
            <TuneRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="新規セットを作成してアングルを登録">
          <IconButton size="small" onClick={handleCreate}
            sx={{ p: 0.3, color: accent, background: alpha(accent, 0.14), "&:hover": { background: alpha(accent, 0.26) } }}>
            <AddRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <AngleOrganizerDialog open={organizerOpen} onClose={() => setOrganizerOpen(false)} kind={kind} accent={accent} />

      <Collapse in={open}>
        <Typography sx={{ fontSize: 9.5, opacity: 0.4, mb: 0.75, lineHeight: 1.5 }}>
          部屋や外観/内観ごとにアングルを分けて管理できます。
        </Typography>

        {/* セット一覧 */}
        <Stack spacing={0.5}>
          {rows.map((g) => {
            const isActive = (activeSetId ?? null) === (g.id ?? null);
            const isEditing = editingId === g.id;
            const count = countOf(g.id ?? null);
            return (
              <Box
                key={g.id ?? "__none__"}
                onClick={() => !isEditing && setActiveSetId(g.id ?? null)}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5, px: 0.9, py: 0.5, borderRadius: 1.5, cursor: "pointer",
                  border: `1px solid ${isActive ? alpha(accent, 0.6) : alpha("#fff", 0.08)}`,
                  background: isActive ? alpha(accent, 0.14) : "transparent",
                  "&:hover": { background: isActive ? alpha(accent, 0.2) : alpha("#fff", 0.05) },
                }}
              >
                {isActive && <CheckRoundedIcon sx={{ fontSize: 13, color: accent }} />}
                {isEditing ? (
                  <Box component="input" autoFocus={!isAnglePickMode} value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") commitEdit(); }}
                    onBlur={commitEdit}
                    sx={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--brand-fg)", fontSize: 11.5, fontWeight: 700, fontFamily: "inherit", borderBottom: `1px solid ${alpha(accent, 0.7)}` }}
                  />
                ) : (
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: isActive ? 800 : 600, color: isActive ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 85%, transparent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {g.name}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 9.5, opacity: 0.5, px: 0.3 }}>{count}</Typography>

                {g.id != null && !isEditing && (
                  <>
                    <Tooltip title="アングルを登録">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setPickerSetId(pickerSetId === g.id ? null : g.id); }}
                        sx={{ p: 0.2, color: pickerSetId === g.id ? accent : "color-mix(in srgb, var(--brand-fg) 50%, transparent)", "&:hover": { color: accent } }}>
                        <PlaylistAddRoundedIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="名前を変更">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); startEdit(g); }} sx={{ p: 0.2, opacity: 0.5, "&:hover": { opacity: 1 } }}>
                        <EditRoundedIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="セットを削除（アングルは残ります）">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeSet(g.id); if (pickerSetId === g.id) setPickerSetId(null); }} sx={{ p: 0.2, opacity: 0.5, "&:hover": { opacity: 1, color: "light-dark(#ad0000, #ff7070)" } }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            );
          })}
        </Stack>

        {/* アングル登録ピッカー（＋作成時・各セットの登録ボタンで開く） */}
        {pickerSet && (
          <Box sx={{ mt: 1, p: 1, borderRadius: 1.5, border: `1px solid ${alpha(accent, 0.4)}`, background: alpha(accent, 0.06) }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 0.75 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: accent }}>「{pickerSet.name}」に登録するアングル</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography onClick={() => setPickerSetId(null)} sx={{ cursor: "pointer", fontSize: 10, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 60%, transparent)", "&:hover": { color: "var(--brand-fg)" } }}>完了</Typography>
            </Stack>
            {kindShots.length === 0 ? (
              <Typography sx={{ fontSize: 10, opacity: 0.5, py: 0.5 }}>
                まだアングルがありません。下部ギャラリーで「現在のアングル」「自動アングル生成」から追加してください。
              </Typography>
            ) : (
              <Stack spacing={0.4} sx={{ maxHeight: 200, overflowY: "auto" }}>
                {kindShots.map((sh) => {
                  const inSet = pickerSet.shotIds.includes(sh.id);
                  return (
                    <Box key={sh.id} onClick={() => toggleShotInSet(pickerSet.id, sh.id)}
                      sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 0.5, py: 0.4, borderRadius: 1, cursor: "pointer",
                        background: inSet ? alpha(accent, 0.16) : "transparent", "&:hover": { background: alpha("#fff", 0.05) } }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: 0.5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        background: inSet ? accent : "transparent", border: `1px solid ${inSet ? accent : alpha("#fff", 0.4)}` }}>
                        {inSet && <CheckRoundedIcon sx={{ fontSize: 12, color: "var(--brand-fg)" }} />}
                      </Box>
                      <Box sx={{ width: 34, height: 22, borderRadius: 0.5, overflow: "hidden", flexShrink: 0, background: alpha("#fff", 0.06), display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {sh.thumbnail ? <img src={sh.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <ImageRoundedIcon sx={{ fontSize: 12, opacity: 0.4 }} />}
                      </Box>
                      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: inSet ? 800 : 600, color: inSet ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 80%, transparent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sh.name}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

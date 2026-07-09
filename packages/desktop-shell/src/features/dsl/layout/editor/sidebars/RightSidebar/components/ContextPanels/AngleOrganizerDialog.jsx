// AngleOrganizerDialog.jsx
// 作成済みアングル（Shot）を一覧管理するダイアログ。
//   - サムネイルグリッドで全アングルを俯瞰
//   - カテゴリ（プリセット）＋自由タグで整理 → 後から「どれが良いか」を探せる
//   - 検索 / カテゴリ・セットでの絞り込み
//   - 名前変更・削除・セット割当・そのアングルへカメラ移動
import React, { useState, useMemo } from "react";
import {
  Dialog, DialogTitle, DialogContent, Box, Stack, Typography, IconButton, Tooltip,
  TextField, Select, MenuItem, Chip, InputAdornment, Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import CollectionsRoundedIcon from "@mui/icons-material/CollectionsRounded";

import { useShotStore, PERSPECTIVE_CATEGORIES } from "../../../../../store/useShotStore";
import { CAMERA_PATH_PRESETS } from "../../../../../services/cameraPaths";
import { layoutSceneRef } from "../../../../../services/layoutSceneRef";

export default function AngleOrganizerDialog({ open, onClose, kind = "still", accent = "#6c87ff" }) {
  const shots = useShotStore((s) => s.shots);
  const sets = useShotStore((s) => s.sets);
  const renameShot = useShotStore((s) => s.renameShot);
  const removeShot = useShotStore((s) => s.removeShot);
  const setShotCategory = useShotStore((s) => s.setShotCategory);
  const addShotTag = useShotStore((s) => s.addShotTag);
  const removeShotTag = useShotStore((s) => s.removeShotTag);
  const setShotMotion = useShotStore((s) => s.setShotMotion);
  const toggleShotInSet = useShotStore((s) => s.toggleShotInSet);
  const setActiveShotId = useShotStore((s) => s.setActiveShotId);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [setFilter, setSetFilter] = useState("ALL");
  const [tagDraft, setTagDraft] = useState({}); // shotId -> 入力中タグ

  const kindShots = useMemo(
    () => shots.filter((sh) => (sh.kind ?? "still") === kind),
    [shots, kind],
  );

  const filtered = useMemo(() => {
    let list = kindShots;
    if (catFilter !== "ALL") list = list.filter((sh) => (sh.category || "その他") === catFilter);
    if (setFilter !== "ALL") {
      if (setFilter === "__none__") {
        const assigned = new Set(sets.flatMap((g) => g.shotIds));
        list = list.filter((sh) => !assigned.has(sh.id));
      } else {
        const ids = new Set(sets.find((g) => g.id === setFilter)?.shotIds || []);
        list = list.filter((sh) => ids.has(sh.id));
      }
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (sh) =>
          (sh.name || "").toLowerCase().includes(q) ||
          (sh.category || "").toLowerCase().includes(q) ||
          (sh.tags || []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [kindShots, catFilter, setFilter, search, sets]);

  const goToAngle = (sh) => {
    setActiveShotId(sh.id);
    try { layoutSceneRef.setCameraPose?.(sh.camera); } catch {}
  };

  const commitTag = (shotId) => {
    const t = (tagDraft[shotId] || "").trim();
    if (t) addShotTag(shotId, t);
    setTagDraft((d) => ({ ...d, [shotId]: "" }));
  };

  const fieldSx = {
    "& .MuiInputBase-root": { fontSize: 11.5, color: "#fff", background: alpha("#fff", 0.05), borderRadius: 1 },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.12) },
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: "rgba(16,20,30,0.98)", color: "#fff", backgroundImage: "none", border: `1px solid ${alpha("#fff", 0.1)}` } }}
    >
      <DialogTitle sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <CollectionsRoundedIcon sx={{ fontSize: 18, color: accent }} />
        <Typography sx={{ fontWeight: 900, fontSize: 14, flex: 1 }}>
          アングル整理（{kind === "movie" ? "動画" : "パース"}）
        </Typography>
        <Typography sx={{ fontSize: 11, opacity: 0.5, mr: 1 }}>{filtered.length} / {kindShots.length}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: alpha("#fff", 0.7) }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 1.5 }}>
        {/* フィルタ */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small" placeholder="名前・タグで検索" value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ ...fieldSx, minWidth: 200, flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 16, color: alpha("#fff", 0.5) }} /></InputAdornment> }}
          />
          <Select size="small" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} sx={{ ...fieldSx, minWidth: 130 }}>
            <MenuItem value="ALL">カテゴリ: 全て</MenuItem>
            {PERSPECTIVE_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
          <Select size="small" value={setFilter} onChange={(e) => setSetFilter(e.target.value)} sx={{ ...fieldSx, minWidth: 140 }}>
            <MenuItem value="ALL">セット: 全て</MenuItem>
            <MenuItem value="__none__">未分類</MenuItem>
            {sets.map((g) => <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>)}
          </Select>
        </Stack>

        {filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center", opacity: 0.5, fontSize: 12 }}>
            該当するアングルがありません。下部ギャラリーの「自動アングル生成」「現在のアングル」で追加できます。
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 1.25 }}>
            {filtered.map((sh) => {
              const inSets = sets.filter((g) => g.shotIds.includes(sh.id));
              return (
                <Box key={sh.id} sx={{ borderRadius: 1.5, border: `1px solid ${alpha("#fff", 0.1)}`, background: alpha("#fff", 0.03), overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {/* サムネイル */}
                  <Box
                    onClick={() => goToAngle(sh)}
                    title="クリックでこのアングルへカメラ移動"
                    sx={{
                      position: "relative", width: "100%", paddingBottom: "56%", cursor: "pointer",
                      background: sh.thumbnail ? `center/cover no-repeat url(${sh.thumbnail})` : alpha("#000", 0.4),
                      "&:hover .ov": { opacity: 1 },
                    }}
                  >
                    <Box className="ov" sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: alpha(accent, 0.18), opacity: 0, transition: "opacity 0.15s", fontSize: 10.5, fontWeight: 800, color: "#fff" }}>
                      <VideocamRoundedIcon sx={{ fontSize: 15, mr: 0.5 }} /> このアングルへ
                    </Box>
                  </Box>

                  <Box sx={{ p: 0.9, display: "flex", flexDirection: "column", gap: 0.7 }}>
                    {/* 名前 ＋ 削除 */}
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <TextField
                        size="small" variant="standard" value={sh.name}
                        onChange={(e) => renameShot(sh.id, e.target.value)}
                        sx={{ flex: 1, "& .MuiInput-input": { fontSize: 12, fontWeight: 700, color: "#fff", p: 0 }, "& .MuiInput-underline:before": { borderColor: alpha("#fff", 0.15) } }}
                      />
                      <Tooltip title="削除">
                        <IconButton size="small" onClick={() => removeShot(sh.id)} sx={{ p: 0.3, color: alpha("#fff", 0.5), "&:hover": { color: "#f87171" } }}>
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    {/* カテゴリ */}
                    <Select
                      size="small" value={sh.category || "その他"} onChange={(e) => setShotCategory(sh.id, e.target.value)}
                      sx={{ ...fieldSx, "& .MuiSelect-select": { py: 0.4, fontSize: 11 } }}
                    >
                      {PERSPECTIVE_CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ fontSize: 11 }}>{c}</MenuItem>)}
                    </Select>

                    {/* 動画モード: カメラの動き（自動割当を表示・微調整） */}
                    {kind === "movie" && (
                      <Select
                        size="small"
                        value={sh.movieMotion?.preset || "pushIn"}
                        onChange={(e) => setShotMotion(sh.id, { preset: e.target.value })}
                        sx={{ ...fieldSx, "& .MuiSelect-select": { py: 0.4, fontSize: 11 } }}
                        startAdornment={<VideocamRoundedIcon sx={{ fontSize: 13, color: alpha("#fff", 0.5), mr: 0.5 }} />}
                      >
                        {CAMERA_PATH_PRESETS.filter((p) => p.id !== "shots").map((p) => (
                          <MenuItem key={p.id} value={p.id} sx={{ fontSize: 11 }}>{p.label}</MenuItem>
                        ))}
                      </Select>
                    )}

                    {/* タグ */}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                      {(sh.tags || []).map((t) => (
                        <Chip key={t} label={t} size="small" onDelete={() => removeShotTag(sh.id, t)}
                          sx={{ height: 19, fontSize: 9.5, background: alpha(accent, 0.18), color: "#fff", "& .MuiChip-deleteIcon": { fontSize: 13, color: alpha("#fff", 0.6) } }} />
                      ))}
                      <TextField
                        size="small" variant="standard" placeholder="+タグ"
                        value={tagDraft[sh.id] || ""}
                        onChange={(e) => setTagDraft((d) => ({ ...d, [sh.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTag(sh.id); } }}
                        onBlur={() => commitTag(sh.id)}
                        sx={{ width: 56, "& .MuiInput-input": { fontSize: 10, color: "#fff", p: 0 }, "& .MuiInput-underline:before": { borderColor: alpha("#fff", 0.12) } }}
                      />
                    </Box>

                    {/* セット割当 */}
                    {sets.length > 0 && (
                      <>
                        <Divider sx={{ borderColor: alpha("#fff", 0.06) }} />
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4 }}>
                          {sets.map((g) => {
                            const on = g.shotIds.includes(sh.id);
                            return (
                              <Chip key={g.id} label={g.name} size="small" onClick={() => toggleShotInSet(g.id, sh.id)}
                                sx={{
                                  height: 18, fontSize: 9, cursor: "pointer",
                                  background: on ? alpha(accent, 0.3) : "transparent",
                                  border: `1px solid ${on ? alpha(accent, 0.6) : alpha("#fff", 0.12)}`,
                                  color: on ? "#fff" : alpha("#fff", 0.55),
                                }} />
                            );
                          })}
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

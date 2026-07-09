// FurnitureSelectionPanel.tsx
// 右サイドバー Properties に出す「①自動家具選定」のレビュー／編集パネル。
//
// ★メニューの「自動家具選定」で範囲（ゾーン/部屋/住宅）を選ぶと、用途別プログラムから
// ゾーンごとの「役割×個数」が選定され useFurnitureSelectionStore に入る。ここで内容を確認・
// 微調整し、「この選定で配置」で②自動レイアウトへ渡す（プログラム充足率でセットを選ぶ）。
import React from "react";
import { Box, Stack, Typography, Chip, IconButton, Button, Divider, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";

import { useFurnitureSelectionStore } from "../../../../../store/useFurnitureSelectionStore";
import { useLayoutTaskStore } from "../../../../../store/useLayoutTaskStore";
import { getLayoutCategoryLabel, getLayoutCategoryIcon } from "../../../../../constants/furnitureCategoryDefaults";
import type { FurnitureSlot } from "../../../../../types/furnitureSlot";

const ACCENT = "#38bdf8";
const SCOPE_LABEL: Record<string, string> = { zone: "ゾーン", room: "部屋", house: "住宅" };

export default function FurnitureSelectionPanel() {
  const selections = useFurnitureSelectionStore((s) => s.selections);
  const lastScope = useFurnitureSelectionStore((s) => s.lastScope);
  const updateZoneSlots = useFurnitureSelectionStore((s) => s.updateZoneSlots);
  const clear = useFurnitureSelectionStore((s) => s.clear);

  const selectedZoneIds = useLayoutTaskStore((s) => s.selectedZoneIds);

  const zoneSelections = Object.values(selections);

  const setCount = (zoneId: string, slots: FurnitureSlot[], slotId: string, delta: number) => {
    const next = slots
      .map((s) => (s.slotId === slotId ? { ...s, count: Math.min(10, s.count + delta) } : s))
      .filter((s) => s.count > 0);
    updateZoneSlots(zoneId, next);
  };

  const removeSlot = (zoneId: string, slots: FurnitureSlot[], slotId: string) => {
    updateZoneSlots(zoneId, slots.filter((s) => s.slotId !== slotId));
  };

  const highlightZone = (zoneId: string) => {
    useLayoutTaskStore.getState().setActiveZoneId(zoneId); // selectedZoneIds も同期される
  };

  const totalItems = zoneSelections.reduce(
    (sum, z) => sum + z.slots.reduce((s, slot) => s + slot.count, 0), 0,
  );

  return (
    <Box sx={{ p: 1.5, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* ヘッダ */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <ChecklistRoundedIcon sx={{ fontSize: 16, color: ACCENT }} />
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff" }}>選定リスト</Typography>
        {lastScope && (
          <Chip
            size="small"
            label={`範囲: ${SCOPE_LABEL[lastScope] ?? lastScope}`}
            sx={{ height: 18, fontSize: "0.62rem", bgcolor: alpha(ACCENT, 0.18), color: ACCENT, border: `1px solid ${alpha(ACCENT, 0.5)}` }}
          />
        )}
      </Stack>

      {zoneSelections.length === 0 ? (
        <Typography sx={{ fontSize: "0.72rem", color: alpha("#fff", 0.55), lineHeight: 1.7, mt: 1 }}>
          ★メニューの「自動家具選定」で範囲（ゾーン／部屋／住宅）を選ぶと、部屋の用途に応じて
          必要な家具がここに一覧されます。内容を調整して「この選定で配置」を押すと、選定に合う
          セット家具が自動レイアウトされます。
        </Typography>
      ) : (
        <>
          <Typography sx={{ fontSize: "0.66rem", color: alpha("#fff", 0.5), mb: 1 }}>
            {zoneSelections.length}室・家具{totalItems}点。役割と個数を調整できます。
          </Typography>

          <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0, pr: 0.5 }}>
            {zoneSelections.map((zsel) => {
              const isActive = selectedZoneIds.includes(zsel.zoneId);
              return (
                <Box
                  key={zsel.zoneId}
                  sx={{
                    mb: 1.25, borderRadius: 1.5,
                    border: `1px solid ${alpha(isActive ? ACCENT : "#fff", isActive ? 0.6 : 0.12)}`,
                    background: alpha("#0b1020", 0.5),
                    overflow: "hidden",
                  }}
                >
                  {/* ゾーン見出し（クリックで3Dハイライト） */}
                  <Stack
                    direction="row" alignItems="center" justifyContent="space-between"
                    onClick={() => highlightZone(zsel.zoneId)}
                    sx={{
                      px: 1, py: 0.6, cursor: "pointer",
                      background: alpha(ACCENT, isActive ? 0.16 : 0.06),
                      "&:hover": { background: alpha(ACCENT, 0.2) },
                    }}
                  >
                    <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#fff" }}>{zsel.label}</Typography>
                    <Typography sx={{ fontSize: "0.6rem", color: alpha("#fff", 0.45) }}>
                      {zsel.slots.reduce((s, x) => s + x.count, 0)}点
                    </Typography>
                  </Stack>

                  <Divider sx={{ borderColor: alpha("#fff", 0.08) }} />

                  {/* 役割リスト */}
                  <Stack sx={{ p: 0.5 }}>
                    {zsel.slots.map((slot) => (
                      <Stack
                        key={slot.slotId}
                        direction="row" alignItems="center" spacing={0.5}
                        sx={{ px: 0.5, py: 0.3, borderRadius: 1, "&:hover": { background: alpha("#fff", 0.04) } }}
                      >
                        <Typography sx={{ fontSize: "0.9rem", width: 20, textAlign: "center" }}>
                          {getLayoutCategoryIcon(slot.role)}
                        </Typography>
                        <Typography sx={{ flex: 1, fontSize: "0.72rem", color: alpha("#fff", 0.9) }}>
                          {getLayoutCategoryLabel(slot.role)}
                        </Typography>

                        <IconButton size="small" onClick={() => setCount(zsel.zoneId, zsel.slots, slot.slotId, -1)}
                          sx={{ width: 22, height: 22, color: alpha("#fff", 0.7) }}>
                          <RemoveRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <Typography sx={{ width: 20, textAlign: "center", fontSize: "0.72rem", fontWeight: 700, color: "#fff" }}>
                          {slot.count}
                        </Typography>
                        <IconButton size="small" onClick={() => setCount(zsel.zoneId, zsel.slots, slot.slotId, +1)}
                          sx={{ width: 22, height: 22, color: alpha("#fff", 0.7) }}>
                          <AddRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <Tooltip title="この役割を外す" placement="left">
                          <IconButton size="small" onClick={() => removeSlot(zsel.zoneId, zsel.slots, slot.slotId)}
                            sx={{ width: 22, height: 22, color: alpha("#fff", 0.4), "&:hover": { color: "#f87171" } }}>
                            <CloseRoundedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              );
            })}
          </Box>

          {/* フッタ操作 */}
          <Stack direction="row" spacing={1} sx={{ pt: 1, mt: "auto" }}>
            <Button
              fullWidth size="small" variant="outlined" onClick={clear}
              sx={{ textTransform: "none", fontSize: "0.72rem", color: alpha("#fff", 0.7), borderColor: alpha("#fff", 0.2) }}
            >
              選定をクリア
            </Button>
          </Stack>
          <Typography sx={{ fontSize: "0.6rem", color: alpha("#fff", 0.4), mt: 0.75, lineHeight: 1.5 }}>
            これは「どの部屋に何が要るか」の目安です。「自動レイアウト」を実行すると、この目安に合う
            セット家具を優先して配置します（該当セットが無い役割は個別家具で補完）。行クリックで対象ゾーンを3Dハイライト。
          </Typography>
        </>
      )}
    </Box>
  );
}

// src/features/layout/components/RightSidebar/components/PropertiesPanel.jsx
import React, { useMemo, useCallback } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { alpha } from "@mui/material/styles";

import PropertiesModelPanel from "./PropertiesPanel/PropertiesModelPanel";
import PropertiesMaterialPanel from "./PropertiesPanel/PropertiesMaterialPanel";

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function ensureVec3(v, fallback = [0, 0, 0]) {
  if (!Array.isArray(v) || v.length !== 3) return fallback;
  return [
    Number.isFinite(Number(v[0])) ? Number(v[0]) : fallback[0],
    Number.isFinite(Number(v[1])) ? Number(v[1]) : fallback[1],
    Number.isFinite(Number(v[2])) ? Number(v[2]) : fallback[2],
  ];
}

function ensureScale3(v) {
  const a = ensureVec3(v, [1, 1, 1]);
  return a.map((n) => (n <= 0 ? 1 : n));
}

export default function PropertiesPanel({
  selection, // {kind:"item"|"material", id, ...}

  // ✅ 追加：今の配置 items（LayoutShellから渡す）
  items = [],

  // ✅ 追加：items を更新して layoutDraft に反映する
  onChangeItems, // (nextItems)=>void

  // ✅ 将来：material selection切替
  onSelectMaterial, // ({ kind:"material", ... })=>void
}) {
  const panelSx = useMemo(
    () => ({
      height: "100%",
      width: "100%",
      p: 1.25,
      color: alpha("#fff", 0.92),
      overflow: "auto",
      "&::-webkit-scrollbar": { width: 10 },
      "&::-webkit-scrollbar-thumb": {
        background: alpha("#fff", 0.14),
        borderRadius: 20,
      },
    }),
    []
  );

  // ✅ kind 確定（先に決める）
  const kind = selection?.kind || "item";

  // ✅ empty判定
  // - item: selection.id が必須
  // - material: id が無い場合もあり得るので緩める（materialUuid等でもOK）
  const isEmpty = useMemo(() => {
    if (kind === "material") {
      return !selection; // selection自体が無ければ空
    }
    return !selection?.id;
  }, [kind, selection]);

  // ✅ 選択 item を引く
  const selectedItem = useMemo(() => {
    if (kind !== "item") return null;
    if (!selection?.id) return null;
    return safeArray(items).find((it) => it?.id === selection.id) ?? null;
  }, [kind, selection, items]);

  // ✅ items更新ユーティリティ（id一致の item のみ差し替え）
  const patchItem = useCallback(
    (itemId, patch) => {
      if (!itemId) return;
      const list = safeArray(items);
      const idx = list.findIndex((it) => it?.id === itemId);
      if (idx < 0) return;

      const prev = list[idx] || {};
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      const nextItems = list.slice();
      nextItems[idx] = next;

      onChangeItems?.(nextItems);
    },
    [items, onChangeItems]
  );

  // ✅ transform更新（position/rotation/scale を安全に維持）
  const handleChangeTransform = useCallback(
    (itemId, nextTransform) => {
      patchItem(itemId, (prev) => {
        const t = prev?.transform || {};
        const next = {
          position: ensureVec3(nextTransform?.position, ensureVec3(t?.position, [0, 0, 0])),
          rotation: ensureVec3(nextTransform?.rotation, ensureVec3(t?.rotation, [0, 0, 0])),
          scale: ensureScale3(nextTransform?.scale ?? t?.scale),
        };
        return { ...prev, transform: next };
      });
    },
    [patchItem]
  );

  // =========================
  // ✅ No selection
  // =========================
  if (isEmpty) {
    return (
      <Box sx={panelSx}>
        <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>No selection</Typography>
        <Typography sx={{ opacity: 0.7, fontSize: 12, mt: 0.5 }}>
          Scene / Populate からアイテムを選択してください。
        </Typography>
      </Box>
    );
  }

  // =========================
  // ✅ kindで切り替え
  // =========================
  if (kind === "material") {
    return (
      <Box sx={panelSx}>
        <PropertiesMaterialPanel selection={selection} />
      </Box>
    );
  }

  // =========================
  // ✅ item panel
  // =========================
  return (
    <Box sx={panelSx}>
      {!selectedItem ? (
        <>
          <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>Selection</Typography>
          <Typography sx={{ opacity: 0.75, fontSize: 12, mt: 0.5 }}>kind: {kind}</Typography>
          <Typography sx={{ opacity: 0.75, fontSize: 12 }}>id: {selection?.id}</Typography>
          <Divider sx={{ my: 1, borderColor: alpha("#fff", 0.08) }} />
          <Typography sx={{ opacity: 0.7, fontSize: 12 }}>
            選択された item が items に見つかりませんでした（同期待ちの可能性）。
          </Typography>
        </>
      ) : (
        <PropertiesModelPanel
          selection={selection}
          item={selectedItem}
          onChangeTransform={(nextTransform) => handleChangeTransform(selectedItem.id, nextTransform)}
          onSelectMaterial={onSelectMaterial}
        />
      )}
    </Box>
  );
}

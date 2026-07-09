// WalkthroughCharacterPanel.jsx
//
// 右サイドバーのキャラクター選択パネル。
// プリセット（簡易シルエット）と、S.Model に登録された「キャラクター」モデルの両方から選べる。

import React from "react";
import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";

import { useEditorModeStore } from "../../../../store/useEditorModeStore";
import {
  WALKTHROUGH_CHARACTERS,
  WALKTHROUGH_CHARACTER_ORDER,
  presetDescriptor,
} from "../../../../canvas/tools/walkthrough/walkthroughCharacters";
import { useWalkthroughCharacters } from "../../../../canvas/tools/walkthrough/useWalkthroughCharacters";

const MAX_HEIGHT_M = Math.max(
  ...WALKTHROUGH_CHARACTER_ORDER.map((k) => WALKTHROUGH_CHARACTERS[k].heightM)
);

function Silhouette({ color, heightM }) {
  const ratio = Math.min(1, heightM / MAX_HEIGHT_M);
  const H = 52;
  const h = Math.round(H * ratio);
  const headR = h * 0.13;
  return (
    <svg width={30} height={H} viewBox={`0 0 30 ${H}`} style={{ display: "block" }}>
      <g transform={`translate(15, ${H - h})`} fill={color}>
        <circle cx="0" cy={headR} r={headR} />
        <rect x={-h * 0.11} y={headR * 1.7} width={h * 0.22} height={h * 0.42} rx={h * 0.09} />
        <rect x={-h * 0.1} y={headR * 1.7 + h * 0.42} width={h * 0.08} height={h * 0.4} rx={h * 0.04} />
        <rect x={h * 0.02} y={headR * 1.7 + h * 0.42} width={h * 0.08} height={h * 0.4} rx={h * 0.04} />
      </g>
    </svg>
  );
}

function CharacterCard({ desc, selected, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 1.25,
        borderRadius: 1.5,
        cursor: "pointer",
        userSelect: "none",
        background: selected ? `color-mix(in srgb, ${desc.color} 18%, transparent)` : alpha("#fff", 0.03),
        border: `1px solid ${selected ? `color-mix(in srgb, ${desc.color} 80%, transparent)` : alpha("#fff", 0.08)}`,
        transition: "all 0.15s",
        "&:hover": {
          background: selected ? `color-mix(in srgb, ${desc.color} 22%, transparent)` : alpha("#fff", 0.07),
          borderColor: selected ? `color-mix(in srgb, ${desc.color} 90%, transparent)` : alpha("#fff", 0.18),
        },
      }}
    >
      {selected && (
        <CheckCircleRoundedIcon
          sx={{ position: "absolute", top: 4, right: 4, fontSize: 16, color: desc.color }}
        />
      )}
      <Box sx={{ height: 52, display: "flex", alignItems: "flex-end" }}>
        {desc.thumbUrl ? (
          <img
            src={desc.thumbUrl}
            alt={desc.label}
            style={{ height: 52, width: 40, objectFit: "contain", borderRadius: 4 }}
          />
        ) : (
          <Silhouette color={selected ? desc.color : "color-mix(in srgb, var(--brand-fg) 55%, transparent)"} heightM={desc.heightM} />
        )}
      </Box>
      <Typography
        sx={{
          fontSize: "0.72rem",
          fontWeight: selected ? 700 : 500,
          color: selected ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 80%, transparent)",
          textAlign: "center",
          lineHeight: 1.2,
          wordBreak: "break-word",
        }}
      >
        {desc.label}
      </Typography>
      <Typography sx={{ fontSize: "0.62rem", color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" }}>
        身長 {Math.round(desc.heightM * 100)}cm
      </Typography>
    </Box>
  );
}

const gridSx = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
  gap: 1,
};

export default function WalkthroughCharacterPanel() {
  const current = useEditorModeStore((s) => s.walkthroughCharacter);
  const setCharacter = useEditorModeStore((s) => s.setWalkthroughCharacter);
  const viewMode = useEditorModeStore((s) => s.walkthroughViewMode);

  const { characters: modelChars, loading } = useWalkthroughCharacters();

  const isSelected = (desc) => current?.source === desc.source && current?.id === desc.id;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Box sx={{ px: 1.25, py: 1, overflowY: "auto" }}>
        <Typography sx={{ color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)", fontSize: "0.68rem", mb: 1 }}>
          ウォークスルーで歩くキャラクターを選択（{viewMode === "first" ? "一人称" : "三人称"}）
        </Typography>

        {/* S.Model 登録キャラクター */}
        <Typography sx={{ color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: "0.7rem", fontWeight: 700, mb: 0.75 }}>
          登録キャラクター（S.Model）
        </Typography>
        {modelChars.length > 0 ? (
          <Box sx={{ ...gridSx, mb: 2 }}>
            {modelChars.map((desc) => (
              <CharacterCard
                key={`model:${desc.id}`}
                desc={desc}
                selected={isSelected(desc)}
                onClick={() => setCharacter(desc)}
              />
            ))}
          </Box>
        ) : (
          <Typography sx={{ color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", fontSize: "0.66rem", mb: 2, lineHeight: 1.5 }}>
            {loading
              ? "読み込み中…"
              : "S.Model に「キャラクター」カテゴリでモデルを登録すると、ここに表示されます。"}
          </Typography>
        )}

        {/* プリセット */}
        <Typography sx={{ color: "color-mix(in srgb, var(--brand-fg) 70%, transparent)", fontSize: "0.7rem", fontWeight: 700, mb: 0.75 }}>
          プリセット
        </Typography>
        <Box sx={gridSx}>
          {WALKTHROUGH_CHARACTER_ORDER.map((key) => {
            const desc = presetDescriptor(key);
            return (
              <CharacterCard
                key={`preset:${key}`}
                desc={desc}
                selected={isSelected(desc)}
                onClick={() => setCharacter(desc)}
              />
            );
          })}
        </Box>

        <Typography sx={{ color: "color-mix(in srgb, var(--brand-fg) 35%, transparent)", fontSize: "0.6rem", mt: 1.5, lineHeight: 1.5 }}>
          目線の高さ・体格が変わります。建築の視線やスケールの検討にご利用ください。
        </Typography>
      </Box>
    </Box>
  );
}

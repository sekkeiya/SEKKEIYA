// AutoAiSidePanel.jsx
// 右サイドバー：★メニューの「AI実行（おまかせ）」を選んでいる間に表示する設定/情報パネル。
//   - 全自動アクションを順に組み合わせて内装〜パース/動画まで生成する工程
//   - 実行に影響する設定（建物タイプ・生成モード）
//   - 実行する工程は全て個別にオン/オフ。パース生成は 標準/Cycles を選択。
// 実行自体は下部ギャラリーでテイストを選んで Enter / Space。
import React from "react";
import {
  Box, Stack, Typography, FormControl, FormLabel, RadioGroup, FormControlLabel,
  Radio, Switch, Divider, ToggleButtonGroup, ToggleButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import { useAutoLayoutStore } from "../../../../../store/useAutoLayoutStore";
import { useAiPipelineStore } from "../../../../../store/useAiPipelineStore";

const ACCENT = "#c084fc";
const line = "rgb(var(--brand-fg-rgb) / 0.1)";

const SectionLabel = ({ children }) => (
  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", letterSpacing: 0.4, mb: 0.6 }}>
    {children}
  </Typography>
);

const BUILDING_LABELS = { residential: "住宅", office: "オフィス", cafe: "カフェ", hotel: "ホテル", custom: "カスタム" };

// 実行される工程（すべてオン/オフ可能）
const STEPS = [
  { key: "label",    label: "躯体を解析（自動ラベル）" },
  { key: "layout",   label: "家具を自動配置" },
  { key: "replace",  label: "家具を差し替え" },
  { key: "material", label: "内装マテリアルを付与" },
  { key: "furMat",   label: "家具マテリアルを付与" },
  { key: "lighting", label: "ライティングを設定" },
  { key: "angles",   label: "カメラアングルを生成" },
  { key: "render",   label: "パースを生成" },
  { key: "movie",    label: "動画を生成" },
];

export default function AutoAiSidePanel() {
  const buildingType    = useAutoLayoutStore((s) => s.buildingType);
  const setBuildingType = useAutoLayoutStore((s) => s.setBuildingType);
  const autoLayoutMode    = useAutoLayoutStore((s) => s.autoLayoutMode);
  const setAutoLayoutMode = useAutoLayoutStore((s) => s.setAutoLayoutMode);

  const steps           = useAiPipelineStore((s) => s.steps);
  const setStep         = useAiPipelineStore((s) => s.setStep);
  const renderQuality   = useAiPipelineStore((s) => s.renderQuality);
  const setRenderQuality = useAiPipelineStore((s) => s.setRenderQuality);

  const radioSx = { color: line, "&.Mui-checked": { color: ACCENT }, padding: "3px 6px" };
  const switchSx = {
    "& .MuiSwitch-switchBase.Mui-checked": { color: ACCENT },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: ACCENT },
  };

  return (
    <Box sx={{ height: "100%", overflow: "auto", p: 1.5, color: "var(--brand-fg)" }}>
      {/* ヘッダー */}
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: ACCENT }} />
        <Typography sx={{ fontWeight: 900, fontSize: 12.5 }}>AI実行（おまかせ）</Typography>
      </Stack>
      <Typography sx={{ fontSize: 10, opacity: 0.5, lineHeight: 1.7, mb: 1.5 }}>
        全自動アクションを順に組み合わせて、内装〜パース/動画まで一気に生成します。
        下部ギャラリーで<strong>テイスト</strong>を選び <strong>Enter / Space</strong> で実行してください。
      </Typography>

      {/* 建物タイプ */}
      <FormControl sx={{ mb: 1.5 }}>
        <FormLabel sx={{ color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", fontSize: 10.5, fontWeight: 700, mb: 0.5, "&.Mui-focused": { color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" } }}>建物タイプ</FormLabel>
        <RadioGroup row value={buildingType} sx={{ gap: 0.5, flexWrap: "wrap" }}
          onChange={(e) => setBuildingType(e.target.value)}>
          {["residential", "office", "cafe", "hotel"].map((bt) => (
            <FormControlLabel key={bt} value={bt} control={<Radio size="small" sx={radioSx} />}
              label={<Typography sx={{ fontSize: 12 }}>{BUILDING_LABELS[bt]}</Typography>} />
          ))}
        </RadioGroup>
      </FormControl>

      {/* 生成モード */}
      <FormControl sx={{ mb: 1.25 }}>
        <FormLabel sx={{ color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", fontSize: 10.5, fontWeight: 700, mb: 0.5, "&.Mui-focused": { color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)" } }}>生成モード</FormLabel>
        <RadioGroup value={autoLayoutMode} onChange={(e) => setAutoLayoutMode(e.target.value)}>
          <FormControlLabel value="rules-only" control={<Radio size="small" sx={radioSx} />}
            label={<Typography sx={{ fontSize: 12.5 }}>ルールベース（高速）</Typography>} />
          <FormControlLabel value="ai" control={<Radio size="small" sx={radioSx} />}
            label={<Typography sx={{ fontSize: 12.5 }}>AI レイアウト</Typography>} />
        </RadioGroup>
      </FormControl>

      <Divider sx={{ borderColor: line, my: 1 }} />

      {/* 実行する工程（すべてオン/オフ） */}
      <SectionLabel>実行する工程</SectionLabel>
      <Stack spacing={0.25}>
        {STEPS.map((st, i) => {
          const on = !!steps[st.key];
          return (
            <Box key={st.key}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ py: 0.1 }}>
                <Typography sx={{ fontSize: 10, opacity: 0.4, width: 18 }}>{i + 1}.</Typography>
                <Typography sx={{ flex: 1, fontSize: 11.5, fontWeight: on ? 700 : 500, color: on ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 40%, transparent)" }}>
                  {st.label}
                </Typography>
                {/* パース生成：品質（標準/Cycles）をスイッチ手前にインライン配置 */}
                {st.key === "render" && on && (
                  <ToggleButtonGroup
                    value={renderQuality}
                    exclusive
                    size="small"
                    onChange={(_, v) => v && setRenderQuality(v)}
                    sx={{
                      "& .MuiToggleButton-root": {
                        py: 0.05, px: 0.85, fontSize: 9.5, textTransform: "none", fontWeight: 700, lineHeight: 1.6,
                        border: `1px solid ${alpha("#fff", 0.12)}`, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)",
                        "&.Mui-selected": { color: "var(--brand-fg)", background: alpha(ACCENT, 0.25), borderColor: alpha(ACCENT, 0.55) },
                      },
                    }}
                  >
                    <ToggleButton value="standard">標準</ToggleButton>
                    <ToggleButton value="cycles">Cycles</ToggleButton>
                  </ToggleButtonGroup>
                )}
                <Switch size="small" checked={on} onChange={(e) => setStep(st.key, e.target.checked)} sx={switchSx} />
              </Stack>

              {/* パース生成：品質の補足 */}
              {st.key === "render" && on && (
                <Typography sx={{ fontSize: 9, opacity: 0.4, pl: 2.25, pb: 0.5 }}>
                  {renderQuality === "cycles" ? "フォトリアル（要 Blender・時間がかかります）" : "ビューポート同等で高速"}
                </Typography>
              )}

              {/* 動画生成：注記 */}
              {st.key === "movie" && on && (
                <Typography sx={{ fontSize: 9, opacity: 0.4, pl: 2.25, pb: 0.5 }}>
                  動画品質・カメラの動きは「自動動画生成 設定」に従います（バックグラウンドで実行）。
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>

      <Typography sx={{ fontSize: 9.5, opacity: 0.4, mt: 1, lineHeight: 1.6 }}>
        カメラアングルの本数・目線・寄りは「自動アングル生成 設定」に従います。
      </Typography>
    </Box>
  );
}

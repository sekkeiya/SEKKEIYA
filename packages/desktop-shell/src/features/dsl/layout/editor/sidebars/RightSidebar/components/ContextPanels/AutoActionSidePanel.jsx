// AutoActionSidePanel.jsx
// 右サイドバー Properties に出す「自動○○」専用の詳細パネル（kind で分岐）。
// 役割分離：実行はボトムバーのホバーポップアップが担い、ここは
// 説明・対象・利用可能なスタイル・最後の実行結果を表示する「詳細／結果」ビュー。
import React from "react";
import { Box, Stack, Typography, Chip, Divider, TextField, Tooltip, IconButton, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";

import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import StyleRoundedIcon from "@mui/icons-material/StyleRounded";
import CategoryRoundedIcon from "@mui/icons-material/CategoryRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import HeightRoundedIcon from "@mui/icons-material/HeightRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ViewInArRoundedIcon from "@mui/icons-material/ViewInArRounded";

import { AUTO_ACTION_OPTIONS } from "../../../../dock/useAutoActions";
import { useAutoActionStore } from "../../../../../store/useAutoActionStore";
import { useBuildingSpecStore } from "../../../../../store/useBuildingSpecStore";
import { useHeightSetupStore } from "../../../../../store/useHeightSetupStore";
import {
  useStructureLabelStore,
  STRUCTURE_LABEL_JP,
  STRUCTURE_COLOR,
} from "../../../../../store/useStructureLabelStore";
import { useEditorModeStore } from "../../../../../store/useEditorModeStore";

const STRUCTURE_ROLES = ["floor", "outer_floor", "inner_wall", "outer_wall", "ceiling"];

// 役割ラベルのチップ列。クリックでその役割の面をまとめて選択（→面ラベル設定パネルへ）。
function RoleSelectChips() {
  const labels = useStructureLabelStore((s) => s.labels);
  const counts = React.useMemo(() => {
    const c = {};
    Object.values(labels || {}).forEach((l) => { c[l.semantic] = (c[l.semantic] || 0) + 1; });
    return c;
  }, [labels]);

  const selectByRole = (semantic) => {
    const st = useStructureLabelStore.getState();
    const faces = Object.entries(st.labels || {})
      .filter(([, l]) => l.semantic === semantic)
      .map(([key, l]) => ({ key, surface: l.surface, normalY: l.surface?.normal?.[1] ?? 0, autoSemantic: l.semantic }));
    if (!faces.length) return;
    st.selectMany(faces);
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", letterSpacing: 0.4, mb: 0.75 }}>
        役割で面を選択
      </Typography>
      {total === 0 ? (
        <Typography sx={{ fontSize: 10.5, opacity: 0.45, lineHeight: 1.5 }}>
          まだラベルがありません。下のギャラリーから自動ラベルを実行するか、面をクリックして付与してください。
        </Typography>
      ) : (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {STRUCTURE_ROLES.map((sem) => {
            const n = counts[sem] || 0;
            const color = STRUCTURE_COLOR[sem];
            return (
              <Chip
                key={sem}
                label={`${STRUCTURE_LABEL_JP[sem]} ${n}`}
                size="small"
                onClick={n ? () => selectByRole(sem) : undefined}
                disabled={!n}
                sx={{
                  height: 26, fontSize: 11.5, fontWeight: 800, borderRadius: 1,
                  cursor: n ? "pointer" : "default",
                  background: alpha(color, n ? 0.16 : 0.05),
                  border: `1px solid ${alpha(color, n ? 0.5 : 0.18)}`,
                  color: n ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 40%, transparent)",
                  "&:hover": n ? { background: `color-mix(in srgb, ${color} 28%, transparent)` } : {},
                }}
              />
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

// 階高・GL・各階 FL の入力（自動ラベルパネル内）。Base 単位で保存され、自動ラベル/
// レイアウト/マテリアル等の高さ前提として使う。値は mm。
function BuildingSpecFields({ accent }) {
  const floorHeightMm = useBuildingSpecStore((s) => s.floorHeightMm);
  const setFloorHeightMm = useBuildingSpecStore((s) => s.setFloorHeightMm);
  const glMm = useBuildingSpecStore((s) => s.glMm);
  const setGlMm = useBuildingSpecStore((s) => s.setGlMm);
  const floors = useBuildingSpecStore((s) => s.floors);
  const setFloorFlMm = useBuildingSpecStore((s) => s.setFloorFlMm);
  const addFloor = useBuildingSpecStore((s) => s.addFloor);
  const removeFloor = useBuildingSpecStore((s) => s.removeFloor);

  const heightSetupActive = useHeightSetupStore((s) => s.active);

  // 「断面で高さを設定」: 横から見たエレベーション＋断面クリップへ切替（enter）。
  // 再クリックで俯瞰パース＋クリップ復帰（exit）。詳細は useHeightSetupStore。
  const toggleHeightSetup = () => {
    const hs = useHeightSetupStore.getState();
    if (heightSetupActive) hs.exit();
    else hs.enter();
  };

  const fieldSx = {
    flex: 1,
    "& .MuiInputBase-root": { height: 32, fontSize: 12.5, color: "var(--brand-fg)", background: alpha("#fff", 0.05), borderRadius: 1 },
    "& .MuiOutlinedInput-notchedOutline": { borderColor: alpha("#fff", 0.12) },
    "& input": { textAlign: "right", py: 0 },
  };

  // 注意: Row を「内部コンポーネント」にすると毎レンダーで型が変わり TextField が
  // 再マウント→入力毎にフォーカスが外れる。関数（JSX を返すだけ）として呼び出す。
  const renderRow = (label, hint, value, onChange) => (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.9 }}>
      <Tooltip title={hint} placement="left" arrow>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 75%, transparent)", width: 64, flexShrink: 0 }}>{label}</Typography>
      </Tooltip>
      <TextField
        type="number" size="small" value={value} sx={fieldSx}
        onChange={(e) => onChange(Number(e.target.value))}
        InputProps={{ endAdornment: <Typography sx={{ fontSize: 10.5, opacity: 0.5, ml: 0.5 }}>mm</Typography> }}
      />
      <Typography sx={{ fontSize: 10, opacity: 0.4, width: 52, flexShrink: 0 }}>{(value / 1000).toFixed(2)} m</Typography>
    </Stack>
  );

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.9 }}>
        <HeightRoundedIcon sx={{ fontSize: 14, color: alpha(accent, 0.95) }} />
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 50%, transparent)", letterSpacing: 0.4 }}>
          建物の高さ設定
        </Typography>
      </Stack>
      {renderRow("階高", "階高：床から上階の床まで（スラブ厚込み）。各 FL を等間隔に駆動する主設定。", floorHeightMm, setFloorHeightMm)}

      <Divider sx={{ borderColor: alpha("#fff", 0.06), my: 1 }} />

      {/* 基準レベル：FL±0(1F床)=0 を基準に、GL・各階 FL を相対値で扱う */}
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 42%, transparent)", letterSpacing: 0.4, mb: 0.25 }}>
        基準レベル（FL±0 基準）
      </Typography>
      <Typography sx={{ fontSize: 9, opacity: 0.45, mb: 0.75, lineHeight: 1.5 }}>
        1F の床 = FL±0 = 0（基準）。GL・2FL 以降はここからの相対高さ。
      </Typography>

      {/* 1FL = FL±0（基準・固定） */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.9 }}>
        <Tooltip title="1F の床 = FL±0。設計の基準レベル（常に 0）。" placement="left" arrow>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: "light-dark(rgba(6,118,168,0.95), rgba(56,189,248,0.95))", width: 64, flexShrink: 0 }}>
            1FL (FL±0)
          </Typography>
        </Tooltip>
        <TextField
          type="number" size="small" value={0} disabled sx={{ ...fieldSx,
            "& .Mui-disabled": { WebkitTextFillColor: alpha("#fff", 0.6) } }}
          InputProps={{ endAdornment: <Typography sx={{ fontSize: 10.5, opacity: 0.5, ml: 0.5 }}>mm</Typography> }}
        />
        <Chip label="基準" size="small" sx={{ height: 18, fontSize: 9, fontWeight: 800, borderRadius: 0.8,
          background: alpha("#38bdf8", 0.18), border: `1px solid ${alpha("#38bdf8", 0.4)}`, color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)" }} />
      </Stack>

      {/* GL（FL±0 からの相対。負＝下） */}
      {renderRow("GL", "GL：地盤レベル。FL±0 からの相対。例 -500 なら「FL±0 = GL+500」。", glMm, setGlMm)}
      <Typography sx={{ fontSize: 9, opacity: 0.5, mb: 0.75, ml: "72px", mt: "-4px" }}>
        FL±0 = GL{glMm <= 0 ? " +" : " "}{Math.abs(glMm)}mm
      </Typography>

      {/* 2FL 以降（FL±0 からの相対高さ） */}
      {(floors || []).map((f, i) => (i === 0 ? null : (
        <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.9 }}>
          <Tooltip title={`${f.name}：${i + 1} 階の床。FL±0 からの相対高さ。`} placement="left" arrow>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: "light-dark(rgba(6,118,168,0.95), rgba(56,189,248,0.95))", width: 64, flexShrink: 0 }}>
              {f.name}
            </Typography>
          </Tooltip>
          <TextField
            type="number" size="small" value={f.flMm} sx={fieldSx}
            onChange={(e) => setFloorFlMm(i, Number(e.target.value))}
            InputProps={{ endAdornment: <Typography sx={{ fontSize: 10.5, opacity: 0.5, ml: 0.5 }}>mm</Typography> }}
          />
          <Typography sx={{ fontSize: 10, opacity: 0.4, width: 36, flexShrink: 0 }}>{(f.flMm / 1000).toFixed(2)}m</Typography>
          <IconButton
            size="small" onClick={() => removeFloor(i)}
            sx={{ p: 0.25, color: "color-mix(in srgb, var(--brand-fg) 55%, transparent)" }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      )))}

      <Button
        size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 15 }} />} onClick={addFloor}
        sx={{ mt: 0.25, mb: 1, fontSize: 11, fontWeight: 700, color: "light-dark(rgba(6,118,168,0.95), rgba(56,189,248,0.95))", textTransform: "none",
              "&:hover": { background: alpha("#38bdf8", 0.1) } }}
      >
        階を追加（+{(floorHeightMm / 1000).toFixed(1)}m）
      </Button>

      {/* 断面で高さを設定（ビュー切替） */}
      <Button
        fullWidth size="small" variant={heightSetupActive ? "contained" : "outlined"}
        startIcon={<ViewInArRoundedIcon sx={{ fontSize: 16 }} />}
        onClick={toggleHeightSetup}
        sx={{
          mb: 1, fontSize: 11.5, fontWeight: 800, textTransform: "none", borderRadius: 1.2,
          ...(heightSetupActive
            ? { background: accent, color: "#0b1020", "&:hover": { background: accent } }
            : { color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)", borderColor: alpha(accent, 0.5), "&:hover": { borderColor: accent, background: alpha(accent, 0.1) } }),
        }}
      >
        {heightSetupActive ? "俯瞰ビューに戻す" : "断面で高さを設定"}
      </Button>

      <Typography sx={{ fontSize: 9, opacity: 0.4, lineHeight: 1.5 }}>
        ※ 横から見た側面アングルに切替わり、GL/FL のレベル線（緑=GL・水色=FL）をドラッグ（床にスナップ）して設定できます。Ctrl+S で Base 単位に保存。
      </Typography>

      {/* 断面位置のミニマップ（高さ設定中のみ） */}
      {heightSetupActive && <SectionMiniMap accent={accent} />}
    </Box>
  );
}

// 断面位置のミニマップ（平面図）。縦線=X断面（側面/Right）・横線=Z断面（正面/Front）の
// 2 本を表示し、それぞれドラッグで切断位置を指定。高さ(Y)方向は切らない。
// 線をドラッグ／クリックするとその断面が「アクティブ（表示中のエレベーション）」になる。
const X_COLOR = "#ef9a9a"; // X断面=赤系（SectionClipManager の枠色と一致）
const Z_COLOR = "#90caf9"; // Z断面=青系
function SectionMiniMap({ accent }) {
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const axis = useHeightSetupStore((s) => s.axis);
  const setAxis = useHeightSetupStore((s) => s.setAxis);
  const sectionClipX = useEditorModeStore((s) => s.sectionClipX);
  const sectionClipZ = useEditorModeStore((s) => s.sectionClipZ);
  const setSectionClipX = useEditorModeStore((s) => s.setSectionClipX);
  const setSectionClipZ = useEditorModeStore((s) => s.setSectionClipZ);

  const svgRef = React.useRef(null);
  const dragAxisRef = React.useRef(null);
  const [dragAxis, setDragAxis] = React.useState(null); // 再描画トリガ（カーソル等の見た目用）

  // 断面位置は常に中心(0,0)から始める（モデルは XZ 中心が原点に揃えられている）。
  React.useEffect(() => {
    setSectionClipX(0);
    setSectionClipZ(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const W = 200, H = 132, pad = 16;
  const half = Math.max(sceneExtentXZ || 0, 1);
  const isMm = (sceneMaxY || 0) > 100;
  const clampW = (w) => Math.max(-half, Math.min(half, w));
  const wToX = (w) => pad + ((w + half) / (2 * half)) * (W - 2 * pad);
  const wToY = (w) => pad + ((w + half) / (2 * half)) * (H - 2 * pad);
  const xToW = (sx) => ((sx - pad) / (W - 2 * pad)) * 2 * half - half;
  const yToW = (sy) => ((sy - pad) / (H - 2 * pad)) * 2 * half - half;
  const toM = (w) => (isMm ? w : w * 1000) / 1000;

  // ドラッグ中は window で pointermove/up を拾う（svg の capture/closure に依存せず滑らかに）。
  React.useEffect(() => {
    if (!dragAxis) return;
    const onMove = (e) => {
      const a = dragAxisRef.current; if (!a) return;
      const el = svgRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      if (a === "x") {
        const sx = ((e.clientX - rect.left) / rect.width) * W;
        setSectionClipX(clampW(xToW(sx)));
      } else {
        const sy = ((e.clientY - rect.top) / rect.height) * H;
        setSectionClipZ(clampW(yToW(sy)));
      }
    };
    const onUp = () => { dragAxisRef.current = null; setDragAxis(null); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragAxis, half]);

  const startDrag = (a) => (e) => {
    e.stopPropagation(); e.preventDefault();
    dragAxisRef.current = a;
    setDragAxis(a);
    if (axis !== a) setAxis(a);     // ドラッグした断面を表示エレベーションにする
    // 初期位置を即反映
    const el = svgRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (a === "x") setSectionClipX(clampW(xToW(((e.clientX - rect.left) / rect.width) * W)));
      else setSectionClipZ(clampW(yToW(((e.clientY - rect.top) / rect.height) * H)));
    }
  };

  const lineX = wToX(clampW(sectionClipX));
  const lineY = wToY(clampW(sectionClipZ));

  const AxisChip = ({ a, label, color }) => (
    <Chip
      label={label} size="small" onClick={() => setAxis(a)}
      sx={{
        height: 22, fontSize: 10.5, fontWeight: 800, borderRadius: 1, cursor: "pointer",
        background: alpha(color, axis === a ? 0.3 : 0.08),
        border: `1px solid ${alpha(color, axis === a ? 0.9 : 0.25)}`,
        color: axis === a ? "var(--brand-fg)" : "color-mix(in srgb, var(--brand-fg) 60%, transparent)",
      }}
    />
  );

  return (
    <Box sx={{ mt: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 42%, transparent)", letterSpacing: 0.4 }}>
          断面位置（平面図）
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <AxisChip a="x" label="縦/側面" color={X_COLOR} />
          <AxisChip a="z" label="横/正面" color={Z_COLOR} />
        </Stack>
      </Stack>
      <Box
        component="svg" ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        sx={{ width: "100%", height: "auto", display: "block", borderRadius: 1, background: alpha("#fff", 0.03),
              border: `1px solid ${alpha("#fff", 0.1)}`, touchAction: "none",
              userSelect: "none", cursor: dragAxis ? (dragAxis === "x" ? "ew-resize" : "ns-resize") : "default" }}
      >
        {/* 建物フットプリント（概形） */}
        <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill={alpha("#fff", 0.05)} stroke={alpha("#fff", 0.25)} strokeWidth={1} />
        <text x={W / 2} y={H - 4} fill={alpha("#fff", 0.4)} fontSize="8" textAnchor="middle">X →（横幅）</text>
        <text x={4} y={H / 2} fill={alpha("#fff", 0.4)} fontSize="8" textAnchor="middle" transform={`rotate(-90 4 ${H / 2})`}>Z →（奥行）</text>

        {/* 縦線 = X断面（側面/Right）。当たり判定用に透明な太線を重ねる。 */}
        <line x1={lineX} y1={pad} x2={lineX} y2={H - pad} stroke="transparent" strokeWidth={14}
          style={{ cursor: "ew-resize" }} onPointerDown={startDrag("x")} />
        <line x1={lineX} y1={pad} x2={lineX} y2={H - pad} stroke={X_COLOR} strokeWidth={axis === "x" ? 2.4 : 1.4}
          strokeDasharray={axis === "x" ? "none" : "3 3"} opacity={axis === "x" ? 1 : 0.6} pointerEvents="none" />
        <circle cx={lineX} cy={H / 2} r={axis === "x" ? 5.5 : 4} fill={X_COLOR} stroke="#0b1020" strokeWidth={1}
          style={{ cursor: "ew-resize" }} onPointerDown={startDrag("x")} />

        {/* 横線 = Z断面（正面/Front） */}
        <line x1={pad} y1={lineY} x2={W - pad} y2={lineY} stroke="transparent" strokeWidth={14}
          style={{ cursor: "ns-resize" }} onPointerDown={startDrag("z")} />
        <line x1={pad} y1={lineY} x2={W - pad} y2={lineY} stroke={Z_COLOR} strokeWidth={axis === "z" ? 2.4 : 1.4}
          strokeDasharray={axis === "z" ? "none" : "3 3"} opacity={axis === "z" ? 1 : 0.6} pointerEvents="none" />
        <circle cx={W / 2} cy={lineY} r={axis === "z" ? 5.5 : 4} fill={Z_COLOR} stroke="#0b1020" strokeWidth={1}
          style={{ cursor: "ns-resize" }} onPointerDown={startDrag("z")} />
      </Box>
      <Typography sx={{ fontSize: 9, opacity: 0.5, mt: 0.4, lineHeight: 1.6 }}>
        <span style={{ color: X_COLOR }}>縦=X断面</span> {toM(clampW(sectionClipX)) >= 0 ? "+" : ""}{toM(clampW(sectionClipX)).toFixed(2)}m ／{" "}
        <span style={{ color: Z_COLOR }}>横=Z断面</span> {toM(clampW(sectionClipZ)) >= 0 ? "+" : ""}{toM(clampW(sectionClipZ)).toFixed(2)}m
        <br />各線をドラッグで移動。高さ(Y)は切りません。表示中: {axis === "x" ? "側面" : "正面"}ビュー。
      </Typography>
    </Box>
  );
}

const META = {
  autoMaterial: {
    title: "自動マテリアル",
    icon: <AutoFixHighRoundedIcon sx={{ fontSize: 16, color: "#34d399" }} />,
    accent: "#34d399",
    desc: "躯体（床・壁・天井）を自動検出して、選んだスタイルの仕上げを一括付与します。",
    target: "対象：自動ラベル済みの躯体面（床／壁／天井）。S.Material 登録素材があればテクスチャ解決に使用。",
    optionsLabel: "利用可能なスタイル",
  },
  autoFurMat: {
    title: "自動家具マテリアル",
    icon: <StyleRoundedIcon sx={{ fontSize: 16, color: "light-dark(#2f07a6, #a78bfa)" }} />,
    accent: "#a78bfa",
    desc: "家具に登録されたマテリアルバリアントを、スタイルに合わせて自動選択・一括付与します。",
    target: "対象：マテリアルバリアントが登録された配置済み家具。",
    optionsLabel: "利用可能なスタイル",
  },
  autoLabel: {
    title: "自動ラベル",
    icon: <CategoryRoundedIcon sx={{ fontSize: 16, color: "light-dark(#0c8da1, #22d3ee)" }} />,
    accent: "#22d3ee",
    desc: "躯体を3Dスキャンして 床・内壁・外壁・天井 を自動判定し、面ラベル＋コリジョンを付与します。",
    target: "対象：読み込み済みの躯体メッシュ全体。自動マテリアル／ウォークスルーの当たり判定の前提になります。",
    optionsLabel: null,
  },
  autoLighting: {
    title: "自動ライティング",
    icon: <LightbulbRoundedIcon sx={{ fontSize: 16, color: "light-dark(#aa7c03, #fbbf24)" }} />,
    accent: "#fbbf24",
    desc: "室内の広さ・天井高からムード別の照明を一括生成します（ピン留め以外を置換）。",
    target: "対象：室内ジオメトリ。ピン留めしたライトは保持されます。",
    optionsLabel: "利用可能なムード",
  },
  autoReplace: {
    title: "自動家具差し替え",
    icon: <SwapHorizRoundedIcon sx={{ fontSize: 16, color: "light-dark(#aa4e03, #fb923c)" }} />,
    accent: "#fb923c",
    desc: "配置・向きは固定したまま、家具を同カテゴリの別アイテムにスタイルへ合わせて差し替えます。",
    target: "対象：配置済みの家具。レイアウトは維持して見た目だけ変えたいときに。",
    optionsLabel: "利用可能なスタイル",
  },
};

function relTime(at) {
  if (!at) return "";
  const sec = Math.round((Date.now() - at) / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}分前`;
  return `${Math.round(min / 60)}時間前`;
}

export default function AutoActionSidePanel({ kind }) {
  const meta = META[kind] ?? META.autoMaterial;
  const accent = meta.accent;
  const options = AUTO_ACTION_OPTIONS[kind];
  const lastResult = useAutoActionStore((s) => s.lastResults[kind]);

  const resultColor =
    lastResult?.severity === "success" ? "#34d399"
    : lastResult?.severity === "warning" ? "#fbbf24"
    : lastResult?.severity === "error" ? "#f87171"
    : "#60a5fa";

  return (
    <Box sx={{ height: "100%", overflow: "auto", p: 1.5, color: "var(--brand-fg)" }}>
      {/* ヘッダー */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
        {meta.icon}
        <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{meta.title}</Typography>
      </Stack>

      <Typography sx={{ fontSize: 12, opacity: 0.7, lineHeight: 1.7, mb: 1.25 }}>
        {meta.desc}
      </Typography>

      <Box sx={{ borderRadius: 1.5, p: 1, mb: 1.5, background: alpha("#fff", 0.04), border: `1px solid ${alpha("#fff", 0.08)}` }}>
        <Typography sx={{ fontSize: 11, opacity: 0.6, lineHeight: 1.6 }}>{meta.target}</Typography>
      </Box>

      {/* 利用可能な選択肢（情報表示。実行はボトムバーのホバーから） */}
      {options && (
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", letterSpacing: 0.4, mb: 0.75 }}>
            {meta.optionsLabel}
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {options.map((opt) => (
              <Chip
                key={opt.key}
                label={opt.label}
                size="small"
                sx={{
                  height: 24, fontSize: 11.5, fontWeight: 700, borderRadius: 1,
                  background: alpha(accent, 0.12),
                  border: `1px solid ${alpha(accent, 0.35)}`,
                  color: "color-mix(in srgb, var(--brand-fg) 90%, transparent)",
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* 自動ラベル: 役割で面を選択 ＋ 建物の高さ（階高/CH/GL/各階FL）設定 */}
      {kind === "autoLabel" && <RoleSelectChips />}
      {kind === "autoLabel" && <BuildingSpecFields accent={accent} />}

      <Divider sx={{ borderColor: alpha("#fff", 0.08), my: 1.25 }} />

      {/* 最後の実行結果 */}
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 45%, transparent)", letterSpacing: 0.4, mb: 0.75 }}>
        最後の実行結果
      </Typography>
      {lastResult ? (
        <Box sx={{ borderRadius: 1.5, p: 1, background: `color-mix(in srgb, ${resultColor} 10%, transparent)`, border: `1px solid ${`color-mix(in srgb, ${resultColor} 40%, transparent)`}` }}>
          <Typography sx={{ fontSize: 12, color: "color-mix(in srgb, var(--brand-fg) 92%, transparent)", lineHeight: 1.6 }}>{lastResult.msg}</Typography>
          <Typography sx={{ fontSize: 10, opacity: 0.45, mt: 0.5 }}>{relTime(lastResult.at)}</Typography>
        </Box>
      ) : (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ opacity: 0.5, py: 0.5 }}>
          <TouchAppRoundedIcon sx={{ fontSize: 15 }} />
          <Typography sx={{ fontSize: 11.5 }}>
            下のギャラリーで ← → 移動 ・ Space で選択 ・ Enter で実行してください
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

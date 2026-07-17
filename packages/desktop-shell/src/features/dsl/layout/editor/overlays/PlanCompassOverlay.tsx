// PlanCompassOverlay — 平面図(Top)の左下に表示する方位記号（コンパス）。
//   固定ベゼル方式: N/E/S/W のラベルとリングは常に固定（N=上/E=右/S=下/W=左）。
//   指針（針）のみビューの 90° 回転（layoutCameraRotationIndex）に追従して回り、
//   画面上の真北を指す（＝固定ラベルを目盛りとして現在の方位が読める）。
//   既定の平面ビューは「画面上=−Z=北」（EditorAngleBar の立面 北/東/南/西と同じ約束）。
import React, { useRef } from "react";
import { Box } from "@mui/material";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useViewportUiStore, VIEWPORT_IDS } from "../../store/viewportUiStore";

interface PlanCompassOverlayProps {
  /** ボトムパネル分の押し上げ量(px)。LayoutShell の viewportBottomInset を渡す。 */
  bottomInset?: number;
}

const INK = "#1e293b";

const PlanCompassOverlay: React.FC<PlanCompassOverlayProps> = ({ bottomInset = 0 }) => {
  const activeViewportId = useViewportUiStore((s) => s.activeViewportId);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const rotIndex = useEditorModeStore((s) => s.layoutCameraRotationIndex) || 0;

  // 連続角。rotIndex は 0↔3 で折り返すため、そのまま deg にすると 3→0 で 270° 逆回転して
  // しまう。index の最短差分（±1）だけを積算して、常に 90° ずつ最短方向へ回す。
  const contDegRef = useRef(rotIndex * -90);
  const prevIdxRef = useRef(rotIndex);
  if (prevIdxRef.current !== rotIndex) {
    let d = rotIndex - prevIdxRef.current;
    if (d > 2) d -= 4;
    if (d < -2) d += 4;
    contDegRef.current += d * -90;
    prevIdxRef.current = rotIndex;
  }
  // カメラ up の 90° 回転（rotIndex=1 で 東が画面上 → 北は画面左 = −90°）に追従。
  const deg = contDegRef.current;

  // 平面（Top）ビューのみ。マップ/ウォークスルーでは出さない。
  if (activeViewportId !== VIEWPORT_IDS.TOP) return null;
  if (editorMode === "map" || editorMode === "walkthrough") return null;

  return (
    <Box
      sx={{
        position: "absolute",
        left: 20,
        bottom: `${60 + bottomInset}px`,
        zIndex: 12,
        pointerEvents: "none",
        userSelect: "none",
        opacity: 0.85,
        transition: "bottom 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* overflow:visible で外周の方位文字（N/E/S/W）が枠で切れないようにする。 */}
      <svg width={58} height={58} viewBox="0 0 58 58" style={{ display: "block", overflow: "visible" }}>
        {/* ── 固定ベゼル: リング・目盛・N/E/S/W ラベルは常に固定（回転しない）── */}
        <circle cx="29" cy="29" r="16" fill="rgba(255,255,255,0.6)" stroke="rgba(30,41,59,0.55)" strokeWidth="1" />
        <path d="M29 13 V10 M45 29 H48 M29 45 V48 M13 29 H10" stroke="rgba(30,41,59,0.5)" strokeWidth="1" />
        {[
          { t: "N", x: 29, y: 4, main: true },
          { t: "E", x: 54, y: 29 },
          { t: "S", x: 29, y: 54 },
          { t: "W", x: 4, y: 29 },
        ].map(({ t, x, y: ly, main }) => (
          <text
            key={t}
            x={x} y={ly}
            textAnchor="middle" dominantBaseline="central"
            fontSize={main ? 9.5 : 8}
            fontWeight={main ? 700 : 600}
            letterSpacing="0.4"
            fontFamily="'Inter','Helvetica Neue',Arial,sans-serif"
            fill={main ? INK : "rgba(30,41,59,0.7)"}
          >
            {t}
          </text>
        ))}

        {/* ── 指針のみ回転して画面上の真北を指す（北=塗り / 南=白抜き）──
              SVG の transform 属性ではなく CSS transform を使い、transform-box:view-box ＋
              transform-origin をコンパス中心(29,29)に固定する。属性側に transition を
              かけると回転中心がずれる（原点まわりに振れる）ため。 */}
        <g
          style={{
            transform: `rotate(${deg}deg)`,
            transformBox: "view-box",
            transformOrigin: "29px 29px",
            transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <path d="M29 16 L26.2 29 L31.8 29 Z" fill={INK} />
          <path d="M29 42 L26.2 29 L31.8 29 Z" fill="none" stroke={INK} strokeWidth="1" />
        </g>
        <circle cx="29" cy="29" r="1.2" fill={INK} />
      </svg>
    </Box>
  );
};

export default PlanCompassOverlay;

// AutoActionGalleryBar.jsx
// ★メニューで gallery 系の自動アクション（マテリアル/家具/ライティング/ラベル）を
// クリックすると、画面下部に出るスタイル選択ギャラリー。selectedAuto 駆動で表示し続ける。
// 操作（Walkthrough の家具スワップと同じ感覚）：
//   - ← / → で前後のスタイルを選択（選択中はふわっと拡大＋中央へスクロール）
//   - Enter / Space で実行
//   - カードクリックでも実行
import React, { useEffect, useRef, useState } from "react";
import { useAutoActionStore } from "../../store/useAutoActionStore";
import { useAutoLayoutStore } from "../../store/useAutoLayoutStore";
import { useLayoutTaskStore } from "../../store/useLayoutTaskStore";
import { useAutoActions, AUTO_ACTION_OPTIONS } from "./useAutoActions";
import { runAiPipeline } from "../../services/aiOrchestrator";

const GALLERY_KINDS = ["autoAI", "autoZone", "autoSelect", "autoLayout", "autoReplace", "autoMaterial", "autoFurMat", "autoLighting", "autoLabel"];

const META = {
  autoAI:       { label: "AI実行（おまかせ）", color: "#c084fc" },
  autoZone:     { label: "自動ゾーニング",     color: "#2dd4bf" },
  autoSelect:   { label: "自動家具選定",       color: "#38bdf8" },
  autoLayout:   { label: "自動レイアウト",     color: "#c084fc" },
  autoReplace:  { label: "自動家具差し替え",   color: "#fb923c" },
  autoMaterial: { label: "自動マテリアル",     color: "#34d399" },
  autoFurMat:   { label: "自動家具マテリアル", color: "#a78bfa" },
  autoLighting: { label: "自動ライティング",   color: "#fbbf24" },
  autoLabel:    { label: "自動ラベル",         color: "#22d3ee" },
};

// 自動レイアウトの「スタイル」= 建物タイプ別のゾーン用途プリセット（AutoLayoutSidePanel と同じ）。
// 選ぶと zonePurpose を設定して Auto Layout を実行する。
const LAYOUT_PURPOSE_OPTIONS = {
  residential: [
    { value: "general", label: "汎用" },
    { value: "living",  label: "リビング" },
    { value: "bedroom", label: "寝室" },
    { value: "study",   label: "書斎" },
  ],
  office: [
    { value: "general", label: "汎用" },
    { value: "desk",    label: "執務室" },
    { value: "meeting", label: "会議室" },
  ],
  cafe:   [{ value: "general", label: "汎用" }, { value: "seating", label: "客席" }],
  hotel:  [{ value: "general", label: "汎用" }],
  custom: [{ value: "general", label: "汎用" }],
};

// 選択された用途で Auto Layout を実行（zonePurpose を設定 → requestAutoLayout）。
function runAutoLayout(purposeValue) {
  const { setZonePurpose, requestAutoLayout } = useAutoLayoutStore.getState();
  setZonePurpose(purposeValue);
  const { zones, selectedZoneIds } = useLayoutTaskStore.getState();
  const ids = selectedZoneIds.length > 0
    ? selectedZoneIds
    : zones.length > 0 ? zones.map((z) => z.id) : ["__full_room__"];
  requestAutoLayout(ids);
}

let styleInjected = false;
function injectStyles() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.id = "auto-gal-style";
  el.textContent = `
@keyframes autoGalBar { 0% { opacity: 0; transform: translate(-50%, 16px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
@keyframes autoGalItem { 0% { opacity: 0; transform: translateY(14px) scale(0.8); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes autoGalPop { 0% { transform: scale(1); } 55% { transform: scale(1.22); } 100% { transform: scale(1.14); } }
.auto-gal-bar { animation: autoGalBar 0.28s cubic-bezier(0.22,1,0.36,1) both; }
.auto-gal-item { animation: autoGalItem 0.34s cubic-bezier(0.22,1,0.36,1) var(--d) both; }
.auto-gal-box { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s, border-color 0.2s, background 0.2s; }
.auto-gal-box.active { animation: autoGalPop 0.32s cubic-bezier(0.34,1.56,0.64,1); }
`;
  document.head.appendChild(el);
}

function alphaHex(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function buildItems(kind, runners, buildingType) {
  if (!kind) return [];
  if (kind === "autoAI") {
    // テイスト（内装の基調スタイル）を選んで AI おまかせを一括実行。
    const styles = AUTO_ACTION_OPTIONS.autoMaterial || [];
    const baseKey = styles[0]?.key;
    const opts = [{ key: baseKey, label: "おまかせ" }, ...styles];
    return opts.map((o, i) => ({ id: `${o.key}-${i}`, label: o.label, run: () => runAiPipeline(o.key, runners) }));
  }
  if (kind === "autoLayout") {
    const opts = LAYOUT_PURPOSE_OPTIONS[buildingType] || LAYOUT_PURPOSE_OPTIONS.residential;
    return opts.map((o) => ({ id: o.value, label: o.label, run: () => runAutoLayout(o.value) }));
  }
  if (kind === "autoLabel") {
    return [{ id: "run", label: "自動ラベルを実行", run: () => runners.runLabel() }];
  }
  if (kind === "autoZone") {
    return [{ id: "run", label: "自動ゾーニングを実行", run: () => runners.runZone() }];
  }
  const opts = AUTO_ACTION_OPTIONS[kind] || [];
  const run =
    kind === "autoSelect" ? runners.runSelect
    : kind === "autoMaterial" ? runners.runMaterial
    : kind === "autoFurMat" ? runners.runFurniture
    : kind === "autoReplace" ? runners.runReplace
    : runners.runLighting;
  return opts.map((o) => ({ id: o.key, label: o.label, run: () => run(o.key) }));
}

export default function AutoActionGalleryBar() {
  useEffect(() => { injectStyles(); }, []);

  const selectedAuto    = useAutoActionStore((s) => s.selectedAuto);
  const setSelectedAuto = useAutoActionStore((s) => s.setSelectedAuto);
  const setActiveSide   = useAutoActionStore((s) => s.setActiveSide);

  const kind = GALLERY_KINDS.includes(selectedAuto) ? selectedAuto : null;

  // 自動レイアウトのスタイル一覧は建物タイプに依存する
  const buildingType = useAutoLayoutStore((s) => s.buildingType);

  const runners = useAutoActions();
  const activeRef = useRef(null);

  const [index, setIndex] = useState(0);          // ← → でのカーソル位置（移動）
  const indexRef = useRef(0);
  indexRef.current = index;
  const [selectedIndex, setSelectedIndex] = useState(null); // Space/クリックで確定した選択
  const selIndexRef = useRef(null);
  selIndexRef.current = selectedIndex;

  // 種別が変わったらカーソル・選択をリセット
  useEffect(() => { setIndex(0); setSelectedIndex(null); }, [kind]);

  const items = buildItems(kind, runners, buildingType);
  const clampedIndex = Math.min(Math.max(0, index), Math.max(0, items.length - 1));

  // ← / → で選択移動、Enter / Space で実行。capture で他のキー操作より優先。
  useEffect(() => {
    if (!kind) return;
    const onKey = (e) => {
      // 入力中（テキスト欄等）はキー操作を奪わない
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      const list = buildItems(kind, runners, useAutoLayoutStore.getState().buildingType);
      if (!list.length) return;
      const cur = Math.min(Math.max(0, indexRef.current), list.length - 1);
      if (e.key === "ArrowRight") {
        e.preventDefault(); e.stopPropagation(); setIndex((cur + 1) % list.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault(); e.stopPropagation(); setIndex((cur - 1 + list.length) % list.length);
      } else if (e.key === " " || e.code === "Space") {
        // Space → 選択（カーソル位置を確定。実行はしない）
        e.preventDefault(); e.stopPropagation(); setSelectedIndex(cur);
      } else if (e.key === "Enter") {
        // Enter → 実行（選択があればそれ、無ければカーソル位置）
        e.preventDefault(); e.stopPropagation();
        const sel = selIndexRef.current;
        const i = (sel != null && sel < list.length) ? sel : cur;
        list[i]?.run?.();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [kind, runners]);

  // 選択中カードを中央へスクロール
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [clampedIndex, kind]);

  if (!kind) return null;
  const meta = META[kind];
  if (!meta || !items.length) return null;

  const handleClose = () => { setSelectedAuto(null); setActiveSide(null); };

  return (
    <div
      className="auto-gal-bar"
      data-auto-keep="1"
      style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 80,
        maxWidth: "92%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
        padding: "10px 16px", borderRadius: 16,
        background: "rgba(8,11,20,0.9)", border: `1px solid ${alphaHex(meta.color, 0.5)}`,
        boxShadow: "0 12px 34px rgba(0,0,0,0.55)", backdropFilter: "blur(10px)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, fontWeight: 800, color: alphaHex(meta.color, 1), letterSpacing: 0.5 }}>
        <span>{kind === "autoLabel" ? "自動ラベル" : kind === "autoZone" ? "自動ゾーニング" : kind === "autoSelect" ? "選定する範囲を選ぶ" : kind === "autoAI" ? "AI実行：テイストを選ぶ" : `${meta.label}のスタイルを選ぶ`}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
          {kind === "autoLabel" || kind === "autoZone" ? "Enter で実行" : "← → で移動 ・ Space で選択 ・ Enter で実行"}
        </span>
        <span
          onClick={handleClose}
          title="閉じる"
          style={{ marginLeft: 4, cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1, fontWeight: 700 }}
        >
          ✕
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", maxWidth: "100%", padding: "6px 4px 4px" }}>
        {items.map((it, i) => {
          const active = i === clampedIndex;       // ← → カーソル位置
          const isSelected = i === selectedIndex;  // Space/クリックで確定した選択
          const lit = active || isSelected;
          return (
            <div
              key={it.id || i}
              ref={active ? activeRef : null}
              className="auto-gal-item"
              style={{ "--d": `${i * 0.04}s`, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 84, flexShrink: 0, cursor: "pointer" }}
              onMouseEnter={() => setIndex(i)}
              onClick={(e) => { e.stopPropagation(); setIndex(i); setSelectedIndex(i); it.run?.(); }}
              title={it.label}
            >
              <div
                className={`auto-gal-box${active ? " active" : ""}`}
                style={{
                  position: "relative",
                  width: 72, height: 56, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: lit ? alphaHex(meta.color, 0.2) : "rgba(255,255,255,0.06)",
                  border: lit ? `2px solid ${meta.color}` : "1px solid rgba(255,255,255,0.18)",
                  boxShadow: active ? `0 6px 18px ${alphaHex(meta.color, 0.45)}, 0 0 0 3px ${alphaHex(meta.color, 0.3)}` : "none",
                  transform: active ? "scale(1.14)" : "scale(1)",
                  color: lit ? "#fff" : alphaHex(meta.color, 0.9),
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
                {isSelected && (
                  <div style={{
                    position: "absolute", top: 2, right: 2, width: 15, height: 15, borderRadius: "50%",
                    background: meta.color, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="#fff" /></svg>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: lit ? 800 : 600, color: lit ? "#fff" : "rgba(255,255,255,0.65)", maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

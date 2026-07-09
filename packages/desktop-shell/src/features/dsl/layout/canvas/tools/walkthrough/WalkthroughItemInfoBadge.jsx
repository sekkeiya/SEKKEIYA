// WalkthroughItemInfoBadge.jsx
//
// ウォークスルー中（一人称・三人称・フライ 共通）のアイテム操作 UI。
//
//  ・プレイヤーがアイテムに近づく（2m 以内 → hoverItemId）と、その頭上に
//    「情報アイコンボタン」と「アクションアイコンボタン」がふわっと出てくる。
//  ・情報アイコン → フローティングパネル（プレビュー＋設定情報）を表示。
//  ・アクションアイコン → 設定したアニメ（ギミック clip/hinge）を起動。
//    ※ 常時アニメ（展示ループ）はボタン不要で常に動く。
//
//  演出：
//   - 登場：下からスッと浮き上がり、軽いオーバーシュート（スタッガード）。
//   - 待機：ゆっくり上下に漂う（フロート）＋やわらかい発光の呼吸。
//   - 誘導：アイコンから波紋（パルスリング）が広がり「押したくなる」。
//   - ホバー：少し拡大＋発光強化。

import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useItemInfoRegistryStore } from "../../../store/itemInfoRegistryStore";
import { useGimmickRegistryStore } from "../../../store/gimmickRegistryStore";
import { useItemSwapRegistryStore } from "../../../store/itemSwapRegistryStore";
import { useItemMaterialRegistryStore } from "../../../store/itemMaterialRegistryStore";
import { useWalkthroughGalleryStore } from "../../../store/walkthroughGalleryStore";

const ACCENT = "#4f8cff";
const INFO = "#38bdf8";
const SWAP = "#7c4dff";
const MAT = "#ec407a";
const CATALOG = "#86efac";
const LINKS = "#38bdf8";

// ── キーフレーム（一度だけ注入） ──
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.id = "wt-item-buttons-style";
  el.textContent = `
@keyframes wtEnter {
  0%   { opacity: 0; transform: translateY(18px) scale(0.55); }
  60%  { opacity: 1; transform: translateY(-6px) scale(1.08); }
  80%  { transform: translateY(2px) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes wtFloat {
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-3.5px); }
}
@keyframes wtGlow {
  0%,100% { box-shadow: 0 5px 16px rgba(0,0,0,0.5), 0 0 0 0 var(--wt-glow); }
  50%     { box-shadow: 0 8px 22px rgba(0,0,0,0.55), 0 0 18px 3px var(--wt-glow); }
}
@keyframes wtRing {
  0%   { opacity: 0.55; transform: scale(0.55); }
  70%  { opacity: 0;    transform: scale(1.9); }
  100% { opacity: 0;    transform: scale(1.9); }
}
@keyframes wtIconNudge {
  0%,92%,100% { transform: scale(1); }
  96%         { transform: scale(1.18); }
}
.wt-enter {
  animation:
    wtEnter 0.6s cubic-bezier(0.22,1,0.36,1) var(--wt-d) both,
    wtFloat 3.1s ease-in-out calc(var(--wt-d) + 0.6s) infinite;
  will-change: transform, opacity;
}
.wt-btn {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 7px 13px 7px 10px;
  border-radius: 999px;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.22);
  font-size: 12px; font-weight: 800;
  font-family: system-ui, -apple-system, sans-serif;
  white-space: nowrap;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  transition: transform 0.16s cubic-bezier(0.34,1.56,0.64,1), filter 0.16s;
  animation: wtGlow 2.6s ease-in-out infinite;
}
.wt-btn:hover { transform: scale(1.1); filter: brightness(1.15); }
.wt-btn:active { transform: scale(0.95); }
.wt-ring {
  position: absolute; left: 7px; top: 50%;
  width: 26px; height: 26px; margin-top: -13px;
  border-radius: 50%;
  border: 2px solid var(--wt-glow);
  pointer-events: none;
  animation: wtRing 2.6s ease-out var(--wt-d) infinite;
}
.wt-ico { display: flex; animation: wtIconNudge 3.2s ease-in-out var(--wt-d) infinite; }
.wt-sub {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 11px; border-radius: 999px; color: #fff;
  border: 1px solid rgba(255,255,255,0.24);
  font-size: 11.5px; font-weight: 800;
  font-family: system-ui, -apple-system, sans-serif;
  white-space: nowrap; cursor: pointer; pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.45);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  transition: transform 0.14s cubic-bezier(0.34,1.56,0.64,1), filter 0.14s;
  will-change: transform, opacity;
}
.wt-sub:hover { transform: scale(1.09); filter: brightness(1.18); }
.wt-sub:active { transform: scale(0.96); }
.wt-subenter { animation: wtEnter 0.42s cubic-bezier(0.22,1,0.36,1) var(--wt-d) both; }
`;
  document.head.appendChild(el);
}

function topOf(id, u) {
  const obj = useSceneObjectRegistryStore.getState().getObject(id);
  if (!obj) return null;
  obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3());
  return [c.x, box.max.y + 0.12 * u, c.z];
}

function PlayGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M8 5.5v13l11-6.5z" fill="#fff" />
    </svg>
  );
}

function InfoGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7.5" r="1.5" fill="#fff" />
      <rect x="10.7" y="10.5" width="2.6" height="7.5" rx="1.3" fill="#fff" />
    </svg>
  );
}

function SwapGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 3 8l4 4" /><path d="M3 8h14" />
      <path d="M17 20l4-4-4-4" /><path d="M21 16H7" />
    </svg>
  );
}

function StoreGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 4.5 4h15L21 9" /><path d="M4 9v10h16V9" />
      <path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

function ImageSearchGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H5a2 2 0 0 0-2 2v12" /><path d="m5 17 4-4 3 3" />
      <circle cx="17" cy="14" r="3.5" /><path d="m22 19-2.2-2.2" />
    </svg>
  );
}

function MaterialGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" />
      <circle cx="8.5" cy="7.5" r="2.5" /><circle cx="6.5" cy="12.5" r="2.5" />
      <path d="M12 22a10 10 0 1 1 0-20" />
    </svg>
  );
}

const alphaHex = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// 親ボタン。ホバーで画面下部のギャラリーを開き、クリックで実行（ギミック起動/次のパターン/次の家具）。
function MenuGroup({ color, glyph, label, delay, itemId, category, onAction }) {
  const open = useWalkthroughGalleryStore((s) => s.open);
  const closeSoon = useWalkthroughGalleryStore((s) => s.closeSoon);
  return (
    <div
      className="wt-enter"
      style={{ "--wt-d": `${delay}s`, pointerEvents: "auto" }}
      onMouseEnter={() => category && open(itemId, category)}
      onMouseLeave={() => category && closeSoon()}
    >
      <div
        className="wt-btn"
        style={{ background: alphaHex(color, 0.95), "--wt-glow": alphaHex(color, 0.55) }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onAction?.(); }}
        title={label}
      >
        <span className="wt-ring" style={{ "--wt-d": `${delay}s` }} />
        <span className="wt-ico" style={{ "--wt-d": `${delay}s` }}>{glyph}</span>
        <span>{label}</span>
      </div>
    </div>
  );
}

function ItemButtons({ id, u }) {
  const [pos, setPos] = useState(null);

  useEffect(() => { injectStyles(); }, []);
  useEffect(() => { setPos(topOf(id, u)); }, [id, u]);

  // id を key にして、対象が変わるたびに登場アニメを再生させる
  const gimmickList = useGimmickRegistryStore.getState().getList(id);
  const infoEntry = useItemInfoRegistryStore.getState().get(id);
  const hasInfo = !!infoEntry;
  const hasMat = useItemMaterialRegistryStore.getState().has(id);
  const hasSwap = useItemSwapRegistryStore.getState().has(id);
  // 似た商品（カタログ登録＋カタログ視覚照合）。関連URL／画像検索は別ボタンに分離。
  const hasCatalog = !!(infoEntry && (
    (Array.isArray(infoEntry.catalogLinks) && infoEntry.catalogLinks.length) || infoEntry.model
  ));
  // 画像で検索（関連URL＋逆画像検索）。
  const hasLinks = !!(infoEntry && (
    (Array.isArray(infoEntry.links) && infoEntry.links.length) || infoEntry.model
  ));
  if (!pos || (!gimmickList.length && !hasInfo && !hasMat && !hasSwap && !hasCatalog && !hasLinks)) return null;

  let idx = 0;
  return (
    <group position={pos}>
      <Html center style={{ pointerEvents: "none", userSelect: "none" }} zIndexRange={[40, 0]}>
        <div key={id} style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
          {gimmickList.length > 0 && (
            <MenuGroup color={ACCENT} glyph={<PlayGlyph />} label="動かす" delay={(idx++) * 0.09}
              itemId={id} category="action"
              onAction={() => useGimmickRegistryStore.getState().getList(id)[0]?.toggle?.()} />
          )}
          {hasMat && (
            <MenuGroup color={MAT} glyph={<MaterialGlyph />} label="マテリアルを変える" delay={(idx++) * 0.09}
              itemId={id} category="material"
              onAction={() => useItemMaterialRegistryStore.getState().get(id)?.cycle?.()} />
          )}
          {hasSwap && (
            <MenuGroup color={SWAP} glyph={<SwapGlyph />} label="家具を変える" delay={(idx++) * 0.09}
              itemId={id} category="swap"
              onAction={() => useItemSwapRegistryStore.getState().get(id)?.cycle?.()} />
          )}
          {hasCatalog && (
            <MenuGroup color={CATALOG} glyph={<StoreGlyph />} label="似た商品" delay={(idx++) * 0.09}
              itemId={id} category="catalog"
              onAction={() => useItemInfoRegistryStore.getState().openInfo(id, "similar")} />
          )}
          {hasLinks && (
            <MenuGroup color={LINKS} glyph={<ImageSearchGlyph />} label="画像で検索" delay={(idx++) * 0.09}
              itemId={id} category="links"
              onAction={() => useItemInfoRegistryStore.getState().openInfo(id, "links")} />
          )}
          {hasInfo && (
            <MenuGroup color={INFO} glyph={<InfoGlyph />} label="情報" delay={(idx++) * 0.09}
              itemId={id} category={null}
              onAction={() => {
                const store = useItemInfoRegistryStore.getState();
                store.openInfo(store.openInfoId === id && store.openTab === "info" ? null : id, "info");
              }} />
          )}
        </div>
      </Html>
    </group>
  );
}

export default function WalkthroughItemInfoBadge() {
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const u = sceneMaxY > 100 ? 1000 : 1;

  const hoverItemId = useGimmickRegistryStore((s) => s.hoverItemId);

  // 情報パネルを開いていても、動かす/マテリアルを変える/家具を変える/情報の
  // ボタン群は表示し続ける（情報を見ながらマテリアル変更などができるように）。
  if (!hoverItemId) return null;
  // key で対象アイテムが変わるたびに ItemButtons を作り直し、登場アニメを再生
  return <ItemButtons key={hoverItemId} id={hoverItemId} u={u} />;
}

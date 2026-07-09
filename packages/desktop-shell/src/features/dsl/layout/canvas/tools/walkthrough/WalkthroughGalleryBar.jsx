// WalkthroughGalleryBar.jsx
//
// ウォークスルーで親ボタン（動かす/マテリアル/家具）にホバーしたとき、画面下部に
// その種類の一覧を「ギャラリー」として表示する。現在選択中が一目で分かり、直接選べる。
// 親ボタン・このバーの双方の hover で開閉を維持（walkthroughGalleryStore）。
//
// 操作：
//   - サムネをクリックで選択。
//   - ギャラリー表示中は ← / → キーで前後の項目に切り替え（家具・マテリアル）。
//     選択中サムネはふわっと拡大し、自動で中央へスクロールして「今どれか」が分かる。

import { useEffect, useRef } from "react";
import { useGimmickRegistryStore } from "../../../store/gimmickRegistryStore";
import { useItemMaterialRegistryStore } from "../../../store/itemMaterialRegistryStore";
import { useItemSwapRegistryStore } from "../../../store/itemSwapRegistryStore";
import { useItemInfoRegistryStore } from "../../../store/itemInfoRegistryStore";
import { useWalkthroughGalleryStore } from "../../../store/walkthroughGalleryStore";
import { useWalkthroughCatalogStore } from "../../../store/walkthroughCatalogStore";
import { useAuthStore } from "../../../../../../store/useAuthStore";
import { openExternalUrl, runProductSearch } from "../../../../../dss/utils/productImageSearch";

const CAT_META = {
  action: { label: "動き", color: "#4f8cff" },
  material: { label: "マテリアル", color: "#ec407a" },
  swap: { label: "家具", color: "#7c4dff" },
  catalog: { label: "似た商品", color: "#86efac", title: "似た商品（カタログ登録）" },
  links: { label: "リンク", color: "#38bdf8", title: "関連リンク・画像検索" },
};

function hostOf(u) {
  try { return new URL(/^https?:\/\//.test(u) ? u : "https://" + u).host; } catch { return ""; }
}

// 商品画像が無いリンクのサムネ代替＝サイトのファビコン。
function faviconOf(u) {
  const h = hostOf(u);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=128` : null;
}

let styleInjected = false;
function injectStyles() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.id = "wt-gallery-style";
  el.textContent = `
@keyframes wtGalBar { 0% { opacity: 0; transform: translate(-50%, 16px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
@keyframes wtGalItem { 0% { opacity: 0; transform: translateY(14px) scale(0.8); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes wtGalPop { 0% { transform: scale(1); } 55% { transform: scale(1.26); } 100% { transform: scale(1.18); } }
.wt-gal-bar { animation: wtGalBar 0.28s cubic-bezier(0.22,1,0.36,1) both; }
.wt-gal-item { animation: wtGalItem 0.34s cubic-bezier(0.22,1,0.36,1) var(--d) both; }
.wt-gal-box { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s, border-color 0.2s; }
.wt-gal-box.active { animation: wtGalPop 0.32s cubic-bezier(0.34,1.56,0.64,1); }
@keyframes wtLoadBar { 0% { left: -45%; } 100% { left: 100%; } }
.wt-load { position: relative; width: 72%; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.16); overflow: hidden; }
.wt-load-bar { position: absolute; top: 0; height: 100%; width: 45%; border-radius: 2px; background: #86efac; animation: wtLoadBar 1.05s ease-in-out infinite; }
`;
  document.head.appendChild(el);
}

function alphaHex(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// パネルの itemId/category から表示項目を組み立てる（描画・キー操作 共通）
function buildItems(panel) {
  if (!panel) return [];
  const { itemId, category } = panel;
  if (category === "action") {
    return useGimmickRegistryStore.getState().getList(itemId).map((g) => ({
      id: g.gimmickId, label: g.label || "操作", active: !!g.isOpen?.(), onClick: () => g.toggle?.(),
    }));
  }
  if (category === "material") {
    const entry = useItemMaterialRegistryStore.getState().get(itemId);
    return (entry?.options || []).map((o) => ({
      id: o.id, label: o.label, swatchColor: o.swatchColor, thumbUrl: o.thumbUrl, active: entry?.currentId === o.id, onClick: () => o.apply?.(),
    }));
  }
  if (category === "swap") {
    const entry = useItemSwapRegistryStore.getState().get(itemId);
    return (entry?.options || []).map((o) => ({
      id: o.id, label: o.label, thumbUrl: o.thumbUrl, active: entry?.currentId === o.id, onClick: () => o.apply?.(),
    }));
  }
  if (category === "catalog") {
    // 一番左に「カタログで探す」（S.Library 視覚照合）＋ 登録済みカタログ似た家具（サムネ＋価格）。
    const e = useItemInfoRegistryStore.getState().get(itemId);
    if (!e) return [];
    const out = [];
    if (e.model) {
      out.push({
        id: "catalogSearch", kind: "catalogSearch", label: "カタログで探す", sub: "S.Library 照合",
        onClick: () => {
          useItemInfoRegistryStore.getState().openInfo(itemId, "similar");
          useWalkthroughCatalogStore.getState().run(itemId, e.model);
        },
      });
    }
    const { thumbMap, thumbsLoaded } = useWalkthroughCatalogStore.getState();
    (Array.isArray(e.catalogLinks) ? e.catalogLinks : []).filter((l) => l && l.url).forEach((l, i) => {
      const realThumb = l.thumbnail || thumbMap[l.url] || null; // S.Library 索引から補完
      // 補完待ち（索引読込中）はローディング表示。読込後に実サムネ→ファビコンの順。
      const loading = !realThumb && !thumbsLoaded;
      out.push({ id: `cat${i}`, kind: "catalog", label: l.title || "カタログ商品", sub: l.price || "", thumbUrl: loading ? null : (realThumb || faviconOf(l.url)), thumbContain: !realThumb, loading, onClick: () => openExternalUrl(l.url) });
    });
    return out;
  }
  if (category === "links") {
    // 一番左に「画像で探す」（逆画像検索）＋ 関連URL（ファビコンをサムネ表示）。
    const e = useItemInfoRegistryStore.getState().get(itemId);
    if (!e) return [];
    const out = [];
    if (e.model) {
      const uid = useAuthStore.getState().currentUser?.uid || null;
      out.push({ id: "imgsearch", kind: "search", label: "画像で探す", sub: "Google Lens", onClick: () => runProductSearch("lens", e.model, uid).catch((err) => console.warn("[walkthrough] image search failed", err)) });
    }
    (Array.isArray(e.links) ? e.links : []).filter((l) => l && l.url).forEach((l, i) => {
      out.push({ id: `rel${i}`, kind: "link", label: l.title || hostOf(l.url), sub: hostOf(l.url), thumbUrl: l.thumbnail || faviconOf(l.url), thumbContain: !l.thumbnail, onClick: () => openExternalUrl(l.url) });
    });
    return out;
  }
  return [];
}

export default function WalkthroughGalleryBar() {
  useEffect(() => { injectStyles(); }, []);
  const panel = useWalkthroughGalleryStore((s) => s.panel);
  const tick = useWalkthroughGalleryStore((s) => s.tick); // 選択変更で再描画
  const keepOpen = useWalkthroughGalleryStore((s) => s.keepOpen);
  const closeSoon = useWalkthroughGalleryStore((s) => s.closeSoon);
  const catThumbMap = useWalkthroughCatalogStore((s) => s.thumbMap); // 補完サムネ反映で再描画
  const catThumbsLoaded = useWalkthroughCatalogStore((s) => s.thumbsLoaded); // 読込完了で再描画
  const loadCatThumbs = useWalkthroughCatalogStore((s) => s.loadThumbs);
  const activeRef = useRef(null);

  // カタログ表示時に S.Library 索引からサムネ補完マップを読み込む（S.Models と同じ画像）。
  useEffect(() => {
    if (panel?.category === "catalog") loadCatThumbs();
  }, [panel, loadCatThumbs]);

  // ← / → で前後に切り替え（家具・マテリアルのみ）。プレイヤー移動より優先（capture + stopPropagation）。
  useEffect(() => {
    if (!panel) return;
    const cat = panel.category;
    if (cat !== "swap" && cat !== "material") return;
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const items = buildItems(panel);
      if (items.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      const cur = Math.max(0, items.findIndex((it) => it.active));
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = (cur + dir + items.length) % items.length;
      items[next].onClick?.();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [panel, tick]);

  // 選択中サムネを中央へスクロールして見せる
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [tick, panel]);

  if (!panel) return null;
  const meta = CAT_META[panel.category];
  if (!meta) return null;
  const items = buildItems(panel);
  if (!items.length) return null;

  return (
    <div
      className="wt-gal-bar"
      onMouseEnter={keepOpen}
      onMouseLeave={closeSoon}
      style={{
        position: "absolute", bottom: 56, left: "50%", transform: "translateX(-50%)", zIndex: 33,
        maxWidth: "92%", display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
        padding: "10px 14px", borderRadius: 14,
        background: "rgba(8,11,20,0.86)", border: `1px solid ${alphaHex(meta.color, 0.5)}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 800, color: alphaHex(meta.color, 1), letterSpacing: 0.5 }}>
        <span>{meta.title || `${meta.label}を選ぶ`}</span>
        {(panel.category === "swap" || panel.category === "material") && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>← → で切替</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", maxWidth: "100%", padding: "6px 4px 8px" }}>
        {items.map((it, i) => (
          <div
            key={it.id || i}
            ref={it.active ? activeRef : null}
            className="wt-gal-item"
            style={{ "--d": `${i * 0.04}s`, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 76, flexShrink: 0, cursor: "pointer" }}
            onClick={(e) => { e.stopPropagation(); it.onClick?.(); }}
            title={it.label}
          >
            <div
              className={`wt-gal-box${it.active ? " active" : ""}`}
              style={{
                width: 64, height: 64, borderRadius: 10, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.06)",
                border: it.active ? `2px solid ${meta.color}` : "1px solid rgba(255,255,255,0.18)",
                boxShadow: it.active ? `0 6px 18px ${alphaHex(meta.color, 0.45)}, 0 0 0 3px ${alphaHex(meta.color, 0.35)}` : "none",
                transform: it.active ? "scale(1.18)" : "scale(1)",
              }}
            >
              {it.loading
                // 補完サムネ読込中はローディングバー。
                ? <div className="wt-load"><div className="wt-load-bar" /></div>
                : it.thumbUrl
                // 商品画像は枠いっぱいにズーム表示。ファビコン代替（thumbContain）は中央に余白付きで表示。
                ? <img src={it.thumbUrl} alt="" referrerPolicy="no-referrer"
                    style={it.thumbContain
                      ? { width: "70%", height: "70%", objectFit: "contain" }
                      : { width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.45)" }} />
                : panel.category === "material" && it.swatchColor
                  ? <div style={{
                      width: 46, height: 46, borderRadius: "50%",
                      background: `radial-gradient(circle at 32% 28%, #ffffffcc 0%, ${it.swatchColor} 42%, ${it.swatchColor} 70%, rgba(0,0,0,0.45) 100%)`,
                      boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.35)",
                    }} />
                : panel.category === "action"
                  ? <svg width="22" height="22" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="#fff" /></svg>
                : it.kind === "search"
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                : it.kind === "catalogSearch"
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 4.5 4h15L21 9" /><path d="M4 9v6h8" /><circle cx="17" cy="16" r="3" /><path d="m21 20-1.8-1.8" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7" /><path d="M9 7h8v8" /></svg>}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: it.active ? 800 : 600, color: it.active ? "#fff" : "rgba(255,255,255,0.65)", maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {it.label}
            </div>
            {it.sub && (
              <div style={{ fontSize: 9.5, fontWeight: 700, color: it.kind === "catalog" ? meta.color : "rgba(255,255,255,0.45)", maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// useHeightSetupStore — 「断面で高さを設定」モードの ON/OFF と断面軸。
// ON のとき横から見たエレベーション（X断面=側面/Right, Z断面=正面/Front）へ切替え、
// その軸の断面クリップを有効化して建物を切り、GL/各階FL のレベル線オーバーレイ
// (LevelLinesOverlay) を表示して高さを見ながら設定する。
// ミニマップ(SectionMiniMap)で断面位置(sectionClipX/Z)を平面的にドラッグできる。
import { create } from "zustand";
import { useEditorModeStore } from "./useEditorModeStore";
import { useViewportUiStore, VIEWPORT_LAYOUT } from "./viewportUiStore";

export type SectionAxis = "x" | "z";

interface ClipSnapshot {
  en: boolean; y: boolean; x: boolean; z: boolean;
}

interface HeightSetupStore {
  active: boolean;
  axis: SectionAxis;
  _snap: ClipSnapshot | null;
  enter: () => void;
  exit: () => void;
  setAxis: (a: SectionAxis) => void;
}

const viewForAxis = (a: SectionAxis) => (a === "x" ? "vp_right" : "vp_front");

function applyAxisClip(a: SectionAxis) {
  const em = useEditorModeStore.getState();
  em.setSectionClipXEnabled(a === "x");
  em.setSectionClipZEnabled(a === "z");
  const vp = useViewportUiStore.getState();
  vp.setLayoutMode?.(VIEWPORT_LAYOUT.SINGLE);
  vp.setActiveViewportId?.(viewForAxis(a));
  setTimeout(() => vp.requestFrameAll?.(), 140);
}

export const useHeightSetupStore = create<HeightSetupStore>((set, get) => ({
  active: false,
  axis: "x",
  _snap: null,

  enter: () => {
    const em = useEditorModeStore.getState();
    const snap: ClipSnapshot = {
      en: em.isSectionClipEnabled,
      y: em.sectionClipYEnabled,
      x: em.sectionClipXEnabled,
      z: em.sectionClipZEnabled,
    };
    set({ active: true, _snap: snap });
    // 断面（縦切り）を見せたいので高さ(Y)断面は切り、軸断面を有効化。
    em.setIsSectionClipEnabled(true);
    em.setSectionClipYEnabled(false);
    // 断面位置を建物中央(0)にして、入った瞬間から確実に切れた状態にする。
    em.setSectionClipX(0);
    em.setSectionClipZ(0);
    applyAxisClip(get().axis);
  },

  exit: () => {
    const em = useEditorModeStore.getState();
    const s = get()._snap;
    if (s) {
      em.setIsSectionClipEnabled(s.en);
      em.setSectionClipYEnabled(s.y);
      em.setSectionClipXEnabled(s.x);
      em.setSectionClipZEnabled(s.z);
    }
    set({ active: false, _snap: null });
    const vp = useViewportUiStore.getState();
    vp.setActiveViewportId?.("vp_persp");
    setTimeout(() => vp.requestFrameAll?.(), 140);
  },

  setAxis: (axis) => {
    set({ axis });
    if (get().active) applyAxisClip(axis);
  },
}));

import { create } from "zustand";

export interface RightPanels {
  projectHierarchy: boolean;
  scene: boolean;
  properties: boolean;
  library: boolean;
  history: boolean;
  autoLayout: boolean;
  characters: boolean;
  map: boolean;
  /** 下絵（PDF/画像を床下に敷いてトレース）。Base 選択中のみ開ける。 */
  underlay: boolean;
  viewportSettings: boolean;
  /** S.Layout 埋め込み AI チャット（選択中の Base/Plan/Option にスコープ固定）。 */
  chat: boolean;
}

export const DEFAULT_RIGHT_PANELS: RightPanels = {
  // ✅ 右ドックは Scene＋Properties を常設既定に（モックの「調べる=右」）。
  //    選択物の情報が常に見えるようにする。ユーザーは右レールで個別に開閉可。
  projectHierarchy: false,
  scene: true,
  properties: true,
  library: false,
  history: false,
  autoLayout: false,
  characters: false,
  map: false,
  underlay: false,
  viewportSettings: false,
  chat: false,
};

function calcVisibleSections(rightPanels: RightPanels): string[] {
  const arr: string[] = [];
  // Project 階層（Base/Plan/Option ツリー）は右サイドバーの最上部に表示する。
  if (rightPanels?.projectHierarchy) arr.push("projectHierarchy");
  if (rightPanels?.scene) arr.push("scene");
  if (rightPanels?.properties) arr.push("properties");
  if (rightPanels?.library) arr.push("library");
  if (rightPanels?.history) arr.push("history");
  if (rightPanels?.autoLayout) arr.push("autoLayout");
  if (rightPanels?.characters) arr.push("characters");
  if (rightPanels?.map) arr.push("map");
  if (rightPanels?.underlay) arr.push("underlay");
  if (rightPanels?.viewportSettings) arr.push("viewportSettings");
  if (rightPanels?.chat) arr.push("chat");
  return arr;
}

export interface UiRightSidebarState {
  rightPanels: RightPanels;
  visibleSections: string[];
  portalElement: HTMLElement | null;
  setPortalElement: (el: HTMLElement | null) => void;
  setRightPanel: (key: keyof RightPanels, value: boolean) => void;
  toggleRightPanel: (key: keyof RightPanels) => void;
  // 右ドックのボタン用：一度に1枚だけ開く（他は閉じる）排他トグル。
  // 既に「そのパネルのみ」開いていれば閉じる。将来 2 枚同時に開きたくなったら
  // toggleRightPanel（複数可）へ差し替えるだけでよい。
  toggleRightPanelExclusive: (key: keyof RightPanels) => void;
  setRightPanels: (next: Partial<RightPanels>) => void;
  resetRightPanels: () => void;
  closeAll: () => void;
}

export const useUiRightSidebarStore = create<UiRightSidebarState>((set) => ({
  rightPanels: DEFAULT_RIGHT_PANELS,
  visibleSections: calcVisibleSections(DEFAULT_RIGHT_PANELS),
  portalElement: null,
  setPortalElement: (el) => set({ portalElement: el }),

  setRightPanel: (key, value) =>
    set((s) => {
      const boolValue = Boolean(value);
      if (s.rightPanels[key] === boolValue) return s; // skip update if unchanged
      
      const nextPanels = { ...s.rightPanels, [key]: boolValue };
      return {
        rightPanels: nextPanels,
        visibleSections: calcVisibleSections(nextPanels),
      };
    }),

  toggleRightPanel: (key) =>
    set((s) => {
      const nextPanels = { ...s.rightPanels, [key]: !s.rightPanels[key] };
      return {
        rightPanels: nextPanels,
        visibleSections: calcVisibleSections(nextPanels),
      };
    }),

  toggleRightPanelExclusive: (key) =>
    set((s) => {
      // 既に「そのパネルだけ」開いている → 閉じる（全 OFF）。それ以外 → そのパネルのみ ON。
      const isOnlyThis = s.rightPanels[key] && s.visibleSections.length === 1;
      const cleared = Object.fromEntries(
        Object.keys(s.rightPanels).map((k) => [k, false]),
      ) as RightPanels;
      const nextPanels: RightPanels = isOnlyThis ? cleared : { ...cleared, [key]: true };
      return {
        rightPanels: nextPanels,
        visibleSections: calcVisibleSections(nextPanels),
      };
    }),

  setRightPanels: (next) =>
    set((s) => {
      if (!next) return s;
      const nextPanels = { ...DEFAULT_RIGHT_PANELS, ...next };
      
      // Check if anything actually changed
      const hasChanges = Object.keys(nextPanels).some(
        (k) => nextPanels[k as keyof RightPanels] !== s.rightPanels[k as keyof RightPanels]
      );
      if (!hasChanges) return s;

      return {
        rightPanels: nextPanels,
        visibleSections: calcVisibleSections(nextPanels),
      };
    }),

  resetRightPanels: () =>
    set(() => ({
      rightPanels: DEFAULT_RIGHT_PANELS,
      visibleSections: calcVisibleSections(DEFAULT_RIGHT_PANELS),
    })),

  closeAll: () =>
    set(() => {
      const nextPanels = {
        projectHierarchy: false,
        scene: false,
        properties: false,
        library: false,
        history: false,
        autoLayout: false,
        characters: false,
        map: false,
        underlay: false,
        viewportSettings: false,
        chat: false,
      };
      return {
        rightPanels: nextPanels,
        visibleSections: [],
      };
    })
}));

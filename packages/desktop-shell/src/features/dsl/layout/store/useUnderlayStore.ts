// useUnderlayStore — S.Layout「下絵」。PDF/画像を床下の平面に敷いてトレースする。
//   保存先は Base または Plan の spaceProgram.underlay。
//   「継承＋上書き」: 表示される下絵は Plan のもの → 無ければ Base のもの、という優先順で
//   LayoutShell が解決して hydrate する（Option は親 Plan のものを引き継ぐ）。
//   owner はその解決結果がどちらの階層のものかを示し、編集の保存先を決める。
//   永続化は LayoutShell が "LayoutShell:UpdateUnderlay" イベントを受けて updateDoc する。
//   画像本体は Storage 済みで、このストアは URL と数値だけを持つ（dataURL は保存しない）。
import { create } from "zustand";

/** 作図モード：none=なし / line=基準線（縮尺合わせ） */
export type UnderlayDrawMode = "none" | "line";

/** 下絵がどの階層のドキュメントに載っているか＝編集の保存先。 */
export type UnderlayOwner = "base" | "plan";

/** Firestore（{Base|Plan}.spaceProgram.underlay）に保存する形。 */
export interface UnderlayDoc {
  /** Storage の downloadURL。null なら下絵なし。 */
  imageUrl: string | null;
  /** Storage 上のパス（差し替え/削除時に元ファイルを消すため）。 */
  storagePath: string | null;
  /** 取り込み元のファイル名（UI 表示用）。 */
  sourceName: string;
  visible: boolean;
  /** 画像の実寸の幅（mm）。高さは widthMm / aspect。基準線で校正する。 */
  widthMm: number;
  /** 画像の縦横比（width / height）。 */
  aspect: number;
  /** 高さ（mm）。床(0)とのZファイト回避で既定は微小に下げる。 */
  yMm: number;
  offsetXMm: number;
  offsetZMm: number;
  /** Y軸まわりの回転（度）。 */
  rotationDeg: number;
  opacity: number;
}

/** 未校正の初期幅（10m）。実寸は基準線で合わせる前提のあたり値。 */
export const UNDERLAY_DEFAULT_WIDTH_MM = 10000;

const DEFAULTS: UnderlayDoc = {
  imageUrl: null,
  storagePath: null,
  sourceName: "",
  visible: true,
  widthMm: UNDERLAY_DEFAULT_WIDTH_MM,
  aspect: 1,
  // マップ地面(-2)より更に下。両方出しても互いにZファイトしないように分ける。
  yMm: -3,
  offsetXMm: 0,
  offsetZMm: 0,
  rotationDeg: 0,
  // トレース用途なので既定は半透明（下絵の上に家具を置いて見比べる）。
  opacity: 0.6,
};

export interface UnderlayState extends UnderlayDoc {
  /**
   * 今表示している下絵がどの階層のものか。編集はこの階層のドキュメントへ保存する。
   * Plan を見ていても owner==="base" なら、それは Base から継承した下絵であり、
   * 調整すると全 Plan に効く（壁・床と同じ挙動）。null は下絵なし。
   */
  owner: UnderlayOwner | null;
  /**
   * owner のドキュメント id（Base か Plan の layouts doc id）。
   * 保存先をイベントに載せるために持つ：遅延保存が飛ぶ頃には選択が変わっているかもしれず、
   * 「今の選択」から保存先を解決すると別ノードへ書いてしまうため。
   */
  ownerNodeId: string | null;

  /** 作図状態（セッション内のみ。永続化しない）。 */
  drawMode: UnderlayDrawMode;
  /** 基準線の端点（ワールド mm の [x,z]、最大2点）。 */
  linePoints: Array<[number, number]>;

  /** 解決済みの下絵を流し込む（永続化イベントは発火しない。作図状態には触らない）。 */
  hydrate: (
    doc: Partial<UnderlayDoc> | null | undefined,
    owner: UnderlayOwner | null,
    ownerNodeId: string | null
  ) => void;
  /** ノードを切り替えたときにセッション限りの状態（作図中の基準線）を捨てる。 */
  resetSession: () => void;
  /** 取り込み結果を反映（位置・回転・縮尺はリセット）。owner は取り込んだ階層。 */
  setImported: (p: {
    imageUrl: string;
    storagePath: string;
    sourceName: string;
    aspect: number;
    widthMm?: number;
    owner: UnderlayOwner;
    ownerNodeId: string;
  }) => void;

  setVisible: (v: boolean) => void;
  setWidthMm: (v: number) => void;
  setYMm: (v: number) => void;
  setOffset: (x: number, z: number) => void;
  setRotationDeg: (v: number) => void;
  setOpacity: (v: number) => void;

  setDrawMode: (m: UnderlayDrawMode) => void;
  addLinePoint: (x: number, z: number) => void;
  clearLine: () => void;

  /** 下絵を外す。 */
  clear: () => void;
}

function toDoc(s: UnderlayState): UnderlayDoc {
  return {
    imageUrl: s.imageUrl,
    storagePath: s.storagePath,
    sourceName: s.sourceName,
    visible: s.visible,
    widthMm: s.widthMm,
    aspect: s.aspect,
    yMm: s.yMm,
    offsetXMm: s.offsetXMm,
    offsetZMm: s.offsetZMm,
    rotationDeg: s.rotationDeg,
    opacity: s.opacity,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pending: UnderlayState | null = null;

function dispatchPersist(s: UnderlayState) {
  // owner / ownerNodeId が無い＝保存先が決まらないので書かない（hydrate 直後の空状態など）。
  if (!s.owner || !s.ownerNodeId) return;
  try {
    window.dispatchEvent(
      new CustomEvent("LayoutShell:UpdateUnderlay", {
        detail: {
          underlay: s.imageUrl ? toDoc(s) : null,
          target: s.owner,
          nodeId: s.ownerNodeId,
        },
      })
    );
  } catch {
    /* noop */
  }
}

/** 溜まっている変更を今すぐ書く。 */
function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const s = pending;
  pending = null;
  if (s) dispatchPersist(s);
}

/** 即時保存（取り込み・削除・表示切替など、1 アクション＝1 変更のもの）。 */
function persistNow(s: UnderlayState) {
  pending = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  dispatchPersist(s);
}

/**
 * 遅延保存（スライダーや右ドラッグなど、連続して呼ばれるもの）。
 * 毎 pointermove で updateDoc すると書き込みが爆発するため、止まってからまとめて 1 回書く。
 */
function persistSoon(s: UnderlayState) {
  pending = s;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flushPersist, 400);
}

export const useUnderlayStore = create<UnderlayState>((set, get) => {
  /** set したあと、確定後の状態で即時保存。 */
  const setAndPersistNow = (patch: Partial<UnderlayState>) => {
    set(patch);
    persistNow(get());
  };
  /** set したあと、確定後の状態で遅延保存（連続操作用）。 */
  const setAndPersistSoon = (patch: Partial<UnderlayState>) => {
    set(patch);
    persistSoon(get());
  };

  return {
    ...DEFAULTS,
    owner: null,
    ownerNodeId: null,
    drawMode: "none",
    linePoints: [],

    // 自分の書き込みが Firestore を往復して戻ってくる（エコー）ので、hydrate は
    // 作図状態（drawMode / linePoints）に触らない。触ると基準線を引いている最中に
    // 自分の変更でキャンセルされてしまう。ノード切替時のリセットは resetSession が担う。
    hydrate: (doc, owner, ownerNodeId) =>
      set({
        ...DEFAULTS,
        ...(doc || {}),
        owner: doc ? owner : null,
        ownerNodeId: doc ? ownerNodeId : null,
      }),

    resetSession: () => set({ drawMode: "none", linePoints: [] }),

    setImported: (p) =>
      setAndPersistNow({
        imageUrl: p.imageUrl,
        storagePath: p.storagePath,
        sourceName: p.sourceName,
        aspect: p.aspect > 0 ? p.aspect : 1,
        widthMm: p.widthMm && p.widthMm > 0 ? p.widthMm : UNDERLAY_DEFAULT_WIDTH_MM,
        // 取り込んだ階層がそのまま保存先になる（Plan で取り込めば Plan 専用の下絵）。
        owner: p.owner,
        ownerNodeId: p.ownerNodeId,
        visible: true,
        // 取り込み直しでは配置をリセットして実寸あたり値から始める。
        yMm: DEFAULTS.yMm,
        offsetXMm: 0,
        offsetZMm: 0,
        rotationDeg: 0,
        opacity: DEFAULTS.opacity,
        drawMode: "none",
        linePoints: [],
      }),

    // 1 アクション＝1 変更なので即時保存。
    setVisible: (v) => setAndPersistNow({ visible: v }),

    // 以下はスライダー/右ドラッグで連続して呼ばれるので遅延保存。
    setWidthMm: (v) => setAndPersistSoon({ widthMm: Math.max(100, v) }),
    setYMm: (v) => setAndPersistSoon({ yMm: v }),
    setOffset: (x, z) => setAndPersistSoon({ offsetXMm: x, offsetZMm: z }),
    setRotationDeg: (v) => setAndPersistSoon({ rotationDeg: v }),
    setOpacity: (v) => setAndPersistSoon({ opacity: Math.max(0, Math.min(1, v)) }),

    // 作図状態は保存しないので persist しない。
    setDrawMode: (m) => set({ drawMode: m }),
    addLinePoint: (x, z) =>
      set((s) => ({
        // 3点目以降は新しい線として 1 点目から引き直す。
        linePoints: s.linePoints.length >= 2 ? [[x, z]] : [...s.linePoints, [x, z]],
      })),
    clearLine: () => set({ linePoints: [] }),

    // マップ側の clear() と違い、調整値も既定へ戻す（次の取り込みに持ち越さない）。
    // owner は patch に含めない：persist が「どの階層から消すか」に使うため。
    // 消した結果は Firestore の snapshot 経由で hydrate され直す（Plan の下絵を消せば
    // Base の下絵が継承されて再表示される）。
    clear: () => setAndPersistNow({ ...DEFAULTS, drawMode: "none", linePoints: [] }),
  };
});

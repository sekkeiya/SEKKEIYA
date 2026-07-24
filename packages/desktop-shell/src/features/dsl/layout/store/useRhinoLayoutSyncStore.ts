// useRhinoLayoutSyncStore — Rhino ⇄ S.Layout 躯体ライブ同期（Datasmith 風・Phase 1）。
//
// 仕組み（Rust 側の変更なしで成立する）:
//   1. `list_rhino_documents` で Rhino が開いている .3dm（アクティブ文書）のパスを取得
//   2. `ensure_local_preview_glb` で 3dm → GLB にヘッドレス変換（rhino3dm・Rhino 本体不要）。
//      キャッシュキーに mtime が入っているため、Rhino で保存するたびに新しいファイル名の
//      GLB が生成される＝URL が変わり、ビューポートのクロスフェード機構がそのまま反応する。
//   3. 変換結果を convertFileSrc で asset URL 化し、LayoutShell が Base の躯体 URL を
//      この値で上書きする（クラウドの GLB はそのまま。確定保存は従来の CAD Files 経路）。
//   4. .3dm の親ディレクトリを watch し、保存（mtime 前進）を検知したら 2〜3 を再実行。
//
// Datasmith と同じく一方向（Rhino → S.Layout）。デスクトップ専用（isTauri() ガード）。
import { create } from "zustand";
import { invoke, convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { watch, stat, exists } from "@tauri-apps/plugin-fs";
import { dirname } from "@tauri-apps/api/path";

interface RhinoDocumentInfo {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  processId?: number | null;
}

interface RhinoLayoutSyncState {
  /** リンク中（watch が生きている） */
  active: boolean;
  /** 変換実行中 */
  syncing: boolean;
  docName: string | null;
  docPath: string | null;
  /** 躯体の上書き URL（asset://…）。null なら通常のクラウド GLB を表示。 */
  glbUrl: string | null;
  lastSyncAt: number | null;
  error: string | null;

  /** Rhino のアクティブ文書とリンクして初回同期＋保存監視を開始。 */
  startLink: () => Promise<void>;
  /** リンク解除（上書きも解除され、クラウドの躯体に戻る）。 */
  stopLink: () => void;
  /** 手動で今すぐ同期。 */
  syncNow: () => Promise<void>;
}

// watch の解除関数・デバウンス・直近 mtime はストア外で保持（シリアライズ不要な実体）。
let unwatchFn: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastMtimeMs = 0;
let resyncQueued = false;

function toErrorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    const anyE = e as any;
    if (typeof anyE.message === "string") return anyE.message;
  }
  const s = String(e ?? "同期に失敗しました");
  // 変換器はレンダーメッシュの無い Brep を扱えない（rhino3dm の制約）。原因が分かるように補足する。
  if (s.includes("exit=Some(3)") || s.includes("no meshes")) {
    return "3dm にレンダーメッシュがありません。Rhino でシェーディング表示にしてから保存し直してください。";
  }
  return s;
}

export const useRhinoLayoutSyncStore = create<RhinoLayoutSyncState>((set, get) => ({
  active: false,
  syncing: false,
  docName: null,
  docPath: null,
  glbUrl: null,
  lastSyncAt: null,
  error: null,

  syncNow: async () => {
    const { docPath, syncing } = get();
    if (!docPath) return;
    if (syncing) {
      // 変換中に保存が来たら、終わり次第もう一周する（取りこぼし防止）。
      resyncQueued = true;
      return;
    }
    set({ syncing: true, error: null });
    try {
      // mtime 入りキャッシュキーなので、保存のたびに別ファイル名の GLB が返る。
      const glbPath = await invoke<string>("ensure_local_preview_glb", { path: docPath });
      set({ glbUrl: convertFileSrc(glbPath), lastSyncAt: Date.now(), syncing: false });
    } catch (e) {
      console.warn("[RhinoLayoutSync] convert failed:", e);
      set({ syncing: false, error: toErrorMessage(e) });
    }
    if (resyncQueued) {
      resyncQueued = false;
      void get().syncNow();
    }
  },

  startLink: async () => {
    if (!isTauri()) {
      set({ error: "Rhino 同期はデスクトップ版でのみ使えます。" });
      return;
    }
    // 既存リンクは張り替え
    get().stopLink();

    let doc: RhinoDocumentInfo | null = null;
    try {
      const docs = await invoke<RhinoDocumentInfo[]>("list_rhino_documents");
      doc = docs.find((d) => d.isActive && d.path) || docs.find((d) => !!d.path) || null;
    } catch (e) {
      set({ error: toErrorMessage(e) });
      return;
    }
    if (!doc) {
      set({ error: "Rhino に保存済みの 3dm がありません。名前を付けて保存してからやり直してください。" });
      return;
    }

    set({ active: true, docName: doc.name || null, docPath: doc.path, error: null });
    lastMtimeMs = 0;
    try {
      const st = await stat(doc.path);
      lastMtimeMs = st.mtime ? new Date(st.mtime).getTime() : 0;
    } catch { /* noop */ }

    // 初回同期
    await get().syncNow();

    // 保存監視: ファイル置換/リネームも拾えるよう親ディレクトリを watch（useDssSyncStore と同じ流儀）。
    try {
      const dirPath = await dirname(doc.path);
      const target = doc.path;
      unwatchFn = await watch(dirPath, (event: any) => {
        const paths: string[] = event?.paths || [];
        if (!paths.some((p) => p === target || p.includes(target))) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          debounceTimer = null;
          try {
            if (!(await exists(target))) return;
            const st = await stat(target);
            const mtime = st.mtime ? new Date(st.mtime).getTime() : 0;
            // mtime が前進したときだけ同期（一時ファイルのイベント等を無視）。
            if (mtime <= lastMtimeMs) return;
            lastMtimeMs = mtime;
            void get().syncNow();
          } catch { /* noop */ }
        }, 1200);
      });
    } catch (e) {
      console.warn("[RhinoLayoutSync] watch failed:", e);
      // 監視に失敗してもリンク自体は維持（手動同期は可能）。
      set({ error: "保存の自動検知を開始できませんでした（手動同期は可能です）。" });
    }
  },

  stopLink: () => {
    try { unwatchFn?.(); } catch { /* noop */ }
    unwatchFn = null;
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    resyncQueued = false;
    lastMtimeMs = 0;
    set({ active: false, syncing: false, docName: null, docPath: null, glbUrl: null, error: null });
  },
}));

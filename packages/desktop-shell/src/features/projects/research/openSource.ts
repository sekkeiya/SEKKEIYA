/**
 * リサーチボード（ノード画面・マインドマップ）から「出典を開く」ための共有ヘルパー。
 * どちらの画面でも、取り込んだ知識から元の S.Library / S.Blog へ必ず遡れるようにする。
 */

/** Tauri では window.open が効かないため plugin-opener を使う（Web はフォールバック）。 */
export function openExternal(url: string) {
  import('@tauri-apps/plugin-opener')
    .then(({ openUrl }) => { if (openUrl) openUrl(url); else window.open(url, '_blank'); })
    .catch(() => window.open(url, '_blank'));
}

/** 出典への参照（カード・トピックのどちらからでも渡せる最小限の形）。 */
export interface BoardSourceRef {
  /** 出典種別（library: S.Library エントリ / article: S.Blog 記事）。 */
  refType?: 'library' | 'article';
  /** 出典の ID（library: LibraryEntry.localId / article: BlogArticle.id）。 */
  refId?: string;
  /** アプリ内で辿れないときのフォールバック先。 */
  url?: string;
}

/**
 * 出典を開く（トレーサビリティの担保）。
 * library → S.Library を前面に出して該当エントリを選択、article → S.Blog エディタで開く。
 * アプリ内で辿れないときは元URLへフォールバック。
 */
export async function openBoardSource(ref: BoardSourceRef) {
  try {
    if (ref.refType === 'library' && ref.refId) {
      const { useAppStore } = await import('../../../store/useAppStore');
      const s = useAppStore.getState();
      if (!s.pinnedTabIds.includes('3dsk')) s.togglePinnedTab('3dsk');
      s.setActiveWorkspaceId('library');
      s.setLastActiveAppScope('3dsk');
      s.setCurrentMainView('workspace');
      const { useDskStore } = await import('../../dsk/store/useDskStore');
      const dsk = useDskStore.getState();
      if (dsk.entries.length === 0) await dsk.refresh();
      dsk.setSelectedId(ref.refId);
      return;
    }
    if (ref.refType === 'article' && ref.refId) {
      const { useAuthStore } = await import('../../../store/useAuthStore');
      const uid = useAuthStore.getState().currentUser?.uid;
      if (!uid) return;
      const { useAppStore } = await import('../../../store/useAppStore');
      const s = useAppStore.getState();
      s.setActiveWorkspaceId('blog');
      s.setLastActiveAppScope('3dsb');
      s.setCurrentMainView('workspace');
      const { useDsbStore } = await import('../../dsb/store/useDsbStore');
      const dsb = useDsbStore.getState();
      await dsb.refresh(uid);
      dsb.startEdit(ref.refId);
      return;
    }
    if (ref.url) openExternal(ref.url);
  } catch (e) {
    console.error('[research] 出典を開けませんでした:', e);
    if (ref.url) openExternal(ref.url);
  }
}

// pptx（Drive の生ファイル）を「編集可能プレゼン」に取り込んで S.Slide エディタで開く共有ロジック。
// SEKKEIYA Drive の Quick Look プレビューの「S.Slideで開く」ボタンから使う。
//
// Drive はポップアウト別窓（/?driveWindow=true）なので、そこからは本体ウィンドウのストアを直接
// 触れない。→ 子窓からは OPEN_PRESENTATION_EVENT を emit し、本体（App.tsx の常駐リスナー）が
// applyOpenPresentation() を適用してエディタを開き、前面化する（openMainView と同じ流儀）。
import { useAppStore } from '../../../store/useAppStore';

export const OPEN_PRESENTATION_EVENT = 'sekkeiya://open-presentation';

export interface OpenPresentationPayload {
  projectId: string;
  wf: any; // createPresentationWorkFile が返す作業ファイル
}

/** 本体ウィンドウのストアへ「S.Slide エディタでこのプレゼンを開く」を適用する。 */
export const applyOpenPresentation = ({ projectId, wf }: OpenPresentationPayload) => {
  const store = useAppStore.getState();
  const isTeam = !!(store.projects.find((p: any) => p.id === projectId) as any)?.isTeam;
  store.setActiveProjectId(projectId);
  store.setDspScope(isTeam ? 'team_project_presentations' : 'project_presentations');
  store.setPanelSelection('presents', wf);
  store.setLastLaunchPayload({ projectId, workspaceId: 'presents', appScope: '3dsp' });
  store.setActiveWorkspaceId('presents');
  store.setCurrentMainView('workspace');
  store.setDspShellMode('editor');
  window.dispatchEvent(new CustomEvent('dsp-presentations-updated', { detail: { projectId } }));
};

/** 本体以外の子窓（Drive ポップアウト等）か。 */
function isChildWindow(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return p.has('driveWindow') || p.has('chatWindow') || p.has('standalone');
}

/** 呼び出し元の窓を問わず「S.Slide エディタでこのプレゼンを開く」。子窓なら本体へ emit。 */
export const openPresentationFromHere = (payload: OpenPresentationPayload) => {
  if (isChildWindow()) {
    import('@tauri-apps/api/event')
      .then(({ emit }) => emit(OPEN_PRESENTATION_EVENT, payload))
      .catch(() => { /* Tauri 以外は無視 */ });
    return;
  }
  applyOpenPresentation(payload);
};

/**
 * pptx File を編集可能プレゼンにインポートし、S.Slide エディタで開く。
 * 取り込み先はアクティブプロジェクト（あれば）、無ければユーザーのテンプレ用ワークスペース。
 * DspTemplatesView の「パワポを読み込む」と同一パイプライン（parse→convert→workFile 化）。
 */
export async function importAndOpenPptx(file: File): Promise<void> {
  const { auth } = await import('../../../lib/firebase/client');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('ログインが必要です');
  const ownerName = auth.currentUser?.displayName || auth.currentUser?.email || 'User';

  const [{ getOrCreateTemplateWorkspace }, { parsePptx, pptxToPresentation }, { dspRepository }, { dspAssetUploadService }] =
    await Promise.all([
      import('../api/templateWorkspace'),
      import('../import/pptxImport'),
      import('../api/dspRepository'),
      import('../upload/dspAssetUploadService'),
    ]);

  const active = useAppStore.getState().activeProjectId;
  const projectId = active || (await getOrCreateTemplateWorkspace(uid, ownerName));

  const deck = await parsePptx(file);
  const content = await pptxToPresentation(deck, {
    uploadImage: async (bytes, mime) => dspAssetUploadService.uploadImageBytesOnly(projectId, bytes, mime),
  });
  const baseName = file.name.replace(/\.pptx$/i, '') || 'パワポ取り込み';
  const wf = await dspRepository.createPresentationWorkFile(projectId, baseName, uid, 'presentation', content);

  openPresentationFromHere({ projectId, wf });
}

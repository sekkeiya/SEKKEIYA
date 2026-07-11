/**
 * 共通画像生成サービス — 「生成 → プロジェクトの S.Image に保存」を一本化する。
 *
 * SEKKEIYA Chat の generate_image verb と S.Image まわりの共通経路（docs: 2層構成の①）。
 *   - provider 解決: 明示指定 > AI設定。flux-lora-local は ComfyUI 未導入なら flux-lora(クラウド) へ自動フォールバック
 *   - ローカル(flux-lora-local): Tauri comfy_generate/comfy_edit → Storage アップロード（課金ゼロ）
 *   - クラウド: requestAiRender → users/{uid}/aiJobs/{jobId} を購読して完成を待つ
 *   - saveToProject: dsiUploadService.linkExternalImage でプロジェクトの S.Image に登録（既定 on）
 *
 * S.Image エディタ（DsiEditorChat）は「採用」時のみ保存する対話フローのため独自経路のまま。
 * 将来ここへ寄せる場合は saveToProject:false で生成部分だけ共用できる。
 */

export interface GenerateProjectImageOpts {
  prompt: string;
  /** 保存先プロジェクト。S.Image のグリッドに載る。 */
  projectId: string;
  /** 省略時は AI 設定（getActiveImageProvider）。 */
  provider?: string;
  /** 画像→画像（編集/参考）にする場合の元画像 URL。 */
  inputImageUrl?: string | null;
  /** S.Image に表示するタイトル。省略時はプロンプト冒頭。 */
  title?: string;
  /** false で生成のみ（保存しない）。既定 true。 */
  saveToProject?: boolean;
  /** タグ追記（既定: ['AIレンダー', provider]）。 */
  extraTags?: string[];
}

export interface GenerateProjectImageResult {
  url: string;
  /** 実際に使われた provider（ローカル→クラウドfallback後の値）。 */
  provider: string;
}

const CLOUD_JOB_TIMEOUT_MS = 10 * 60_000;

/** クラウド生成: requestAiRender を投げ、aiJobs の完成を待って resultStorageUrl を返す。 */
async function generateViaCloud(uid: string, provider: string, opts: GenerateProjectImageOpts): Promise<string> {
  const [{ httpsCallable }, { functions, db }, { doc, onSnapshot }] = await Promise.all([
    import('firebase/functions'),
    import('../../lib/firebase/client'),
    import('firebase/firestore'),
  ]);
  const requestAiRender = httpsCallable(functions, 'requestAiRender');
  const res = await requestAiRender({
    provider,
    prompt: opts.prompt,
    inputImageUrl: opts.inputImageUrl || null,
    projectId: opts.projectId,
    workspaceId: 'image',
  });
  const data = res.data as any;
  if (!data?.success || !data?.jobId) throw new Error(data?.message || '生成の開始に失敗しました');

  return await new Promise<string>((resolve, reject) => {
    const ref = doc(db, 'users', uid, 'aiJobs', data.jobId);
    const timer = setTimeout(() => { unsub(); reject(new Error('生成がタイムアウトしました（10分）')); }, CLOUD_JOB_TIMEOUT_MS);
    const unsub = onSnapshot(ref, (snap) => {
      const job = snap.data() as any;
      if (!job) return;
      if (job.status === 'completed' && job.resultStorageUrl) {
        clearTimeout(timer); unsub(); resolve(job.resultStorageUrl);
      } else if (job.status === 'failed') {
        clearTimeout(timer); unsub(); reject(new Error(job.errorMessage || '生成に失敗しました'));
      }
    }, (e) => { clearTimeout(timer); reject(e); });
  });
}

/** ローカル生成（課金ゼロ）: ComfyUI で生成し Storage に上げて URL を返す。 */
async function generateViaLocal(opts: GenerateProjectImageOpts): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  const dataUrl = opts.inputImageUrl
    ? await invoke<string>('comfy_edit', { prompt: opts.prompt, inputImage: opts.inputImageUrl, denoise: 0.6, loraStrength: 1.0 })
    : await invoke<string>('comfy_generate', { prompt: opts.prompt, steps: 4, loraStrength: 1.0 });
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], `gen_${Date.now()}.png`, { type: 'image/png' });
  const { uploadImageAndGetUrl } = await import('../../lib/firebase/uploadImage');
  return await uploadImageAndGetUrl(file);
}

export async function generateProjectImage(opts: GenerateProjectImageOpts): Promise<GenerateProjectImageResult> {
  const prompt = (opts.prompt || '').trim();
  if (!prompt) throw new Error('prompt が必要です');
  if (!opts.projectId) throw new Error('projectId が必要です');

  const { useAuthStore } = await import('../../store/useAuthStore');
  const uid = (useAuthStore.getState().currentUser as any)?.uid as string | undefined;
  if (!uid) throw new Error('ログインが必要です');

  // provider 解決（ローカルは ComfyUI 導入済みのときだけ。未導入なら公式LoRAクラウドへ）
  let provider = opts.provider;
  if (!provider) {
    const { getActiveImageProvider } = await import('../../store/useAiSettingsStore');
    provider = getActiveImageProvider();
  }
  if (provider === 'flux-lora-local') {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const installed = await invoke<boolean>('comfy_installed');
      if (!installed) provider = 'flux-lora';
    } catch { provider = 'flux-lora'; }
  }

  const url = provider === 'flux-lora-local'
    ? await generateViaLocal({ ...opts, prompt })
    : await generateViaCloud(uid, provider!, { ...opts, prompt });

  if (opts.saveToProject !== false) {
    const { dsiUploadService } = await import('./upload/dsiUploadService');
    await dsiUploadService.linkExternalImage(opts.projectId, `gen_${Date.now()}`, {
      title: opts.title || prompt.slice(0, 40),
      category: 'AIレンダー',
      downloadUrl: url,
      mediaType: 'image',
      tags: ['AIレンダー', provider!, ...(opts.extraTags || [])],
      sourceType: 'ai-render',
      sourceRef: { provider, prompt, kind: 'generate_image' },
    });
  }

  return { url, provider: provider! };
}

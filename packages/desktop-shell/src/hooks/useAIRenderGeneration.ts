import { useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '../lib/firebase/client';
import { useAIRenderStore } from '../store/useAIRenderStore';
import { uploadImageAndGetUrl } from '../lib/firebase/uploadImage';
import { publishToDrive } from '../features/drive/drivePublish';
import { useAuth } from '../features/dsl/layout/hooks/useAuthProxy';

const DEFAULT_ESTIMATED_DURATION_MS = 60000;

/**
 * Shared generation + persistence logic for AI Render.
 * Used by both the side-panel and the full-screen variants.
 */
export const useAIRenderGeneration = () => {
  const { user } = useAuth();
  const {
    taskId,
    status,
    selectedModel,
    prompt,
    imageUrl,
    contextProjectId,
    contextWorkspaceId,
    startedAtMs,
    estimatedDurationMs,
    progress,
    setTaskId,
    setStatus,
    setResultUrl,
    setImageUrl,
    setBusy,
    setStartedAt,
    setEstimatedDurationMs,
    setProgress,
    resultUrl,
  } = useAIRenderStore();

  const startGeneration = useCallback(
    async (overridePrompt?: string, overrideImageUrl?: string | null) => {
      if (!user) {
        alert('ログインが必要です');
        return;
      }
      const effectivePrompt = (overridePrompt ?? prompt ?? '').trim();
      const effectiveImageUrl = overrideImageUrl !== undefined ? overrideImageUrl : imageUrl;
      if (!effectivePrompt && !effectiveImageUrl) {
        alert('プロンプトまたはベース画像を指定してください');
        return;
      }

      setTaskId(null);
      setResultUrl(null);
      setStatus('running');
      setBusy(true);
      setStartedAt(Date.now());
      setEstimatedDurationMs(DEFAULT_ESTIMATED_DURATION_MS);
      setProgress(0);

      try {
        const requestAiRender = httpsCallable(functions, 'requestAiRender');
        const result = await requestAiRender({
          provider: selectedModel || 'nanobanana',
          prompt: effectivePrompt,
          inputImageUrl: effectiveImageUrl || null,
          projectId: contextProjectId,
          workspaceId: contextWorkspaceId,
        });
        const data = result.data as any;
        if (!data?.success || !data?.jobId) {
          throw new Error(data?.message || 'Failed to start render job');
        }
        setTaskId(data.jobId);
      } catch (err: any) {
        console.error('[AIRender] startGeneration error:', err);
        const code = err?.code as string | undefined;
        const msg = err?.message || '生成の開始に失敗しました';
        alert(
          code === 'functions/resource-exhausted'
            ? msg
            : `生成の開始に失敗しました: ${msg}`
        );
        setStatus('error');
        setBusy(false);
      }
    },
    [
      user,
      prompt,
      imageUrl,
      selectedModel,
      contextProjectId,
      contextWorkspaceId,
      setTaskId,
      setResultUrl,
      setStatus,
      setBusy,
      setStartedAt,
      setEstimatedDurationMs,
      setProgress,
    ]
  );

  const uploadBaseImage = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const url = await uploadImageAndGetUrl(file);
        setImageUrl(url);
        setResultUrl(null);
        setTaskId(null);
        setStatus('idle');
        return url;
      } catch (err: any) {
        alert('画像アップロードに失敗しました: ' + (err?.message || ''));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [setBusy, setImageUrl, setResultUrl, setTaskId, setStatus]
  );

  /**
   * Save the latest generated image to AI Drive as a global asset.
   * Uses the same `assets` collection used by `useAIDriveStore`'s `uploadImageToDrive`.
   */
  const saveResultToDrive = useCallback(async () => {
    if (!resultUrl) {
      alert('保存できる画像がまだありません');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      alert('ログインが必要です');
      return;
    }
    setBusy(true);
    try {
      // Try to use a fresh size estimate, but tolerate fetch failures from public URLs.
      let sizeLabel: string | undefined;
      try {
        const res = await fetch(resultUrl, { cache: 'no-store' });
        const blob = await res.blob();
        sizeLabel = `${(blob.size / 1024 / 1024).toFixed(1)} MB`;
      } catch {
        sizeLabel = undefined;
      }

      const renderTitle = `AI Render ${new Date().toLocaleString('ja-JP')}`;
      // Drive アクセス層の正典 publish ヘルパー経由で My Library（global assets）へ。
      // 従来の手書き addDoc と同じ保存先だが、visibility/appScope/kind を正規化して統一する。
      const published = await publishToDrive({
        name: renderTitle,
        kind: 'render',
        storageUrl: resultUrl,
        thumbnailUrl: resultUrl,
        size: sizeLabel,
        projectId: null, // 従来どおり My Library（global）に置き、プロジェクト紐付けは下の S.Image リンクで表現。
        visibility: 'private',
        appScope: '3dsi',
        tags: ['ai-render', selectedModel || 'nanobanana'],
        metadata: {
          source: 'ai_render',
          provider: selectedModel || 'nanobanana',
          prompt,
          generationJobId: taskId,
        },
      });

      // S.Image（3DSI）へ参照インデックスを登録（プロジェクト紐付けがある場合のみ・ベストエフォート）。
      if (contextProjectId) {
        try {
          const { dsiUploadService } = await import('../features/dsi/upload/dsiUploadService');
          await dsiUploadService.linkExternalImage(contextProjectId, published.id, {
            title: renderTitle,
            category: 'AIレンダー',
            downloadUrl: resultUrl,
            mediaType: 'image',
            tags: ['AIレンダー', selectedModel || 'nanobanana'],
            sourceType: 'ai-render',
            sourceRef: {
              assetId: assetRef.id,
              jobId: taskId,
              provider: selectedModel || 'nanobanana',
              prompt,
            },
          });
        } catch (e) {
          console.warn('[AIRender] S.Image link skipped (non-fatal):', e);
        }
      }
      alert('SEKKEIYA Drive に保存しました');
    } catch (err: any) {
      console.error('[AIRender] saveResultToDrive error:', err);
      alert('SEKKEIYA Drive 保存に失敗しました: ' + (err?.message || ''));
    } finally {
      setBusy(false);
    }
  }, [resultUrl, contextProjectId, selectedModel, prompt, taskId, setBusy]);

  // Subscribe to the active aiJob and bubble status / result into the store.
  useEffect(() => {
    if (!taskId || !user) return;
    const jobRef = doc(db, 'users', user.uid, 'aiJobs', taskId);
    const unsub = onSnapshot(
      jobRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (data.type && data.type !== 'image_render') return;

        if (typeof data.estimatedDurationMs === 'number') {
          setEstimatedDurationMs(data.estimatedDurationMs);
        }
        // Use server-reported `startedAt` if available (more accurate than the
        // client-side timestamp captured right after the callable returned).
        const serverStartedAt =
          data.startedAt?.toMillis?.() ??
          (typeof data.startedAt === 'number' ? data.startedAt : null);
        if (serverStartedAt) setStartedAt(serverStartedAt);

        if (data.status === 'completed') {
          if (data.resultStorageUrl) setResultUrl(data.resultStorageUrl);
          setStatus('done');
          setProgress(100);
          setBusy(false);
        } else if (data.status === 'failed') {
          alert('AI Render に失敗しました: ' + (data.errorMessage || 'unknown error'));
          setStatus('error');
          setProgress(0);
          setBusy(false);
        } else {
          // pending / processing
          setStatus(data.status || 'running');
        }
      },
      (error) => {
        console.error('[AIRender] job listener error:', error);
        setStatus('error');
        setBusy(false);
      }
    );
    return () => unsub();
  }, [taskId, user, setResultUrl, setStatus, setBusy, setEstimatedDurationMs, setStartedAt, setProgress]);

  // Drive an estimated progress bar while the job is pending/processing.
  // Gemini returns a single response (no real % feed), so we asymptotically
  // approach 95% based on elapsed time vs the expected duration, then jump
  // to 100% on `completed` (handled in the snapshot listener above).
  const tickerRef = useRef<number | null>(null);
  useEffect(() => {
    const isRunning = status === 'running' || status === 'processing' || status === 'pending';
    if (!isRunning || !startedAtMs) {
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      return;
    }
    if (tickerRef.current) return;

    const duration = estimatedDurationMs || DEFAULT_ESTIMATED_DURATION_MS;
    const tick = () => {
      const elapsed = Date.now() - startedAtMs;
      // Easing: linear up to 80%, then slow approach to 95% so we don't sit at 100% before completion.
      const ratio = elapsed / duration;
      let pct: number;
      if (ratio <= 1) {
        pct = ratio * 80;
      } else {
        const overshoot = ratio - 1;
        pct = 80 + (1 - Math.exp(-overshoot)) * 15;
      }
      setProgress(Math.min(95, pct));
    };
    tick();
    tickerRef.current = window.setInterval(tick, 500);
    return () => {
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [status, startedAtMs, estimatedDurationMs, setProgress]);

  return {
    status,
    resultUrl,
    progress,
    startGeneration,
    uploadBaseImage,
    saveResultToDrive,
  };
};

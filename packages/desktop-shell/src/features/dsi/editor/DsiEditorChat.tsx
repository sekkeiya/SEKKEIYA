/**
 * DsiEditorChat — S.Image エディター右サイドバーの「派生系統チャット」。
 *
 * 系統タブ（v1, v2, …）を切り替えながら、各系統に独立した編集指示を出す。
 * 送信すると、その系統の最新画像を基点に requestAiRender（image-to-image / text-to-image）を実行。
 * 系統ごとに別ジョブなので複数方向を同時進行でき、良い結果を S.Image に採用する。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, IconButton, Button, TextField, Select, MenuItem, FormControl,
  CircularProgress, Tooltip, Chip,
} from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AddToPhotosRoundedIcon from '@mui/icons-material/AddToPhotosRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions, auth } from '../../../lib/firebase/client';
import { IMAGE_PROVIDER_OPTIONS, isEditCapableProvider, DEFAULT_EDIT_PROVIDER } from '../../../store/useAiSettingsStore';
import { dsiUploadService } from '../upload/dsiUploadService';
import { uploadImageAndGetUrl } from '../../../lib/firebase/uploadImage';
import { useDsiEditorStore } from '../store/useDsiEditorStore';
import { buildClarifyQuestions, buildDetailText, type ClarifyQuestion } from './clarify';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#ec407a';
const ACCENT_HOVER = '#f48fb1';
const MODELS = IMAGE_PROVIDER_OPTIONS.filter(m => m.available);

export const DsiEditorChat: React.FC = () => {
  const branches = useDsiEditorStore(s => s.branches);
  const activeBranchId = useDsiEditorStore(s => s.activeBranchId);
  const provider = useDsiEditorStore(s => s.provider);
  const originImageUrl = useDsiEditorStore(s => s.originImageUrl);
  const targetProjectId = useDsiEditorStore(s => s.targetProjectId);
  const setProvider = useDsiEditorStore(s => s.setProvider);
  const mode = useDsiEditorStore(s => s.mode);
  const setMode = useDsiEditorStore(s => s.setMode);
  const sessionId = useDsiEditorStore(s => s.sessionId);
  const region = useDsiEditorStore(s => s.region);
  const setRegion = useDsiEditorStore(s => s.setRegion);
  const setRegionMode = useDsiEditorStore(s => s.setRegionMode);

  const [input, setInput] = useState('');
  // ローカル(無料)生成の可否。ComfyUI が起動している時だけ「内観LoRA（ローカル・無料）」を出す。
  const [localAvailable, setLocalAvailable] = useState(false);
  // モデル製造ラインで学習した最新の SDXL LoRA（テスト生成用・管理者のみ読める）。
  const [sdxlLora, setSdxlLora] = useState<{ file: string; trigger: string; scale: number; name: string } | null>(null);
  const sdxlLoraRef = useRef<typeof sdxlLora>(null);
  useEffect(() => { sdxlLoraRef.current = sdxlLora; }, [sdxlLora]);
  useEffect(() => {
    if (!localAvailable) { setSdxlLora(null); return; }
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { subscribeLoraModels } = await import('../loraModels');
        unsub = subscribeLoraModels((rows) => {
          const m = rows.find((r: any) => r.base === 'SDXL' && r.weightsUrl);
          if (!m) { setSdxlLora(null); return; }
          const file = String(m.weightsUrl).split(/[\\/]/).pop() || '';
          setSdxlLora(file.endsWith('.safetensors')
            ? { file, trigger: m.triggerWord || '', scale: m.scale ?? 1.0, name: m.name || 'SDXL' }
            : null);
        });
      } catch { setSdxlLora(null); /* 非管理者は読めない＝項目非表示 */ }
    })();
    return () => { if (unsub) unsub(); };
  }, [localAvailable]);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [clarify, setClarify] = useState<{ instruction: string; questions: ClarifyQuestion[]; answers: Record<string, string[]> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0] || null;
  const activeRunning = !!activeBranch?.messages.some(m => m.status === 'running');

  // 基準画像の有無（画像から生成/編集モードを選べるか）と、「編集の意図」（モード由来）。
  // 画像が存在するだけでは編集にしない ＝ 生成後も「新規生成」モードならローカルで作り続けられる。
  const hasBaseImage = !!(activeBranch?.currentImageUrl || originImageUrl);
  const editingIntent = mode === 'edit' || mode === 'img2img';
  // 候補モデル: 編集の意図では「編集対応 or ローカル(comfy_edit で編集可)」のみ。
  // flux-lora-local は ComfyUI 導入時のみ。学習済み SDXL LoRA（製造ライン）は新規生成のみ動的追加。
  const availableModels = [
    ...MODELS.filter(m => {
      if (m.value === 'flux-lora-local' && !localAvailable) return false;
      if (editingIntent && !(m.edit || m.value === 'flux-lora-local')) return false;
      return true;
    }),
    ...(localAvailable && sdxlLora && !editingIntent
      ? [{ value: 'sdxl-lora-local', label: `学習モデル: ${sdxlLora.name}（SDXL・無料）`, description: '', available: true, edit: false }]
      : []),
  ];
  // 編集の意図で非対応モデル（FLUX schnell 等）が選ばれていたら編集対応モデルへ矯正。
  // ローカルは comfy_edit で編集できるので矯正しない。
  useEffect(() => {
    if (editingIntent && !isEditCapableProvider(provider) && provider !== 'flux-lora-local') {
      setProvider(DEFAULT_EDIT_PROVIDER);
    }
  }, [editingIntent, provider, setProvider]);

  // 起動時に一度、ローカル ComfyUI が「インストール済み」か確認（起動中でなくても項目を出す。
  // 生成時にアプリが自動起動するため、導入済みなら選べるようにする）。Tauri 環境のみ true。
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const ok = await invoke<boolean>('comfy_installed');
        if (alive) setLocalAvailable(!!ok);
      } catch { if (alive) setLocalAvailable(false); }
    })();
    return () => { alive = false; };
  }, []);

  // ローカルを選んだら裏で ComfyUI をウォームアップ（初回生成の待ち時間を短縮）。
  useEffect(() => {
    if (provider !== 'flux-lora-local' && provider !== 'sdxl-lora-local') return;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('comfy_ensure_started');
      } catch { /* 生成時に再試行される */ }
    })();
  }, [provider]);

  // 既定モデル: ComfyUI 導入済み(localAvailable)なら、新規チャット(生成なし)の既定を
  // 「内観LoRA（ローカル・無料）」にする。生成履歴のあるチャットや明示選択は上書きしない。
  useEffect(() => {
    if (!localAvailable) return;
    const st = useDsiEditorStore.getState();
    const hasGen = st.branches.some((b) => b.messages.length > 0);
    if (!hasGen && st.provider !== 'flux-lora-local') st.setProvider('flux-lora-local');
  }, [localAvailable, sessionId]);

  // ── 実行中ジョブの購読（系統横断・並行）─────────────────────────────
  const subsRef = useRef<Map<string, () => void>>(new Map());
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const runningJobIds = new Set<string>();
    for (const b of branches) {
      for (const m of b.messages) {
        if (m.status === 'running' && m.jobId) runningJobIds.add(m.jobId);
      }
    }
    // 新規ジョブを購読
    runningJobIds.forEach((jobId) => {
      if (subsRef.current.has(jobId)) return;
      const unsub = onSnapshot(doc(db, 'users', uid, 'aiJobs', jobId), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (data.type && data.type !== 'image_render') return;
        if (data.status === 'completed') {
          if (data.resultStorageUrl) useDsiEditorStore.getState().resolveJob(jobId, data.resultStorageUrl);
        } else if (data.status === 'failed') {
          useDsiEditorStore.getState().failJob(jobId, data.errorMessage || '生成に失敗しました');
        }
      }, (err) => {
        console.error('[DsiEditorChat] job listener error', err);
        useDsiEditorStore.getState().failJob(jobId, String(err));
      });
      subsRef.current.set(jobId, unsub);
    });
    // 終了したジョブの購読を解除
    for (const [jobId, unsub] of subsRef.current) {
      if (!runningJobIds.has(jobId)) { unsub(); subsRef.current.delete(jobId); }
    }
  }, [branches]);
  // アンマウント時に全解除
  useEffect(() => () => { subsRef.current.forEach(u => u()); subsRef.current.clear(); }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeBranch?.messages.length, activeBranchId, clarify]);

  // 実際の生成（指示＋確認回答の補足＋範囲を織り込む）。
  const runGeneration = useCallback(async (instruction: string, detailText?: string) => {
    const st = useDsiEditorStore.getState();
    const branchId = st.activeBranchId;
    const branch = st.branches.find(b => b.id === branchId);
    if (!branchId || !branch) return;
    const base = branch.currentImageUrl || st.originImageUrl || null;
    const region = st.region;

    const bubble = [region ? '🔲 範囲指定' : null, instruction, detailText ? `（${detailText}）` : null].filter(Boolean).join('\n');
    st.appendUserMessage(branchId, bubble);
    const msgId = st.startAssistant(branchId);

    const mode = st.mode;
    // 「編集/画像から生成」モードのときだけ基準画像を使う。新規生成モードなら画像があっても無視して作り直す。
    const usingImage = (mode === 'edit' || mode === 'img2img') && !!base;
    // 画像入力を使うモードは画像編集対応モデル必須（FLUX schnell 等は入力画像を無視する）。
    // ただし flux-lora-local は comfy_edit で編集できるので矯正しない。
    const provider = usingImage && !isEditCapableProvider(st.provider) && st.provider !== 'flux-lora-local'
      ? DEFAULT_EDIT_PROVIDER : (st.provider || 'nanobanana');

    const regionText = region
      ? `対象範囲: 画像の 左${Math.round(region.x * 100)}%〜${Math.round((region.x + region.w) * 100)}% × 上${Math.round(region.y * 100)}%〜${Math.round((region.y + region.h) * 100)}% の矩形内。この範囲だけを変更し、範囲外は変えないでください。`
      : null;
    const effectivePrompt =
      (usingImage && mode === 'edit')
        ? [
            'この画像を編集してください。元の構図・アングル・写っている物の配置・全体の雰囲気は保ち、指示された箇所だけを自然に変更してください。文字や新しい物体を勝手に追加しないでください。',
            regionText,
            detailText ? `希望: ${detailText}` : null,
            `変更内容: ${instruction}`,
          ].filter(Boolean).join('\n')
        : (usingImage && mode === 'img2img')
        ? [
            'この画像を参考（下絵・スタイル・被写体の雰囲気）にして、新しい画像を生成してください。構図やディテールは指示に沿って自由に発展させて構いません。',
            regionText,
            detailText ? `希望: ${detailText}` : null,
            `方向性: ${instruction}`,
          ].filter(Boolean).join('\n')
        : [detailText ? `補足: ${detailText}` : null, instruction].filter(Boolean).join('\n');

    // ── ローカル(無料)生成: あなたのGPUの ComfyUI で生成し、結果を Storage に上げて解決する。
    //    クラウド(requestAiRender)は通さない＝fal課金ゼロ。テキスト生成専用（edit-gate 済）。
    if (provider === 'flux-lora-local' || provider === 'sdxl-lora-local') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        let dataUrl: string;
        if (provider === 'sdxl-lora-local') {
          // 製造ラインで学習した SDXL LoRA のテスト生成（新規生成のみ・トリガー語を前置）。
          const lo = sdxlLoraRef.current;
          if (!lo) throw new Error('学習済みの SDXL モデルが見つかりません');
          const p = lo.trigger && !effectivePrompt.toLowerCase().includes(lo.trigger.toLowerCase())
            ? `${lo.trigger}, ${effectivePrompt}` : effectivePrompt;
          dataUrl = await invoke<string>('comfy_generate_sdxl', { prompt: p, loraName: lo.file, loraStrength: lo.scale, steps: 25 });
        } else {
          dataUrl = (usingImage && base)
            ? await invoke<string>('comfy_edit', { prompt: effectivePrompt, inputImage: base, denoise: 0.6, loraStrength: 1.0 })
            : await invoke<string>('comfy_generate', { prompt: effectivePrompt, steps: 4, loraStrength: 1.0 });
        }
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `local_${Date.now()}.png`, { type: 'image/png' });
        const url = await uploadImageAndGetUrl(file);
        // msgId を直接解決（ローカルは jobId が無いため resolveJob 相当を手で行う）
        useDsiEditorStore.setState((s) => {
          let hitBranch: string | null = null;
          const branches = s.branches.map(b => {
            if (!b.messages.some(m => m.id === msgId)) return b;
            hitBranch = b.id;
            return {
              ...b,
              currentImageUrl: url,
              messages: b.messages.map(m => m.id === msgId ? { ...m, status: 'done' as const, imageUrl: url } : m),
            };
          });
          return (hitBranch && hitBranch === s.activeBranchId) ? { branches, selectedImageUrl: url } : { branches };
        });
      } catch (e: any) {
        useDsiEditorStore.setState((s) => ({
          branches: s.branches.map(b => ({
            ...b,
            messages: b.messages.map(m => m.id === msgId ? { ...m, status: 'error' as const, error: e?.message || 'ローカル生成に失敗しました' } : m),
          })),
        }));
      }
      return;
    }

    try {
      const requestAiRender = httpsCallable(functions, 'requestAiRender');
      const res = await requestAiRender({
        provider,
        prompt: effectivePrompt,
        inputImageUrl: base,
        projectId: st.targetProjectId,
        workspaceId: 'image',
        region: region || null, // 将来のマスク編集用（サーバー未対応でも無害）
      });
      const data = res.data as any;
      if (!data?.success || !data?.jobId) throw new Error(data?.message || '生成の開始に失敗しました');
      st.attachJob(msgId, data.jobId);
    } catch (e: any) {
      console.error('[DsiEditorChat] generation failed', e);
      useDsiEditorStore.setState((s) => ({
        branches: s.branches.map(b => b.id === branchId ? {
          ...b,
          messages: b.messages.map(m => m.id === msgId ? { ...m, status: 'error', error: e?.message || '生成の開始に失敗しました' } : m),
        } : b),
      }));
    }
  }, []);

  // 送信: 編集（ベース画像あり）のときは、いきなり生成せず選択式の確認カードを出す。
  const send = useCallback(() => {
    const instruction = input.trim();
    if (!instruction || !activeBranch) return;
    const st = useDsiEditorStore.getState();
    if (st.showStart) st.chooseMode(st.mode); // 起動オーバーレイが残っていれば閉じる
    const base = activeBranch.currentImageUrl || originImageUrl || null;
    setInput('');
    // 編集モードのときだけ、生成前に選択式の確認カードを出す（画像から生成は自由度重視でスキップ）。
    if (base && st.mode === 'edit') {
      const questions = buildClarifyQuestions(instruction, { hasRegion: !!st.region });
      if (questions.length) { setClarify({ instruction, questions, answers: {} }); return; }
    }
    void runGeneration(instruction);
  }, [input, activeBranch, originImageUrl, runGeneration]);

  const toggleAnswer = useCallback((q: ClarifyQuestion, value: string) => {
    setClarify((c) => {
      if (!c) return c;
      const cur = c.answers[q.id] || [];
      const next = q.multi
        ? (cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value])
        : (cur.includes(value) ? [] : [value]);
      return { ...c, answers: { ...c.answers, [q.id]: next } };
    });
  }, []);

  const confirmClarify = useCallback((withDetails: boolean) => {
    setClarify((c) => {
      if (!c) return null;
      const detail = withDetails ? buildDetailText(c.questions, c.answers) : '';
      void runGeneration(c.instruction, detail || undefined);
      return null;
    });
  }, [runGeneration]);

  const handleSave = useCallback(async (url: string) => {
    if (!targetProjectId) { alert('保存先プロジェクトが不明です'); return; }
    setSavingUrl(url);
    try {
      await dsiUploadService.linkExternalImage(targetProjectId, `dsi_${Date.now()}`, {
        title: `AI画像 ${new Date().toLocaleString('ja-JP')}`,
        category: 'AIレンダー',
        downloadUrl: url,
        mediaType: 'image',
        tags: ['AIレンダー', provider, '編集'],
        sourceType: 'ai-render',
        sourceRef: { provider, kind: 'edit' },
      });
      setSavedUrls(prev => new Set(prev).add(url));
    } catch (e: any) {
      console.error('[DsiEditorChat] save failed', e);
      alert('S.Image への保存に失敗しました: ' + (e?.message || ''));
    } finally {
      setSavingUrl(null);
    }
  }, [targetProjectId, provider]);

  const handleDownload = (url: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = `s_image_${Date.now()}.png`; a.click();
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.panel }}>
      {/* ヘッダー */}
      <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: ACCENT }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)' }}>AI 編集チャット</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>系統ごとに別方向</Typography>
      </Box>

      {/* アクティブ系統の表示（系統の選択・追加は左のツリーで行う） */}
      <Box sx={{ px: 1.5, py: 0.75, borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          size="small"
          label={activeBranch ? activeBranch.name : '—'}
          icon={activeRunning ? <CircularProgress size={11} sx={{ color: 'inherit !important', ml: 0.5 }} /> : undefined}
          sx={{ height: 22, fontWeight: 700, fontSize: 11, color: 'var(--brand-fg)', bgcolor: ACCENT }}
        />
        <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>この系統へ指示（左ツリーで系統を切替・追加）</Typography>
      </Box>

      {/* メッセージ */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {(!activeBranch || activeBranch.messages.length === 0) && !clarify ? (
          <Box sx={{ m: 'auto', textAlign: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.35)', px: 2 }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 32, opacity: 0.5, mb: 1 }} />
            <Typography sx={{ fontSize: 12, lineHeight: 1.7 }}>
              {originImageUrl ? 'この系統の編集指示を入力してください（例: 壁を白く、朝の光に）' : 'プロンプトを入力して画像を生成してください'}
            </Typography>
          </Box>
        ) : (
          activeBranch.messages.map((m) => (
            m.role === 'user' ? (
              <Box key={m.id} sx={{ alignSelf: 'flex-end', maxWidth: '85%', bgcolor: ACCENT, color: 'var(--brand-fg)', borderRadius: 2, px: 1.5, py: 0.75 }}>
                <Typography sx={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</Typography>
              </Box>
            ) : (
              <Box key={m.id} sx={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
                {m.status === 'running' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 2, px: 1.5, py: 1 }}>
                    <CircularProgress size={14} sx={{ color: ACCENT }} />
                    <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>生成中…</Typography>
                  </Box>
                ) : m.status === 'error' ? (
                  <Box sx={{ bgcolor: 'rgba(211,47,47,0.12)', border: '1px solid rgba(211,47,47,0.4)', borderRadius: 2, px: 1.5, py: 1 }}>
                    <Typography sx={{ fontSize: 11, color: '#ef9a9a' }}>失敗: {m.error}</Typography>
                  </Box>
                ) : m.imageUrl ? (
                  <Box>
                    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: `1px solid ${BRAND.line}` }}>
                      <img src={m.imageUrl} alt="result" style={{ width: '100%', display: 'block' }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Button
                        size="small"
                        disabled={savingUrl === m.imageUrl || savedUrls.has(m.imageUrl)}
                        onClick={() => handleSave(m.imageUrl!)}
                        startIcon={savingUrl === m.imageUrl ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : savedUrls.has(m.imageUrl) ? <CheckCircleRoundedIcon sx={{ fontSize: 14 }} /> : <AddToPhotosRoundedIcon sx={{ fontSize: 14 }} />}
                        sx={{ flex: 1, fontSize: 10, textTransform: 'none', color: 'var(--brand-fg)', bgcolor: savedUrls.has(m.imageUrl) ? 'rgb(var(--brand-fg-rgb) / 0.12)' : `${ACCENT}22`, '&:hover': { bgcolor: `${ACCENT}33` } }}
                      >
                        {savedUrls.has(m.imageUrl) ? '採用済み' : 'S.Imageに採用'}
                      </Button>
                      <Tooltip title="ダウンロード">
                        <IconButton size="small" onClick={() => handleDownload(m.imageUrl!)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)' }}>
                          <DownloadRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ) : null}
              </Box>
            )
          ))
        )}

        {/* 生成前のAIリード確認カード（選択式） */}
        {clarify && (
          <Box sx={{ alignSelf: 'stretch', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: `1px solid ${ACCENT}55`, borderRadius: 2, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 15, color: ACCENT }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)' }}>生成前に確認させてください</Typography>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.55)', wordBreak: 'break-word' }}>
              「{clarify.instruction}」— 以下を選ぶと失敗が減ります。
            </Typography>
            {clarify.questions.map((q) => (
              <Box key={q.id}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-fg)', mb: 0.5 }}>
                  {q.question}{q.multi && <Typography component="span" sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.4)', ml: 0.5 }}>（複数可）</Typography>}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {q.options.map((o) => {
                    const sel = (clarify.answers[q.id] || []).includes(o.value);
                    return (
                      <Chip
                        key={o.value} size="small" label={o.label}
                        onClick={() => toggleAnswer(q, o.value)}
                        sx={{
                          height: 22, fontSize: 11, cursor: 'pointer',
                          color: sel ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
                          bgcolor: sel ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.06)',
                          border: sel ? `1px solid ${ACCENT}` : '1px solid transparent',
                          '&:hover': { bgcolor: sel ? ACCENT_HOVER : 'rgb(var(--brand-fg-rgb) / 0.12)' },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
              <Button size="small" variant="contained" onClick={() => confirmClarify(true)}
                sx={{ flex: 1, fontSize: 11, textTransform: 'none', bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: ACCENT_HOVER } }}>
                この内容で生成
              </Button>
              <Button size="small" onClick={() => confirmClarify(false)}
                sx={{ fontSize: 11, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                指定なしで生成
              </Button>
              <Button size="small" onClick={() => setClarify(null)}
                sx={{ fontSize: 11, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                取消
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      {/* 入力 */}
      <Box sx={{ p: 1.5, borderTop: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {region && (
          <Chip
            size="small"
            label="範囲を指定して編集"
            onDelete={() => { setRegion(null); setRegionMode(false); }}
            sx={{ alignSelf: 'flex-start', height: 22, fontSize: 11, color: 'var(--brand-fg)', bgcolor: 'rgba(255,59,107,0.18)', border: '1px solid rgba(255,59,107,0.5)', '& .MuiChip-deleteIcon': { fontSize: 15, color: 'rgba(255,59,107,0.8)' } }}
          />
        )}
        {/* モード切替: 新規生成 / 画像から生成 / 画像を編集。後2つは基準画像がある時のみ。 */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {([['text', '新規生成', true], ['img2img', '画像から生成', hasBaseImage], ['edit', '画像を編集', hasBaseImage]] as const).map(([m, label, enabled]) => (
            <Button
              key={m}
              size="small"
              disabled={!enabled}
              onClick={() => setMode(m)}
              sx={{
                flex: 1, minWidth: 0, fontSize: 10.5, textTransform: 'none', py: 0.3, borderRadius: 1.5,
                bgcolor: mode === m ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.06)',
                color: mode === m ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.6)',
                '&:hover': { bgcolor: mode === m ? ACCENT_HOVER : 'rgb(var(--brand-fg-rgb) / 0.12)' },
                '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.25)' },
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
        <FormControl size="small" sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 12, borderRadius: 2, '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}>
          <Select
            value={availableModels.some(m => m.value === provider) ? provider : (availableModels[0]?.value || 'nanobanana')}
            onChange={(e) => setProvider(e.target.value as string)}
            MenuProps={{ PaperProps: { sx: { bgcolor: BRAND.bg, border: `1px solid ${BRAND.line}`, backgroundImage: 'none' } } }}
          >
            {availableModels.map(m => <MenuItem key={m.value} value={m.value} sx={{ fontSize: 12 }}>{m.label}</MenuItem>)}
          </Select>
        </FormControl>
        {editingIntent && (
          <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: -0.5 }}>
            編集は Gemini か「内観LoRA（ローカル・無料）」が使えます。新しい画像を作るときは「新規生成」に切り替えてください。
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
          <TextField
            fullWidth size="small" multiline maxRows={4}
            placeholder={originImageUrl ? 'この系統への編集指示…' : '生成プロンプト…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', fontSize: 12, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
          />
          <IconButton
            onClick={send}
            disabled={!input.trim()}
            sx={{ bgcolor: ACCENT, color: 'var(--brand-fg)', '&:hover': { bgcolor: ACCENT_HOVER }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}
          >
            <SendRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        {activeRunning && (
          <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            生成中でも他の系統タブに切り替えて並行編集できます。
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default DsiEditorChat;

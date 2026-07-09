/**
 * BlogAiDialogue — S.Blog「AIと議論して書く」右パネル
 *
 * 記事（下書き）を挟んで AI と対話し、あなたの考え・経験を引き出す。
 * 最後に「議論を記事に反映」すると、あなたの発言が記事の主張として織り込まれる。
 * 対話ログは draft.aiDialogue に保存（自動保存に乗って永続化・途中再開可）。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, CircularProgress, Tooltip, Chip, Collapse, Menu, MenuItem } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { speak, stopSpeaking, isTtsAvailable } from './lib/tts';
import { TtsSettingsDialog } from '../../components/tts/TtsSettingsDialog';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { getTaskModel } from '../../store/useAiSettingsStore';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { generateAndPlaceBlogImages, insertPlaceholdersByHeading, type BlogImagePlan } from './lib/blogImageGen';
import type { BlogDialogueMsg } from './types';
import { DIALOGUE_ROUND_OPTIONS, DEFAULT_DIALOGUE_ROUNDS, INTERVIEWER_PRESETS, DEFAULT_INTERVIEWER_ID } from './types';

// 出典リンクを開く（Tauriは既定ブラウザ、Webは新規タブ）
async function openExternal(url: string) {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    try { window.open(url, '_blank'); } catch { /* noop */ }
  }
}

const ACCENT = '#e57373';

interface BlogAiDialogueProps {
  onToast: (msg: string, sev: 'success' | 'error' | 'info') => void;
}

export const BlogAiDialogue: React.FC<BlogAiDialogueProps> = ({ onToast }) => {
  const { draft, updateDraft, saveWorkingDraft, setGenerating } = useDsbStore();
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const messages: BlogDialogueMsg[] = draft?.aiDialogue ?? [];
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);   // AIの応答待ち
  const [reflecting, setReflecting] = useState(false); // 記事へ反映中
  const [sourcesOpen, setSourcesOpen] = useState(true); // 題材記事の折りたたみ
  const scrollRef = useRef<HTMLDivElement>(null);

  const userSpoke = messages.some((m) => m.role === 'user' && m.text.trim());
  const sourceRefs = draft?.sourceRefs ?? [];

  // 📖 リーダーが公開中の記事ブロック（本文・画像）。インタビューの素材として使い、
  // AIが取り上げた箇所へリーダーをスクロールさせる。現在の題材記事のものだけ採用する。
  const readerBlocks = useDsbStore((s) => s.readerBlocks);
  const readerArticleUrl = useDsbStore((s) => s.readerArticleUrl);
  const focusReaderBlockAt = useDsbStore((s) => s.focusReaderBlockAt);
  const activeUrl = sourceRefs[0]?.url;
  const liveBlocks = readerArticleUrl && readerArticleUrl === activeUrl ? readerBlocks : [];

  // 🎯 インタビュー往復回数の目安（記事ごとに設定・draftに保存。0=無制限）
  const targetRounds = draft?.dialogueRounds ?? DEFAULT_DIALOGUE_ROUNDS;
  const userRounds = messages.filter((m) => m.role === 'user').length;
  const roundsReached = targetRounds > 0 && userRounds >= targetRounds;
  const [roundsAnchor, setRoundsAnchor] = useState<HTMLElement | null>(null);
  const roundsLabel = DIALOGUE_ROUND_OPTIONS.find((o) => o.value === targetRounds)?.label ?? `${targetRounds}往復`;

  // 🎭 インタビュアー人格（記事ごとに選択・draftに保存。議論の途中で替えると次のターンから反映）。
  // 選ぶたびに localStorage へ既定として記憶し、議論ファースト（自動開始）や新規記事でも好みの人格が使われる。
  const INTERVIEWER_KEY = 'sblog-interviewer-default';
  const storedInterviewer = (() => { try { return localStorage.getItem(INTERVIEWER_KEY); } catch { return null; } })();
  const interviewer = INTERVIEWER_PRESETS.find((p) => p.id === (draft?.interviewerId ?? storedInterviewer ?? DEFAULT_INTERVIEWER_ID)) ?? INTERVIEWER_PRESETS[0];
  const selectInterviewer = (id: string) => {
    updateDraft({ interviewerId: id });
    try { localStorage.setItem(INTERVIEWER_KEY, id); } catch { /* noop */ }
  };
  // 議論ファースト（ホームのフィード発）: 下書きが無く、題材記事だけがある状態。
  // 議論→「議論から記事を生成」の順で書く。
  const discussFirst = !draft?.bodyMarkdown?.trim() && sourceRefs.length > 0;
  // 題材記事の本文キャッシュ（サーバーが初回取得して返す。以後のターンは送り返して再取得を回避）
  const sourceTextRef = useRef<string>('');

  // 🔊 音声モード: ONにするとAIの応答を読み上げる（本文を書きながら耳で議論できる）。
  // 一度ONにしたら localStorage に記憶し、リロード・記事切替後も既定でONを維持する。
  const VOICE_MODE_KEY = 'sblog-dialogue-voice';
  const [voiceMode, setVoiceMode] = useState<boolean>(() => {
    try { return localStorage.getItem(VOICE_MODE_KEY) === '1'; } catch { return false; }
  });
  const voiceModeRef = useRef(voiceMode);
  const toggleVoice = () => {
    setVoiceMode((v) => {
      const next = !v;
      voiceModeRef.current = next;
      try { localStorage.setItem(VOICE_MODE_KEY, next ? '1' : '0'); } catch { /* noop */ }
      if (!next) stopSpeaking();
      return next;
    });
  };
  // 読み上げ設定ダイアログ（音声トグルの隣の⚙から開く）
  const [ttsSettingsOpen, setTtsSettingsOpen] = useState(false);
  useEffect(() => () => stopSpeaking(), []); // アンマウント時に停止

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, thinking]);

  // 議論ファーストは自動開始: フィードから来たら即「記事を読んで要約→最初の質問」まで進める。
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (discussFirst && messages.length === 0 && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void callTurn([], '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 議論ログは貴重（リロード・クラッシュで失われてはならない）ので、
  // 自動保存のデバウンスを待たずメッセージ追加のたびに即クラウド保存する（best-effort）。
  const pushMessages = (next: BlogDialogueMsg[]) => {
    updateDraft({ aiDialogue: next });
    if (uid) void saveWorkingDraft(uid).catch((e) => console.warn('[BlogAiDialogue] dialogue save failed', e));
  };

  /**
   * 記事ブロックのダイジェスト（AIへ送る）。段落・見出しは本文（長すぎるものは短縮）、
   * 画像は前後の本文＝「その画像が何を写しているか」の手がかりを添える。
   * index はリーダーの表示ブロックと一致し、AIが返す refs でその箇所へスクロールできる。
   */
  const buildArticleDigest = () => liveBlocks.slice(0, 60).map((b, i) => {
    if (b.t === 'p' || b.t === 'h') {
      const text = (b.text || '').trim();
      return { i, t: b.t, text: text.length > 240 ? `${text.slice(0, 240)}…` : text };
    }
    // 画像/動画: 直近の見出し＋前後の段落を文脈として添える（AIは画像そのものは見られないため）
    let near = '';
    for (let k = i - 1; k >= 0 && near.length < 160; k--) {
      const bb = liveBlocks[k];
      if (bb.t === 'h') { near = `【${bb.text}】 ${near}`; break; }
      if (bb.t === 'p') near = `${(bb.text || '').slice(-120)} ${near}`;
    }
    for (let k = i + 1; k < liveBlocks.length && near.length < 240; k++) {
      const bb = liveBlocks[k];
      if (bb.t === 'p' || bb.t === 'h') { near += ` ${(bb.text || '').slice(0, 100)}`; break; }
    }
    return { i, t: 'img' as const, near: near.trim().slice(0, 240) };
  }).filter((b) => (b.t === 'img' ? true : !!(b as any).text));

  /** AIの1ターン（history 空 + 発言なし = 口火） */
  const callTurn = async (history: BlogDialogueMsg[], userMessage: string) => {
    if (!draft) return;
    setThinking(true);
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({
        mode: 'turn',
        model: getTaskModel('blog'), // 用途別モデル設定（サーバー対応まではサーバー側で無視）
        title: draft.title,
        bodyMarkdown: draft.bodyMarkdown,
        history: history.map((m) => ({ role: m.role, text: m.text })),
        userMessage,
        sourceRefs: (draft.sourceRefs ?? []).map((s) => ({ title: s.title, url: s.url, source: s.source, summary: s.summary })),
        sourceText: sourceTextRef.current, // 2ターン目以降は再取得を回避
        // 📖 記事の本文・画像を index 付きで渡す。AIは具体的な段落・写真を取り上げて質問し、
        //    取り上げた箇所を refs（index配列）で返す（リーダーがその箇所へスクロールする）。
        articleBlocks: buildArticleDigest(),
        // 🎯 インタビューのペース配分ガイド（0=無制限）。残りが少なければAIは収束へ向かう
        targetRounds,
        roundsSoFar: history.filter((m) => m.role === 'user').length + (userMessage ? 1 : 0),
        // 🎭 インタビュアー人格。prompt をそのままシステムプロンプトへ注入する
        interviewer: { id: interviewer.id, label: interviewer.label, prompt: interviewer.prompt },
      });
      if (r.data?.success && r.data.reply) {
        if (r.data.sourceText) sourceTextRef.current = r.data.sourceText;
        if (voiceModeRef.current) speak(r.data.reply); // 音声モード: AI応答を読み上げ
        const now = new Date().toISOString();
        // 初回は記事の日本語要約カードを先に挟む（英語記事は翻訳済み）
        const summaryMsgs: BlogDialogueMsg[] = r.data.summary && (r.data.summary.overview || r.data.summary.points?.length)
          ? [{
              role: 'ai' as const,
              kind: 'summary' as const,
              text: [r.data.summary.overview, ...(r.data.summary.points || []).map((p: string) => `・${p}`)].filter(Boolean).join('\n'),
              ts: now,
            }]
          : [];
        // 📖 AIが取り上げた記事内の箇所（refs=リーダーのブロックindex）。範囲内のものだけ採用。
        const refs: number[] = Array.isArray(r.data.refs)
          ? r.data.refs.filter((n: any) => Number.isInteger(n) && n >= 0 && n < liveBlocks.length).slice(0, 4)
          : [];
        const nextMsgs: BlogDialogueMsg[] = [...history, ...(userMessage ? [{ role: 'user' as const, text: userMessage, ts: now }] : []),
          ...summaryMsgs,
          { role: 'ai' as const, text: r.data.reply, ts: now,
            ...(Array.isArray(r.data.choices) && r.data.choices.length ? { choices: r.data.choices } : {}),
            ...(refs.length ? { refs } : {}) }];
        pushMessages(nextMsgs);
        // AIが記事の一箇所に触れたら、リーダーをそこへスクロールして「今この写真/段落の話をしている」を可視化
        if (refs.length) focusReaderBlockAt(refs[0]);
        // ✍ AIが執筆開始を宣言（startWriting）→ 宣言だけで止まらず、そのまま自動で記事生成へ。
        // 本文が入ると DsbEditor 側が執筆モードへ自動切替する。
        if (r.data.startWriting) {
          onToast('AIが議論をもとに下書きの生成を始めました', 'info');
          void handleReflect(nextMsgs);
        }
      } else {
        onToast(`AIの応答に失敗しました: ${r.data?.reason || '不明なエラー'}`, 'error');
      }
    } catch (e: any) {
      onToast(`AIの応答に失敗しました: ${e.message}`, 'error');
    } finally {
      setThinking(false);
    }
  };

  const handleStart = () => callTurn([], '');

  const handleSend = () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    callTurn(messages, text);
  };

  /** 🎯 目標文字数: 既定2000字。議論の往復数・発言量に応じてSEOに適した長さへ自動調整。
   *  （検索上位の建築・インテリア系記事は1500〜3000字帯が主流。議論が深いほど素材が多い＝長めに） */
  const computeTargetChars = (hist: BlogDialogueMsg[]): number => {
    const users = hist.filter((m) => m.role === 'user' && m.text.trim());
    const rounds = users.length;
    const totalLen = users.reduce((a, m) => a + m.text.length, 0);
    let t = 2000;                 // 既定
    if (rounds <= 3) t = 1500;    // 短い議論 → コンパクトに
    else if (rounds <= 9) t = 2000;
    else if (rounds <= 17) t = 2600;
    else t = 3200;                // 18往復以上 → 特集級
    if (totalLen > 1500) t += 400; // 発言量が多い（経験談が濃い）→ 上振れ
    return Math.min(4000, Math.max(1200, t));
  };

  /** 議論ログを記事へ反映（synthesize）。
   *  historyArg: AIの執筆開始宣言から自動実行するとき、state更新前の最新履歴を渡す（stale closure回避） */
  const handleReflect = async (historyArg?: BlogDialogueMsg[]) => {
    if (!draft || reflecting) return;
    const hist = historyArg ?? messages;
    setReflecting(true);
    setGenerating(true); // エディタが執筆モードへ切替わり、執筆演出が始まる
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({
        mode: 'synthesize',
        model: getTaskModel('blog'), // 用途別モデル設定（サーバー対応まではサーバー側で無視）
        title: draft.title,
        bodyMarkdown: draft.bodyMarkdown,
        history: hist.map((m) => ({ role: m.role, text: m.text })),
        sourceRefs: (draft.sourceRefs ?? []).map((s) => ({ title: s.title, url: s.url, source: s.source, summary: s.summary })),
        sourceText: sourceTextRef.current,
        targetChars: computeTargetChars(hist), // SEO向け目標文字数（議論量から自動算出）
      });
      if (r.data?.success) {
        const images: BlogImagePlan[] = Array.isArray(r.data.images) ? r.data.images : [];
        const rawBody = r.data.bodyMarkdown || draft.bodyMarkdown;
        // 各セクション見出しの直後に「生成中」プレースホルダを挿入して、本文を即・読める状態にする
        const { body: bodyMarked, placeholders } = images.length
          ? insertPlaceholdersByHeading(rawBody, images)
          : { body: rawBody, placeholders: [] as string[] };
        updateDraft({
          title: r.data.title || draft.title,
          excerpt: r.data.excerpt || draft.excerpt,
          bodyMarkdown: bodyMarked,
          // 🔍 SEOスラッグ: AIが英数字ハイフンで返す。まだスラッグ未設定（空 or 自動 post- ）のときだけ採用
          ...(r.data.slug && (!draft.slug?.trim() || /^post-/.test(draft.slug)) ? { slug: r.data.slug } : {}),
          ...(r.data.generated && Array.isArray(r.data.tags) && r.data.tags.length && !(draft.tags?.length) ? { tags: r.data.tags } : {}),
        });
        onToast(r.data.generated
          ? '議論を踏まえて記事を生成しました。本文を確認・編集してください。'
          : '議論の内容を記事に反映しました。本文を確認してください。', 'success');

        // 🧠 議論から自動保存されたユーザーメモリー（docs/21 経路①）の見える化。
        // 保存はサーバー（synthesize）が行い、ここでは通知だけ（管理は AI Studio > メモリー）
        const savedMemories: Array<{ text?: string }> = Array.isArray(r.data.savedMemories) ? r.data.savedMemories : [];
        if (savedMemories.length) {
          onToast(`💡 議論からあなたの考えを ${savedMemories.length} 件メモリーに保存しました（AI Studio > メモリーで確認・削除できます）`, 'info');
        }

        // 🖼 記事に合うAI画像を生成して本文へ差し込む（非同期・完成し次第反映）。
        // 元記事の写真は使わず著作権的に安全。1枚目はカバーにも使う。
        const cover = r.data.cover && r.data.cover.prompt ? r.data.cover as { caption: string; prompt: string } : null;
        if ((images.length || cover) && uid) {
          const st = useDsbStore.getState();
          const projectId = draft.publishTarget.scope === 'project' ? draft.publishTarget.projectId : null;
          const totalImgs = images.length + (cover ? 1 : 0);
          onToast(`記事に合う画像を${totalImgs}枚生成しています…（完成し次第、本文に入ります）`, 'info');
          void generateAndPlaceBlogImages({
            uid,
            images,
            placeholders,
            cover,
            projectId,
            getBody: () => useDsbStore.getState().draft?.bodyMarkdown ?? '',
            setBody: (md) => useDsbStore.getState().updateDraft({ bodyMarkdown: md }),
            onCover: (url) => { if (!useDsbStore.getState().draft?.coverUrl) useDsbStore.getState().updateDraft({ coverUrl: url }); },
            onProgress: (done, total) => useDsbStore.getState().setImageGen(done >= total ? null : { done, total }),
          }).then((res) => {
            useDsbStore.getState().setImageGen(null);
            if (res.placed > 0) { if (uid) void st.saveWorkingDraft(uid); }
            if (res.limited === 'PLAN_REQUIRED') onToast('記事画像は有料プランでご利用いただけます（記事は保存済みです）', 'info');
            else if (res.limited === 'BLOG_IMAGE_LIMITED') onToast('AI画像の利用枠に達したため、一部の画像は配置していません（時間経過で回復します）', 'info');
            else if (res.placed > 0) onToast(`画像を${res.placed}枚配置しました（サムネイルも設定済み）`, 'success');
          }).catch((e) => { useDsbStore.getState().setImageGen(null); console.warn('[BlogAiDialogue] image gen failed', e); });
        }
      } else {
        onToast(`反映に失敗しました: ${r.data?.reason || '不明なエラー'}`, 'error');
      }
    } catch (e: any) {
      onToast(`反映に失敗しました: ${e.message}`, 'error');
    } finally {
      setReflecting(false);
      setGenerating(false); // 本文が入っていれば執筆演出がタイプ表示へ、失敗なら静かに消える
    }
  };

  const handleReset = () => pushMessages([]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ヘッダー */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
        <ForumRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.2 }}>AIと議論して書く</Typography>
          <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
            {messages.length > 0
              ? `${interviewer.emoji} ${interviewer.label}${targetRounds > 0 ? ` — やり取り ${Math.min(userRounds, targetRounds)}/${targetRounds}（目安）` : 'と議論中'}`
              : 'あなたの考えを話すほど、記事に反映されます'}
          </Typography>
        </Box>
        {/* 🎯 この記事のインタビュー往復回数の目安（記事ごとに保存） */}
        <Tooltip title="この記事のインタビュー往復回数の目安（AIがこの回数で収束するようペース配分します）">
          <Chip label={`目安 ${roundsLabel}`} size="small" onClick={(e) => setRoundsAnchor(e.currentTarget)}
            sx={{ cursor: 'pointer', height: 22, fontSize: 10.5, fontWeight: 700,
              bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', color: 'rgb(var(--brand-fg-rgb) / 0.6)',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.14)',
              '&:hover': { borderColor: `${ACCENT}88`, color: 'var(--brand-fg)' } }} />
        </Tooltip>
        <Menu anchorEl={roundsAnchor} open={!!roundsAnchor} onClose={() => setRoundsAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' } } }}>
          {DIALOGUE_ROUND_OPTIONS.map((o) => (
            <MenuItem key={o.value} selected={o.value === targetRounds}
              onClick={() => { updateDraft({ dialogueRounds: o.value }); setRoundsAnchor(null); }}
              sx={{ fontSize: 12.5, color: 'var(--brand-fg)', display: 'block', py: 0.75 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{o.label}</Typography>
              <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{o.desc}</Typography>
            </MenuItem>
          ))}
        </Menu>
        {isTtsAvailable() && (
          <Tooltip title={voiceMode ? '読み上げOFF' : '読み上げON（AIの発言を音声で聞きながら書けます）'}>
            <IconButton size="small" onClick={toggleVoice}
              sx={{ color: voiceMode ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.4)', bgcolor: voiceMode ? `${ACCENT}1f` : 'transparent' }}>
              {voiceMode ? <VolumeUpRoundedIcon sx={{ fontSize: 16 }} /> : <VolumeOffRoundedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        )}
        {/* ⚙ インタビュアー＋読み上げの設定（インタビュアー選択はこのダイアログに集約） */}
        <Tooltip title="インタビュアーと読み上げの設定">
          <IconButton size="small" onClick={() => setTtsSettingsOpen(true)}
            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: ACCENT } }}>
            <TuneRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        {messages.length > 0 && (
          <Tooltip title="議論をリセット">
            <IconButton size="small" onClick={handleReset} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              <RestartAltRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* 題材にしたWeb記事（出典）。リンクで原文を確認しながら議論できる */}
      {sourceRefs.length > 0 && (
        <Box sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }}>
          <Box onClick={() => setSourcesOpen((v) => !v)}
            sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
            <LinkRoundedIcon sx={{ fontSize: 14, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.55)', flex: 1 }}>
              題材にした記事（{sourceRefs.length}）
            </Typography>
            <ExpandMoreRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.35)', transform: sourcesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
          </Box>
          <Collapse in={sourcesOpen}>
            <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {sourceRefs.slice(0, 5).map((s, i) => (
                <Box key={i} onClick={() => void openExternal(s.url)}
                  sx={{ px: 1, py: 0.6, borderRadius: 1, cursor: 'pointer', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
                    '&:hover': { borderColor: 'rgba(229,115,115,0.5)' } }}>
                  <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.8)', fontWeight: 600, lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {s.title}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                    {s.source || 'Web'}{s.summary ? ` — ${s.summary}` : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* スレッド */}
      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {messages.length === 0 && !thinking && (
          <Box sx={{ m: 'auto', textAlign: 'center', px: 2 }}>
            <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.8, mb: 2 }}>
              {discussFirst ? (
                <>この記事を読みながらAIと議論しませんか？<br />
                AIが記事の要点と論点を出し、あなたの意見・経験を聞きます。<br />
                議論を踏まえて、あなたの視点の記事をAIが生成します。</>
              ) : (
                <>この記事についてAIと議論しませんか？<br />
                AIが論点を出し、あなたの意見・経験を聞きます。<br />
                議論した内容は「あなたの主張」として記事に反映できます。</>
              )}
            </Typography>
            {/* 🎭 インタビュアーを選んでから開始（記事ごとに保存される） */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.5)', textAlign: 'center' }}>
                インタビュアーを選ぶ
              </Typography>
              {INTERVIEWER_PRESETS.map((p) => {
                const on = p.id === interviewer.id;
                return (
                  <Box key={p.id} onClick={() => selectInterviewer(p.id)}
                    sx={{ px: 1.25, py: 0.9, borderRadius: 2, cursor: 'pointer',
                      bgcolor: on ? `${ACCENT}14` : 'rgb(var(--brand-fg-rgb) / 0.03)',
                      border: `1px solid ${on ? `${ACCENT}88` : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                      transition: 'border-color .15s, background-color .15s',
                      '&:hover': { borderColor: `${ACCENT}88` } }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)' }}>
                      {p.emoji} {p.label}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.5 }}>{p.desc}</Typography>
                  </Box>
                );
              })}
            </Box>
            <Button variant="contained" startIcon={<ForumRoundedIcon />} onClick={handleStart}
              disabled={!draft?.bodyMarkdown?.trim() && sourceRefs.length === 0}
              sx={{ bgcolor: ACCENT, color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#ef5350' } }}>
              議論を始める
            </Button>
            {!draft?.bodyMarkdown?.trim() && sourceRefs.length === 0 && (
              <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 1 }}>まず本文（下書き）を用意してください</Typography>
            )}
          </Box>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const showChoices = isLast && m.role === 'ai' && !thinking && Array.isArray(m.choices) && m.choices.length > 0;
          // 📄 記事の日本語要約カード（議論ファーストの冒頭）
          if (m.kind === 'summary') {
            return (
              <Box key={i} sx={{ alignSelf: 'stretch', px: 1.5, py: 1.25, borderRadius: 2,
                bgcolor: 'rgba(100,181,246,0.07)', border: '1px solid rgba(100,181,246,0.3)' }}>
                <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: 'light-dark(#095fa5, #90caf9)', letterSpacing: 0.5, mb: 0.5 }}>
                  📄 記事の要約{sourceRefs.some((s) => /[a-zA-Z]/.test(s.title) && !/[ぁ-んァ-ン一-龯]/.test(s.title)) ? '（日本語訳）' : ''}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.82)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
            );
          }
          return (
            <React.Fragment key={i}>
              <Box sx={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                px: 1.5, py: 1, borderRadius: 2,
                bgcolor: m.role === 'user' ? 'rgba(229,115,115,0.16)' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                border: `1px solid ${m.role === 'user' ? 'rgba(229,115,115,0.35)' : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
              }}>
                <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.88)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
              {/* 📖 AIが取り上げた記事内の箇所（写真サムネ／段落の引用）。クリックでリーダーがそこへスクロール */}
              {m.role === 'ai' && Array.isArray(m.refs) && m.refs.length > 0 && liveBlocks.length > 0 && (
                <Box sx={{ alignSelf: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '92%', mt: -0.25 }}>
                  {m.refs.filter((bi) => bi >= 0 && bi < liveBlocks.length).map((bi) => {
                    const b = liveBlocks[bi];
                    if (b.t === 'img' && b.src) {
                      return (
                        <Box key={bi} onClick={() => focusReaderBlockAt(bi)} title="この写真を記事内で表示"
                          sx={{ position: 'relative', cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden',
                            border: '1px solid rgba(229,115,115,0.4)', '&:hover': { borderColor: ACCENT } }}>
                          <Box component="img" src={b.src} alt="" loading="lazy"
                            onError={(e: any) => { e.currentTarget.parentElement.style.display = 'none'; }}
                            sx={{ width: 96, height: 60, objectFit: 'cover', display: 'block' }} />
                          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 0.5, py: 0.1,
                            bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 8.5, fontWeight: 700, textAlign: 'center' }}>
                            📷 記事の写真
                          </Box>
                        </Box>
                      );
                    }
                    const quote = (b.text || '').trim();
                    if (!quote) return null;
                    return (
                      <Chip key={bi} label={quote.length > 22 ? `“${quote.slice(0, 22)}…”` : `“${quote}”`} size="small"
                        onClick={() => focusReaderBlockAt(bi)} title="この箇所を記事内で表示"
                        sx={{ cursor: 'pointer', fontSize: 10.5, height: 24, maxWidth: 220,
                          bgcolor: 'rgba(229,115,115,0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.7)', border: '1px solid rgba(229,115,115,0.3)',
                          '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                          '&:hover': { bgcolor: 'rgba(229,115,115,0.18)', color: 'var(--brand-fg)' } }} />
                    );
                  })}
                </Box>
              )}
              {/* タップだけで答えられる選択肢（最新のAI発言にのみ表示） */}
              {showChoices && (
                <Box sx={{ alignSelf: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 0.75, maxWidth: '92%' }}>
                  {m.choices!.map((c, ci) => (
                    <Chip key={ci} label={c} size="small"
                      onClick={() => callTurn(messages, c)}
                      sx={{ cursor: 'pointer', fontSize: 11.5, fontWeight: 600, height: 26,
                        bgcolor: 'rgba(229,115,115,0.1)', color: 'light-dark(#ad1600, #ffb4a9)', border: '1px solid rgba(229,115,115,0.4)',
                        '&:hover': { bgcolor: '#e57373', color: '#000' } }} />
                  ))}
                </Box>
              )}
            </React.Fragment>
          );
        })}
        {thinking && (
          <Box sx={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1 }}>
            <CircularProgress size={13} sx={{ color: ACCENT }} />
            <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
              {messages.length === 0 && discussFirst ? '記事を読んで要約しています…' : '考え中…'}
            </Typography>
          </Box>
        )}
        {/* 🎯 目安の往復数に到達 → 生成へ促す（続けて話してもOK） */}
        {roundsReached && !thinking && (
          <Box sx={{ alignSelf: 'stretch', px: 1.5, py: 1, borderRadius: 2,
            bgcolor: 'rgba(129,199,132,0.08)', border: '1px solid rgba(129,199,132,0.35)' }}>
            <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.75)', lineHeight: 1.7 }}>
              ✅ 目安の {targetRounds}往復 に達しました。下の「{discussFirst ? '議論から記事を生成する' : '議論を記事に反映する'}」に進めます。
              まだ話し足りなければ続けてOKです。
            </Typography>
          </Box>
        )}
      </Box>

      {/* 入力 */}
      <Box sx={{ p: 1.5, pt: 1, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth multiline maxRows={4} size="small"
            placeholder="あなたの考えを話す…（Enterで送信）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={thinking || messages.length === 0}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'var(--brand-fg)', fontSize: 12.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)',
                '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
            }}
          />
          <IconButton onClick={handleSend} disabled={!input.trim() || thinking || messages.length === 0}
            sx={{ color: ACCENT, bgcolor: 'rgba(229,115,115,0.12)', '&:hover': { bgcolor: 'rgba(229,115,115,0.22)' }, '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}>
            <SendRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Button
          fullWidth variant="contained" onClick={() => void handleReflect()}
          disabled={!userSpoke || reflecting || thinking}
          startIcon={reflecting ? <CircularProgress size={14} sx={{ color: '#000' }} /> : <AutoFixHighRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{ mt: 1, bgcolor: ACCENT, color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, fontSize: 12.5,
            '&:hover': { bgcolor: '#ef5350' }, '&.Mui-disabled': { bgcolor: 'rgba(229,115,115,0.25)', color: 'rgba(0,0,0,0.5)' } }}>
          {reflecting ? (discussFirst ? '生成中…' : '反映中…') : (discussFirst ? '✨ 議論から記事を生成する' : '議論を記事に反映する')}
        </Button>
        {!userSpoke && messages.length > 0 && (
          <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 0.5, textAlign: 'center' }}>
            あなたの発言が1つ以上あると反映できます
          </Typography>
        )}
      </Box>

      <TtsSettingsDialog open={ttsSettingsOpen} onClose={() => setTtsSettingsOpen(false)}
        title="インタビュアーと読み上げの設定"
        extraSection={
          // 🎭 インタビュアー選択（この記事に保存＋既定として記憶。途中で替えると次の発言から反映）
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.8)', mb: 0.25 }}>
              インタビュアー（この記事）
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 1.25, lineHeight: 1.6 }}>
              議論の進め方を選べます。この記事に保存され、次回以降の既定にもなります。
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85 }}>
              {INTERVIEWER_PRESETS.map((p) => {
                const on = p.id === interviewer.id;
                return (
                  <Box key={p.id} onClick={() => selectInterviewer(p.id)}
                    sx={{ px: 1.4, py: 1.1, borderRadius: 2, cursor: 'pointer',
                      bgcolor: on ? `${ACCENT}14` : 'rgb(var(--brand-fg-rgb) / 0.03)',
                      border: `1.5px solid ${on ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
                      transition: 'border-color .15s, background-color .15s',
                      '&:hover': { borderColor: ACCENT } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-fg)', flex: 1 }}>{p.emoji} {p.label}</Typography>
                      {on && <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: ACCENT }}>選択中</Typography>}
                    </Box>
                    <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.55, mt: 0.3 }}>{p.desc}</Typography>
                  </Box>
                );
              })}
            </Box>
            {messages.length > 0 && (
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 1 }}>
                交代すると次の発言から新しいインタビュアーになります
              </Typography>
            )}
          </Box>
        } />
    </Box>
  );
};

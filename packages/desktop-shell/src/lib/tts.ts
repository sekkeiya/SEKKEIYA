/**
 * tts — Web Speech API (speechSynthesis) による日本語読み上げ。
 * WebView2(Windows) / ブラウザ双方で動作し、APIコスト不要。
 * S.Blog（議論の音声モード・リーダーの記事読み上げ）と SEKKEIYA Chat
 * （AI応答の自動読み上げ・文ハイライト・途中再生）で共用する。
 */

let voiceCache: SpeechSynthesisVoice | null = null;

export const isTtsAvailable = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/* ─────────── 読み上げ設定（速度・声・音の高さ）: S.Blog / SEKKEIYA Chat 共通・localStorage永続 ─────────── */
export type TtsEngine = 'standard' | 'ai';
export type AiTtsStyle = 'anchor' | 'audiobook' | 'natural';
export interface TtsSettings {
  rate: number;            // 0.5〜2.0（1.0=標準）。AI音声では再生速度(playbackRate)として適用
  pitch: number;           // 0〜2（1.0=標準）。標準エンジンのみ
  voiceURI: string | null; // 標準エンジンの声。null=自動（日本語の自然な声を優先）
  engine: TtsEngine;       // 'standard'=OS音声（無料・即時） / 'ai'=AI音声（高品質・要通信）
  aiVoice: string;         // AI音声の声（Gemini TTS のプリセット名）
  aiStyle: AiTtsStyle;     // AI音声のトーン（アナウンサー / 朗読 / ナチュラル）
}
const TTS_SETTINGS_KEY = 'sekkeiya-tts-settings';
const DEFAULT_TTS_SETTINGS: TtsSettings = {
  rate: 1.05, pitch: 1.0, voiceURI: null,
  engine: 'standard', aiVoice: 'Kore', aiStyle: 'anchor',
};

function loadTtsSettings(): TtsSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TTS_SETTINGS_KEY) : null;
    if (raw) return { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(raw) };
  } catch { /* 既定 */ }
  return { ...DEFAULT_TTS_SETTINGS };
}
let ttsSettings: TtsSettings = loadTtsSettings();

/** 現在の読み上げ設定を取得（コピー）。 */
export const getTtsSettings = (): TtsSettings => ({ ...ttsSettings });

/** 読み上げ設定を更新して永続化（次の読み上げから反映）。 */
export function setTtsSettings(patch: Partial<TtsSettings>): void {
  ttsSettings = { ...ttsSettings, ...patch };
  voiceCache = null; // 声の選択が変わった可能性 → 再解決
  try { localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(ttsSettings)); } catch { /* noop */ }
}

/** 利用可能な日本語ボイス一覧（設定ダイアログの選択肢用）。 */
export function listJaVoices(): SpeechSynthesisVoice[] {
  if (!isTtsAvailable()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('ja'));
}

/** 使用するボイスを選ぶ（設定で指定があればそれ、無ければ Nanami 等の自然な声を優先）。 */
function pickJaVoice(): SpeechSynthesisVoice | null {
  if (voiceCache) return voiceCache;
  const voices = window.speechSynthesis.getVoices();
  if (ttsSettings.voiceURI) {
    const sel = voices.find((v) => v.voiceURI === ttsSettings.voiceURI);
    if (sel) { voiceCache = sel; return sel; }
  }
  const ja = voices.filter((v) => v.lang?.toLowerCase().startsWith('ja'));
  voiceCache =
    ja.find((v) => /nanami|natural/i.test(v.name)) ||
    ja.find((v) => /female|haruka|ayumi/i.test(v.name)) ||
    ja[0] || null;
  return voiceCache;
}

// 初回は voices が空のことがある → 変化イベントでキャッシュを更新
if (isTtsAvailable()) {
  try { window.speechSynthesis.onvoiceschanged = () => { voiceCache = null; }; } catch { /* noop */ }
}

/**
 * 文単位の分割。表示側（ハイライト・クリックジャンプ）と読み上げ側で
 * 同じ配列インデックスを共有するため、全文字を保持する（join すると元に戻る）。
 */
export function splitSentences(text: string): string[] {
  return String(text || '').split(/(?<=[。！？!?\n])/).filter((s) => s.length > 0);
}

/** 読み上げ用に Markdown 記号・URL を除去する（1文単位）。 */
function cleanForSpeech(sentence: string): string {
  return sentence
    .replace(/[*_#>`]|!\[[^\]]*\]\([^)]*\)|\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .trim();
}

// 読み上げセッション世代。cancel で古い utterance の onend/onerror が遅れて発火しても
// 新しいセッションの状態を壊さないよう、コールバックは現世代のみ有効にする。
let session = 0;

// Chromium はキュー中の utterance への参照が無いと GC してしまい、
// onstart/onend が発火しなくなる（読み上げ自体は続くことがある）既知バグがある。
// セッション中はここに強参照を保持して回避する。
let activeUtterances: SpeechSynthesisUtterance[] = [];

/**
 * 文配列を startIndex から読み上げる。
 * 各文の読み上げ開始時に onSentenceStart(元配列のインデックス) を呼ぶ。
 * onEnd は全文完了時に一度だけ呼ばれる（置き換え/停止された旧セッションでは呼ばれない）。
 */
export function speakSentences(
  sentences: string[],
  opts?: { rate?: number; startIndex?: number; onSentenceStart?: (index: number) => void; onEnd?: () => void },
): void {
  if (!isTtsAvailable()) return;
  const my = ++session;
  const synth = window.speechSynthesis;
  synth.cancel();
  // Chromium は paused のまま cancel すると次の speak が始まらないことがある → 常に解除
  try { synth.resume(); } catch { /* noop */ }

  const start = Math.max(0, opts?.startIndex ?? 0);
  const queue: { idx: number; text: string }[] = [];
  for (let i = start; i < sentences.length; i++) {
    const clean = cleanForSpeech(sentences[i]);
    if (clean) queue.push({ idx: i, text: clean });
  }
  if (queue.length === 0) { opts?.onEnd?.(); return; }

  const voice = pickJaVoice();
  let remaining = queue.length;
  const done = () => {
    if (my !== session) return;
    remaining -= 1;
    if (remaining <= 0) { activeUtterances = []; opts?.onEnd?.(); }
  };
  activeUtterances = queue.map(({ idx, text }) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (voice) u.voice = voice;
    u.rate = opts?.rate ?? ttsSettings.rate;
    u.pitch = ttsSettings.pitch;
    u.onstart = () => { if (my === session) opts?.onSentenceStart?.(idx); };
    u.onend = done;
    u.onerror = done;
    return u;
  });
  activeUtterances.forEach((u) => synth.speak(u));
}

/**
 * テキストを読み上げる（既存の読み上げはキャンセルして置き換え）。
 * 長文は文単位に分割してキューに積む（環境による長さ制限を回避）。
 */
export function speak(text: string, opts?: { rate?: number; onEnd?: () => void }): void {
  speakSentences(splitSentences(text), { rate: opts?.rate, onEnd: opts?.onEnd });
}

/** 読み上げを停止する。 */
export function stopSpeaking(): void {
  if (!isTtsAvailable()) return;
  session += 1; // 旧セッションのコールバックを無効化
  activeUtterances = [];
  try { window.speechSynthesis.resume(); } catch { /* noop */ }
  window.speechSynthesis.cancel();
}

/** 読み上げを一時停止する（resumeSpeaking で続きから再開）。 */
export function pauseSpeaking(): void {
  if (isTtsAvailable()) window.speechSynthesis.pause();
}

/** 一時停止中の読み上げを再開する。 */
export function resumeSpeaking(): void {
  if (isTtsAvailable()) window.speechSynthesis.resume();
}

/** 一時停止中かどうか。 */
export const isSpeechPaused = (): boolean =>
  isTtsAvailable() && window.speechSynthesis.paused;

/** 読み上げ中かどうか。 */
export const isSpeaking = (): boolean =>
  isTtsAvailable() && window.speechSynthesis.speaking;

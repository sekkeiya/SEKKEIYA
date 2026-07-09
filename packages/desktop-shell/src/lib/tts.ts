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
  rate: 1.0, pitch: 1.0, voiceURI: null,
  engine: 'standard', aiVoice: 'Kore', aiStyle: 'anchor',
};

/**
 * 話速の基準倍率。UI上の「標準(1.00x)」を実際の再生ではこの倍率で読む。
 * 素の TTS の 1.0 は体感が遅いため、1.00x=1.3倍速をベースラインとする。
 * 設定値(rate)は 1.00 基準のまま保存し、実再生時にのみ本倍率を掛ける。
 */
export const RATE_BASELINE = 1.3;

/** UI上の rate(1.00基準) を実再生の速度へ変換する。 */
export const toPlaybackRate = (rate: number): number => rate * RATE_BASELINE;

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

/**
 * 読み上げ用にテキストを整える（1文 or 1チャンク単位）。
 * 「そのまま読むと記号を読み上げてしまう」Markdown 記法・URL・絵文字を落とし、
 * AI の応答（箇条書き・表・見出し・強調・コード）も自然に発話できるようにする。
 * 表示側は元テキストのままなので、ここでの除去は発話にのみ効く。
 */
export function cleanForSpeech(sentence: string): string {
  return sentence
    // 画像 ![alt](url) は丸ごと除去（altも読まない）
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // リンク [表示文](url) は表示文だけ残す
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // 生のURL
    .replace(/https?:\/\/\S+/g, '')
    // コードフェンス記号
    .replace(/```+/g, '')
    // 行頭のリストマーカー（- * + ・ / 1. 2) …）・見出し(#)・引用(>)
    .replace(/^[ \t]*(?:[-*+・]|\d+[.)])[ \t]+/gm, '')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>+[ \t]?/gm, '')
    // 水平線・表の区切り行（|---|---|）は行ごと除去
    .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '')
    .replace(/^[ \t]*\|?(?:[ \t]*:?-{2,}:?[ \t]*\|)+[ \t]*$/gm, '')
    // 表のセル区切り | は間（スペース）に
    .replace(/[ \t]*\|[ \t]*/g, '  ')
    // 強調・打消し・インラインコードの記号
    .replace(/[*_`~]/g, '')
    // 絵文字・装飾ピクトグラム・国旗・異体字セレクタ・囲みキーキャップ（読み上げ非対象）
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️⃣]/gu, '')
    // チェックボックス [ ] / [x]
    .replace(/\[[ xX]\]/g, '')
    // 連続空白の圧縮
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * AI音声（段落単位で合成）用に、テキストを発話チャンクへ整える。
 * 表示側の文ハイライトと同じ splitSentences で分割し、各チャンクが
 * 「元テキストの何文目から始まるか」(startSentence) を保持する
 * ＝チャンク再生中にその文をハイライトできる。記号は cleanForSpeech で除去済み。
 */
export function buildSpeechChunks(text: string, maxLen = 180): { text: string; startSentence: number }[] {
  const sentences = splitSentences(text);
  const chunks: { text: string; startSentence: number }[] = [];
  let buf = '';
  let start = -1;
  const flush = () => {
    if (buf.trim()) chunks.push({ text: buf.trim(), startSentence: start });
    buf = '';
    start = -1;
  };
  for (let i = 0; i < sentences.length; i++) {
    const clean = cleanForSpeech(sentences[i]);
    if (!clean) continue;            // 記号だけの行（区切り・画像等）はスキップ
    if (start === -1) start = i;
    buf += (buf ? ' ' : '') + clean;
    if (buf.length >= maxLen) flush(); // 長すぎるチャンクは分割（開始レイテンシ短縮）
  }
  flush();
  return chunks;
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
    u.rate = toPlaybackRate(opts?.rate ?? ttsSettings.rate);
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

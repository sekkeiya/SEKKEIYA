/**
 * aiTts — AI音声（ニューラルTTS）の合成と連続再生。
 *
 * CF `ttsSynthesize`（Gemini TTS）で段落単位に音声を合成し、キューで連続再生する。
 * - 読み間違いが少なく、トーン（アナウンサー/朗読/ナチュラル）を指定できる
 * - 次の段落を再生中にプリフェッチして待ち時間を隠す
 * - 速度は playbackRate で適用（再合成不要）／合成結果はメモリキャッシュ
 * 標準エンジン（lib/tts の Web Speech）と使い分ける。設定は lib/tts の TtsSettings 共通。
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/client';
import { toPlaybackRate } from './tts';
import type { AiTtsStyle } from './tts';

/** AI音声のプリセット声（Gemini TTS）。日本語も自然に読める。迷わないよう女性/男性の2択に絞る。 */
export const AI_VOICES: { name: string; label: string }[] = [
  { name: 'Kore',    label: 'Kore（落ち着いた女性）' },
  { name: 'Charon',  label: 'Charon（落ち着いた男性）' },
];

/** base64 の 16bit PCM を再生可能な WAV Blob に包む。 */
function pcmBase64ToWavBlob(b64: string, sampleRate: number): Blob {
  const bin = atob(b64);
  const pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);

  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  const byteRate = sampleRate * 2; // mono 16bit
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);        // PCM
  v.setUint16(22, 1, true);        // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, 2, true);        // block align
  v.setUint16(34, 16, true);       // bits
  writeStr(36, 'data');
  v.setUint32(40, pcm.length, true);
  return new Blob([header, pcm], { type: 'audio/wav' });
}

// AI音声の利用枠（サーバー側のClaude式時間窓）超過中フラグ。回復時刻まで readFrom は標準音声を使う。
let limitedUntil = 0;
export const isAiTtsLimited = (): boolean => Date.now() < limitedUntil;
/** 回復予定時刻（"HH:MM頃" 表示用。未制限なら null） */
export const aiTtsLimitedUntil = (): number | null => (isAiTtsLimited() ? limitedUntil : null);

// 有料プラン未加入（PLAN_REQUIRED）を一度受けたら、しばらく合成呼び出し自体を止める
// （全チャンクで同じ拒否を食らってCFを無駄撃ちしない）。プラン購入直後に備えて10分でリトライ可。
let planBlockedUntil = 0;
export const isAiTtsPlanBlocked = (): boolean => Date.now() < planBlockedUntil;

// 合成結果のメモリキャッシュ（同じ記事の再読・戻り再生でAPIを叩き直さない）
const cache = new Map<string, Blob>();
const cacheKey = (text: string, voice: string, style: string) => `${voice}|${style}|${text}`;
// 同一チャンクの同時合成を1本化（準備フェーズと再生が並走してもCFを二重に叩かない）
const pending = new Map<string, Promise<Blob>>();

/** 1チャンク（段落）を合成して WAV Blob を返す。
 *  サーバー側に録音キャッシュ（Storage）があり、2回目以降は音声ファイル（audioUrl）が
 *  直接返る＝合成コストゼロ。ここではさらにメモリキャッシュも重ねる。 */
export async function synthesizeAiTts(text: string, opts: { voice: string; style: AiTtsStyle }): Promise<Blob> {
  const key = cacheKey(text, opts.voice, opts.style);
  const hit = cache.get(key);
  if (hit) return hit;
  const inflight = pending.get(key);
  if (inflight) return inflight; // 準備フェーズと再生の同時要求を1本化

  // 枠超過/プラン未加入が判明している間は、CFを呼ばず即座に同じエラーを返す
  // （キャッシュ済みチャンクは上で返る＝取得済み音声は最後まで再生できる）
  if (isAiTtsLimited()) {
    const err: any = new Error('AI音声の利用枠を使い切りました');
    err.code = 'TTS_LIMITED';
    err.resetAt = limitedUntil;
    throw err;
  }
  if (isAiTtsPlanBlocked()) {
    const err: any = new Error('AI音声は有料プランでご利用いただけます');
    err.code = 'PLAN_REQUIRED';
    throw err;
  }

  const task = (async () => {
    const fn = httpsCallable(functions, 'ttsSynthesize');
    const r: any = await fn({ text, voice: opts.voice, style: opts.style });
    if (!r.data?.success) {
      // 利用枠超過（Claude式・時間窓リセット）: 回復時刻までAI音声を封印し、呼び出し側は標準音声へフォールバック
      if (r.data?.code === 'TTS_LIMITED') {
        limitedUntil = Number(r.data?.resetAt) || Date.now() + 30 * 60e3;
      }
      if (r.data?.code === 'PLAN_REQUIRED') {
        planBlockedUntil = Date.now() + 10 * 60e3;
      }
      const err: any = new Error(r.data?.reason || 'AI音声の生成に失敗しました');
      err.code = r.data?.code; // 'PLAN_REQUIRED' | 'TTS_LIMITED' など
      err.resetAt = r.data?.resetAt;
      throw err;
    }
    let blob: Blob;
    if (r.data.audio) {
      blob = pcmBase64ToWavBlob(r.data.audio, Number(r.data.sampleRate) || 24000);
    } else if (r.data.audioUrl) {
      // サーバーの録音キャッシュにヒット → 音声ファイルを取得（合成なし）
      const res = await fetch(r.data.audioUrl);
      if (!res.ok) throw new Error('キャッシュ音声の取得に失敗しました');
      blob = await res.blob();
    } else {
      throw new Error('AI音声の生成に失敗しました');
    }
    if (cache.size > 200) cache.clear(); // 念のための上限
    cache.set(key, blob);
    return blob;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

export interface AiPlayCallbacks {
  /** チャンク再生開始（配列インデックス） */
  onChunkStart?: (index: number) => void;
  /** 全チャンク自然完了時のみ（stop では呼ばれない） */
  onEnd?: () => void;
  /** 合成/再生エラー。既定はそのチャンクをスキップして継続。
   *  info.code が 'TTS_LIMITED' / 'PLAN_REQUIRED' なら以降の全チャンクも失敗するため、
   *  呼び出し側は stop() して標準音声へ切り替えるのが正しい（info.index = 失敗チャンク位置）。 */
  onError?: (message: string, info?: { index: number; code?: string }) => void;
}

/**
 * 全チャンクを事前合成する（準備フェーズ）。並列3で回し、進捗を onProgress で通知。
 * サーバー/メモリのキャッシュに載るため、この後の play() は途切れず連続再生できる。
 * 個別チャンクの失敗はここでは握りつぶす（play 側でスキップ）。中断は shouldStop で確認。
 */
export async function prepareAiTts(
  chunks: string[],
  opts: { voice: string; style: AiTtsStyle },
  cb?: { onProgress?: (done: number, total: number) => void; shouldStop?: () => boolean; onError?: (message: string, code?: string) => void },
): Promise<void> {
  let done = 0;
  const total = chunks.length;
  cb?.onProgress?.(0, total);
  for (let i = 0; i < chunks.length; i += 3) {
    // 枠超過/プラン未加入が確定したら以降の合成は無意味（全て同じ拒否）なので打ち切る。
    // 再生側は取得済みキャッシュを使い切ったところで標準音声へフォールバックする。
    if (cb?.shouldStop?.() || isAiTtsLimited() || isAiTtsPlanBlocked()) return;
    await Promise.all(chunks.slice(i, i + 3).map(async (text) => {
      try {
        await synthesizeAiTts(text, opts);
      } catch (e: any) {
        cb?.onError?.(String(e?.message || e), e?.code);
      }
      done += 1;
      cb?.onProgress?.(done, total);
    }));
  }
}

/** 段落チャンクの連続再生プレーヤー（1インスタンス=1セッション）。 */
export class AiTtsPlayer {
  private audio: HTMLAudioElement = new Audio();
  private stopped = false;

  /** chunks を順に合成・再生する。次チャンクは再生中にプリフェッチ。 */
  async play(
    chunks: string[],
    opts: { voice: string; style: AiTtsStyle; rate?: number },
    cb: AiPlayCallbacks = {},
  ): Promise<void> {
    this.stopped = false;
    const synth = (i: number) => synthesizeAiTts(chunks[i], opts);
    let nextPromise: Promise<Blob> | null = chunks.length ? synth(0) : null;
    for (let i = 0; i < chunks.length; i++) {
      if (this.stopped) return;
      let blob: Blob | null = null;
      try {
        blob = await nextPromise!;
      } catch (e: any) {
        cb.onError?.(String(e?.message || e), { index: i, code: e?.code });
      }
      if (this.stopped) return;
      nextPromise = i + 1 < chunks.length ? synth(i + 1) : null;
      if (!blob) continue; // 失敗チャンクはスキップして続行
      cb.onChunkStart?.(i);
      await this.playBlob(blob, opts.rate ?? 1);
    }
    if (!this.stopped) cb.onEnd?.();
  }

  private playBlob(blob: Blob, rate: number): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const done = () => { URL.revokeObjectURL(url); resolve(); };
      this.audio.src = url;
      this.audio.playbackRate = Math.min(3, Math.max(0.5, toPlaybackRate(rate)));
      this.audio.onended = done;
      this.audio.onerror = done;
      this.audio.play().catch(done);
    });
  }

  stop(): void {
    this.stopped = true;
    try { this.audio.pause(); this.audio.src = ''; } catch { /* noop */ }
  }

  /** 現在チャンクの再生を一時停止する（合成待ち中は次の再生開始が保留されるだけ）。 */
  pause(): void {
    try { this.audio.pause(); } catch { /* noop */ }
  }

  /** 一時停止中のチャンクを続きから再開する（再生済みチャンクを巻き戻さない）。 */
  resume(): void {
    try {
      if (this.audio.paused && !this.audio.ended && this.audio.src) {
        void this.audio.play().catch(() => { /* noop */ });
      }
    } catch { /* noop */ }
  }
}

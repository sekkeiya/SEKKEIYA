/**
 * movieComposeArgs.ts — S.Movie v0 自動編集エンジンの中核（docs/14 Step 2）
 *
 * 編集指示 JSON（ComposeSpec）から ffmpeg の引数列（filter_complex 含む）を
 * 純関数で生成する。プロセス実行は Rust 側 compose_movie の責務。
 *
 * フィルタグラフの構成:
 *   1. 各クリップを正規化: trim → fps → scale+pad（レターボックス）→ setsar → yuv420p
 *      入力が全て同一条件（Cycles 出力）でも、混在素材を許容するため常に正規化する
 *   2. 隣接クリップを順に結合: cut は concat、xfade/fade は xfade フィルタ
 *      （xfade の offset は「それまでの合計尺 − トランジション尺」の累積で計算）
 *   3. テロップ: drawtext を enable='between(t,...)' で時間指定
 *   4. 音声: BGM を全体尺にトリム + 終端フェードアウト。ナレーションがあれば
 *      sidechaincompress でダッキングして amix
 */
import type { ComposeSpec, ComposeClip, MovieOverlay } from '../types';

export interface BuildComposeArgsOptions {
  /** check_ffmpeg の h264Encoders 先頭を渡す（無ければ libx264） */
  encoder: string;
  /** drawtext 用フォントファイル（日本語対応必須）。resolveJpFontFile() を渡す */
  fontFile: string | null;
}

export interface BuildComposeArgsResult {
  /** compose_movie に渡す引数列（-y / -progress は Rust 側が付与） */
  args: string[];
  /** 進捗計算用の出力合計尺（秒） */
  totalDurationSec: number;
}

/** クリップの実効尺（トリム適用後、秒） */
export function effectiveClipDuration(clip: ComposeClip): number {
  if (clip.trim) {
    return Math.max(0, Math.min(clip.trim.outSec, clip.durationSec) - clip.trim.inSec);
  }
  return clip.durationSec;
}

/** シーケンス全体の出力尺（xfade の重なり分を差し引く） */
export function totalSequenceDuration(clips: ComposeClip[]): number {
  let total = 0;
  clips.forEach((clip, i) => {
    total += effectiveClipDuration(clip);
    const tr = clip.transitionAfter;
    if (i < clips.length - 1 && tr && tr.type !== 'cut') {
      total -= tr.durationSec;
    }
  });
  return Math.max(0, total);
}

/**
 * drawtext の text 値エスケープ。
 * 値は '...' でクォートして渡すため、ffmpeg のトークン解析（av_get_token）で
 * 特殊なのは `\`（クォート内でもエスケープ文字）と `'` のみ。
 * `:` `,` `%` 等はクォートが保護する（drawtext 側は expansion=none で展開無効）。
 */
export function escapeDrawtextText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Windows パスを ffmpeg フィルタ引数用に変換（\ → /、ドライブの : をエスケープ） */
export function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

function overlayPositionExpr(o: MovieOverlay): { x: string; y: string } {
  switch (o.position ?? 'center') {
    case 'bottomLeft':
      return { x: 'h*0.06', y: 'h-text_h-h*0.08' };
    case 'bottomCenter':
      return { x: '(w-text_w)/2', y: 'h-text_h-h*0.08' };
    case 'center':
    default:
      return { x: '(w-text_w)/2', y: '(h-text_h)/2' };
  }
}

function encoderArgs(encoder: string): string[] {
  switch (encoder) {
    case 'h264_nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-cq', '19', '-b:v', '0'];
    case 'h264_amf':
      return ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', '19', '-qp_p', '21'];
    case 'h264_qsv':
      return ['-c:v', 'h264_qsv', '-global_quality', '19'];
    case 'h264_videotoolbox':
      return ['-c:v', 'h264_videotoolbox', '-b:v', '12M'];
    case 'libx264':
    default:
      return ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18'];
  }
}

export function buildComposeArgs(
  spec: ComposeSpec,
  opts: BuildComposeArgsOptions,
): BuildComposeArgsResult {
  const { clips, overlays = [], bgm, narration, output } = spec;
  if (clips.length === 0) {
    throw new Error('クリップが 1 つもありません');
  }
  for (const c of clips) {
    if (effectiveClipDuration(c) <= 0) {
      throw new Error(`クリップの実効尺が 0 です: ${c.path}`);
    }
  }

  const totalDurationSec = totalSequenceDuration(clips);
  const { width: W, height: H, fps: FPS } = output;

  const args: string[] = [];
  const filters: string[] = [];

  // ── 入力 ──────────────────────────────────────────────────────
  clips.forEach((c) => {
    args.push('-i', c.path);
  });
  let bgmInputIndex = -1;
  if (bgm) {
    bgmInputIndex = clips.length;
    // BGM が短くても全体尺をカバーできるようループ入力にする
    args.push('-stream_loop', '-1', '-i', bgm.path);
  }
  let narrationInputIndex = -1;
  if (narration) {
    narrationInputIndex = bgm ? clips.length + 1 : clips.length;
    args.push('-i', narration.path);
  }

  // ── 1. クリップ正規化 ─────────────────────────────────────────
  clips.forEach((c, i) => {
    const trim = c.trim
      ? `trim=start=${c.trim.inSec}:end=${Math.min(c.trim.outSec, c.durationSec)},setpts=PTS-STARTPTS,`
      : '';
    filters.push(
      `[${i}:v]${trim}fps=${FPS},` +
        `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,format=yuv420p[v${i}]`,
    );
  });

  // ── 2. 結合（concat / xfade チェーン） ────────────────────────
  let currentLabel = 'v0';
  let currentDur = effectiveClipDuration(clips[0]);
  for (let i = 1; i < clips.length; i++) {
    const prev = clips[i - 1];
    const tr = prev.transitionAfter ?? { type: 'cut' as const, durationSec: 0 };
    const next = `v${i}`;
    const out = i === clips.length - 1 ? 'vseq' : `m${i}`;
    const nextDur = effectiveClipDuration(clips[i]);

    if (tr.type === 'cut' || tr.durationSec <= 0) {
      filters.push(`[${currentLabel}][${next}]concat=n=2:v=1:a=0[${out}]`);
      currentDur += nextDur;
    } else {
      // xfade の重なり尺はどちらのクリップよりも短くする
      const td = Math.min(tr.durationSec, currentDur - 0.05, nextDur - 0.05);
      const transition = tr.type === 'fade' ? 'fadeblack' : 'fade';
      const offset = (currentDur - td).toFixed(3);
      filters.push(
        `[${currentLabel}][${next}]xfade=transition=${transition}:duration=${td.toFixed(3)}:offset=${offset}[${out}]`,
      );
      currentDur = currentDur - td + nextDur;
    }
    currentLabel = out;
  }
  if (clips.length === 1) {
    filters.push(`[v0]null[vseq]`);
  }

  // ── 3. テロップ ───────────────────────────────────────────────
  let videoOutLabel = 'vseq';
  if (overlays.length > 0) {
    if (!opts.fontFile) {
      throw new Error('テロップにはフォントファイルの指定が必要です（resolveJpFontFile が解決できませんでした）');
    }
    const fontfile = escapeFilterPath(opts.fontFile);
    const drawtexts = overlays.map((o) => {
      const fontsize = o.fontSizePx ?? Math.round(H / 12);
      const { x, y } = overlayPositionExpr(o);
      const end = (o.atSec + o.durationSec).toFixed(3);
      return (
        // expansion=none: %{...} 展開を使わないため無効化（% や \ を含むテロップを安全に）
        `drawtext=expansion=none:fontfile='${fontfile}':text='${escapeDrawtextText(o.text)}':` +
        `fontsize=${fontsize}:fontcolor=white:borderw=2:bordercolor=black@0.55:` +
        `x=${x}:y=${y}:enable='between(t,${o.atSec.toFixed(3)},${end})'`
      );
    });
    filters.push(`[vseq]${drawtexts.join(',')}[vtext]`);
    videoOutLabel = 'vtext';
  }

  // ── 4. 音声 ───────────────────────────────────────────────────
  let audioOutLabel: string | null = null;
  if (bgm) {
    const vol = bgm.volume ?? 0.35;
    const fadeStart = Math.max(0, totalDurationSec - 1.5).toFixed(3);
    const bgmChain =
      `[${bgmInputIndex}:a]atrim=0:${totalDurationSec.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `volume=${vol},afade=t=out:st=${fadeStart}:d=1.5`;

    if (narration && bgm.ducking !== false) {
      // ナレーションをサイドチェーンにして BGM を自動で下げる
      filters.push(`${bgmChain}[bgmpre]`);
      filters.push(`[${narrationInputIndex}:a]asplit=2[narr][narrsc]`);
      filters.push(
        `[bgmpre][narrsc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[bgmduck]`,
      );
      filters.push(`[bgmduck][narr]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]`);
    } else {
      filters.push(`${bgmChain}[aout]`);
    }
    audioOutLabel = 'aout';
  } else if (narration) {
    filters.push(`[${narrationInputIndex}:a]apad,atrim=0:${totalDurationSec.toFixed(3)}[aout]`);
    audioOutLabel = 'aout';
  }

  // ── 出力 ──────────────────────────────────────────────────────
  args.push('-filter_complex', filters.join(';'));
  args.push('-map', `[${videoOutLabel}]`);
  if (audioOutLabel) {
    args.push('-map', `[${audioOutLabel}]`, '-c:a', 'aac', '-b:a', '192k');
  }
  args.push(...encoderArgs(opts.encoder));
  args.push('-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart');
  args.push('-t', totalDurationSec.toFixed(3));
  args.push(output.path);

  return { args, totalDurationSec };
}

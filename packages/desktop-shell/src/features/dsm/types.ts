/**
 * S.Movie (dsm / 3dsm) 型定義 — docs/14_s_movie_spec.md
 *
 * v0 スコープ: 「編集指示 JSON → ffmpeg フィルタグラフ → mp4」の自動編集エンジン。
 * カット（シーン参照 + カメラパス）のフルモデルは Step 3 で導入し、
 * v0 では「クリップ = ローカル mp4 パス + トリム + トランジション」まで扱う。
 *
 * 動画ファイルはローカル完結（クラウドへはメタデータ JSON のみ）。
 */

/** カット間トランジション。xfade = クロスフェード、fade = 黒を挟むフェード */
export type MovieTransitionType = 'cut' | 'xfade' | 'fade';

export interface MovieTransition {
  type: MovieTransitionType;
  /** cut の場合は無視される */
  durationSec: number;
}

/** v0 のコンポーズ対象クリップ（実体はローカル mp4） */
export interface ComposeClip {
  /** ローカル mp4 の絶対パス */
  path: string;
  /** 素材の尺（秒）。probe_video で取得した値を渡す */
  durationSec: number;
  /** トリム（省略時は素材全体） */
  trim?: { inSec: number; outSec: number };
  /** このクリップの「後ろ」に入るトランジション（最後のクリップでは無視） */
  transitionAfter?: MovieTransition;
}

/** テロップ（v0 は title のみ。位置はプリセット） */
export interface MovieOverlay {
  type: 'title';
  text: string;
  atSec: number;
  durationSec: number;
  /** 省略時は出力高さの 1/12 */
  fontSizePx?: number;
  /** 省略時 center */
  position?: 'center' | 'bottomLeft' | 'bottomCenter';
}

export interface MovieBgm {
  /** ローカル音声ファイルの絶対パス（mp3 / m4a / wav） */
  path: string;
  /** 0..1（省略時 0.35）。BGM は控えめが既定 */
  volume?: number;
  /** ナレーション入力がある場合に sidechaincompress でダッキング */
  ducking?: boolean;
}

/** 編集指示 JSON（v0 受け入れ基準の入力）。チャットの MOVIE_* ツールが生成する */
export interface ComposeSpec {
  clips: ComposeClip[];
  overlays?: MovieOverlay[];
  bgm?: MovieBgm;
  /** ナレーション音声（あれば BGM をダッキング） */
  narration?: { path: string };
  output: {
    /** 出力 mp4 の絶対パス */
    path: string;
    /** 16:9 → 1920x1080、9:16 → 1080x1920 を呼び出し側で解決して渡す */
    width: number;
    height: number;
    fps: number;
  };
}

/** check_ffmpeg の戻り値 */
export interface FfmpegInfo {
  path: string;
  version: string;
  /** 優先度順の H.264 エンコーダ（先頭が HW、末尾フォールバック libx264） */
  h264Encoders: string[];
}

export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}

export interface ComposeProgress {
  outSec: number;
  totalSec: number;
  pct: number;
}

export interface FfmpegDownloadProgress {
  downloaded: number;
  total: number;
  pct: number;
  phase: 'downloading' | 'extracting' | 'done';
}

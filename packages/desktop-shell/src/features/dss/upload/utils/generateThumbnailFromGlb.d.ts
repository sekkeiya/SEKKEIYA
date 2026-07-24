/**
 * generateThumbnailFromGlb.js の型宣言。
 * 実装（.js）のシグネチャと戻り値に合わせて記述している。実装を変えたらここも更新すること。
 */

export interface GenerateThumbnailOptions {
  /** 出力画像の幅（px）。既定 1024。 */
  width?: number;
  /** 出力画像の高さ（px）。既定 1024。 */
  height?: number;
  /** WebP の品質（0〜1）。既定 0.9。 */
  quality?: number;
}

export interface GenerateThumbnailResult {
  blob: Blob;
  file: File;
  width: number;
  height: number;
}

/**
 * GLB ファイルからサムネイル画像（WebP）を生成する。
 * カメラはモデルの外接球が画角に収まる位置へ自動配置される。
 */
export function generateThumbnailFromGlb(
  glbFile: File,
  options?: GenerateThumbnailOptions,
): Promise<GenerateThumbnailResult>;

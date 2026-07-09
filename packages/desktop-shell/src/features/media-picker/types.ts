// 汎用メディアピッカー（S.Blog 本文 / 将来はサイトエンジン等から再利用）の共通型。
// 各アイテムは「表示用サムネ」と「埋め込み用の実体URL」を必ず持つ。

export type MediaKind = 'image' | 'video';

/** どのデータ層から来たか（バッジ/属性表示用）。 */
export type MediaSource = 'drive' | 'project' | 'gallery';

export interface MediaPickerItem {
  /** 一意キー（source:docId）。 */
  id: string;
  /** 本文に埋め込む実体 URL（画像のsrc / 動画のsrc）。 */
  url: string;
  /** グリッド表示用サムネ（無ければ url を流用）。 */
  thumbnailUrl: string;
  kind: MediaKind;
  title?: string;
  source: MediaSource;
  /** 著者（Gallery の他者素材で出典表示に使う）。 */
  authorId?: string;
  authorName?: string;
}

export const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;
export const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif)(\?|$)/i;

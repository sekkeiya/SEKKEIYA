// 3Dビューア共通の環境マップ設定。
// drei の preset("city" 等) は外部CDN(raw.githack)からHDRを取得するため、
// 初回表示が数秒〜十数秒ブロックされる。同じHDRを public/hdr に同梱し
// ローカル配信することで、オフラインでも即ロードできるようにする。
export const VIEWER_ENVIRONMENT = { files: '/hdr/potsdamer_platz_1k.hdr' } as const;

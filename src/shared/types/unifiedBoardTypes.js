/**
 * @typedef {Object} UnifiedBoard
 * @property {string} id - ボードID
 * @property {string} name - ボード名
 * @property {'personal' | 'team' | 'public'} boardType - ボードの種類
 * @property {string} ownerId - 所有者UID (1つに統一)
 * @property {string[]} memberIds - 参加メンバーのUID配列 (Teamの場合のみ)
 * @property {'public' | 'private' | 'team'} visibility - 公開範囲 ("public"になることで公開ギャラリーに表示)
 * @property {number} itemCount - 表示用キャッシュ: アイテム数
 * @property {string|null} coverThumbnailUrl - 表示用キャッシュ: カバー画像 (null許容)
 * @property {string|null} lastActivityAt - 最終更新/活動日時 (ISO文字列、未定義時はnull)
 * @property {string|null} createdAt - 作成日時 (ISO文字列、未定義時はnull)
 * @property {string|null} updatedAt - 更新日時 (ISO文字列、未定義時はnull)
 * @property {number} schemaVersion - スキーマバージョン (旧データは 1, 新データは 2)
 * @property {string} sourceApp - 作成元アプリ ('sekkeiya', '3dss', etc)
 */

/**
 * @typedef {Object} UnifiedBoardItem
 * @property {string} id - アイテムのドキュメントID (自動ID生成推奨)
 * @property {string} boardId - 所属するボードのID
 * @property {'model' | 'layout' | 'drawing' | 'render' | 'movie' | 'slide' | 'article'} itemType - ボード上のアイテム種類
 * @property {string} entityType - クエリ用: 実体の種類 (例: 'model', 'layout')
 * @property {string} entityId - クエリ用: 実体のID (例: 'modelXYZ')
 * @property {string} itemRef - 実体ドキュメントへのFirestore相対パス (例: 'models/modelXYZ')
 * @property {string} addedBy - 追加したユーザーのUID (ボードのownerIdとは必ずしも一致しない)
 * @property {number} sortOrder - ボード内での表示順序 (0がデフォルト)
 * @property {number} schemaVersion - スキーマバージョン (旧データは 1, 新データは 2)
 * @property {string|null} createdAt - 作成日時 (ISO文字列)
 * @property {string|null} updatedAt - 更新日時 (ISO文字列)
 * @property {string} sourceApp - 作成元アプリ
 * @property {Object} snapshot - 表示用キャッシュ (Viewerが即座に描画するための最小データ)
 * @property {string} snapshot.title - タイトル
 * @property {string|null} snapshot.thumbnailUrl - サムネイルURL
 * @property {string} snapshot.fileType - ファイル形式等のメタデータ
 * @property {string} snapshot.previewType - プレビューコンポーネント用タイプ ('image' | '3d' | 'video' | 'iframe')
 * @property {string|undefined} [snapshot.subtitle] - UI補助情報 (オプショナル)
 */

// このファイルはJSDoc型定義用のため、主要な実装はエクスポートしません。
export {};

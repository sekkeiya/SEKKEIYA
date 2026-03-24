# Firestore Source of Truth & Data Projection Rules (Phase 3)

本ドキュメントでは、Firestore 内の各コレクションが「正本 (Source of Truth: SSOT)」であるか「派生 (Derived Index/Mirror)」であるかを定義し、連携の責務を明文化します。

---

## 📐 1. モデル系 (Models)

### SSOT: `users/{uid}/models/{modelId}`
ユーザーがアップロード・作成した 3D モデルや素材の完全な正本データ。

#### 性質
*   すべてのメタデータ、価格、カテゴリ、サイズ、S3/Storage への生パスを保持する。
*   モデルの削除処理（物理削除 or 論理削除）は、ここが起点となる。

### Derived: `publicModelIndex`
公開モデルの検索・一覧表示用インデックス。

#### 更新責務とルール
*   **更新責務:** クライアントサイドでのアクション（API 関数）。`visibility` 変更時やプロパティ更新時にクライアントから `syncPublicModelIndex` 等を用いて二重書き込みを行う。
*   **二重同期防止:** API層でカプセル化（例：`updatePublicModelIndexPartial`）することで二重の不要な書き込みを防ぐ。サーバーサイド(Functions)の関与はない。
*   **整合性修復:** 定期バッチやマイグレーションスクリプト(`migratePublicModelIndex.cjs`)を用いて、元の `models` ドキュメントの `visibility === 'public'` であるか突合し、不整合があればインデックスをリビルド・削除する。
*   **Visibility変更ルール:** `"public"` ならば `setDoc({ merge: true })` で作成し、`"private"` に変更された瞬間に `deleteDoc` でインデックスから物理削除する。
*   **最小Projection要件:** `ownerId, handle, title, thumbnailUrl, price, mainCategory, subCategory, detailCategory, tags, dimensions, files, createdAt` のみ（現在の実装実態およびカード表示の要件に合わせる）。長文の description や重い変換メタデータは表示時（個別取得）で引くように設計する。

### Derived: `users/{uid}/driveAssets`
AI Drive の UI 操作および検索用に最適化されたアセットの投射。

#### 更新責務とルール
*   **更新責務:** Cloud Functions (`sekkeiya/functions/models/sync.js`)。
*   **仕様:** `users/{uid}/models/{modelId}` に変更が加わると自動トリガーし、`asset-3dss-{modelId}` を作成・更新する。
*   **設計論点 (3DSS 冗長データ):**
    Driveのインターフェースに必要なのは名前やサムネイル、拡張子程度。
    過度な価格情報や3DSS特有のカテゴリマッピング設定まで `driveAssets` に同期するのは冗長。`type`, `sourceApp: "3DSS"`, `sourceAssetId: modelId` さえあれば、詳細は実体から引ける。

---

## 🗂️ 2. ボード系 (Boards & Items)

### SSOT: `boards/{boardId}`
ボード構造のメタデータ（タイトル、オーナー、参加メンバー配列、公開状態）。

### SSOT: `boards/{boardId}/items/{itemId}`
ボード内に配置された要素（モデル、画像、テキスト等）の実体定義。

#### サブコレ構造の性質
*   **コピーではなく「参照＋スナップショット」:**
    格納されているのは `entityId` (元のモデルID等) と `itemRef` (元のパス) であり、データの実体コピーではない。
*   **スナップショットの理由:**
    一覧表示で元のモデルデータを `Promise.all` してN件引くと read 爆発を起こすため、ボードアイテム登録時の最小情報 (`title`, `thumbnailUrl`) だけを `snapshot` に保持している。

### Legacy: `users/{uid}/myBoards`, `users/{uid}/teamBoards`, `teamBoards`
*   旧アーキテクチャにおける SSOT だったが、現在は Unified Schema `boards` への移行により、**これらは SSOT ではなくなった完全なレガシー（廃棄対象）**である。

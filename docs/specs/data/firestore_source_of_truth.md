# Firestore Source of Truth

## 目的
本ドキュメントは、SEKKEIYAエコシステムのデータベース（Firestore）において「何が正規なデータ（Source of Truth）であるか」を定義します。
「1 Project = 1 Website」という設計思想に則り、すべての成果物はProjectを頂点としたセクション構造として保存されます。

## 正規コレクション一覧 (最新仕様)
現時点において、単一情報源（Single Source of Truth）として扱われるべき正規のルート・コレクションは以下の通りです。
* `users`
* `projects`
* `assets` (Global Master Asset Layer)
* `publicProjectIndex`
* `publicModelIndex`

## 廃止済み構造 (今後使用禁止)
以下の古い概念・コレクションは構造転換に伴い完全に廃止（またはmigration対象）となります。新たなコードからのRead/Writeは禁止します。
* `/models` （Root階層の全体モデル一覧 -> 今後は `/assets` をGlobal Layerとして用いる）
* `boards`, `teamBoards`, `teamBoardInvitations` （Board概念そのものの廃止、Projectへ完全統合）
* `/articles` （Root）

## Project 関連の正規パス (1 Project = 1 Website 構造の Source of Truth)
最新のSEKKEIYAアーキテクチャでは、**`projects` コレクションを中心とした構造こそが唯一の正規ソース**となります。
ProjectはWebサイトとしての成果物であり、データは各セクション（サブコレクション）として格納されます。

## 3層アーキテクチャの責務分離 (Global Master Asset Architecture)
SEKKEIYA全体において、3Dモデルなどのデータは以下の3層に明確に分離されます。

1. **Project (`projects`): 文脈のSSOT**
   - 案件・権限・チーム・AI文脈の中心。
   - SEKKEIYAの世界観上の主軸。
2. **Item (`workspaces/{workspaceId}/items`): 利用・配置・表示のSSOT**
   - 実体データそのものではなく、軽量な参照レコード。
   - `assetRef` を持ち、表示名、配置位置、画面UI上で必要なメタデータのみを持つ。
   - 実体は複製して保有しない。
3. **Asset (`assets`): 実体データのSSOT**
   - 3Dモデルの実ファイル、共通メタデータ、Storageパスを持つ、プロジェクトから独立したグローバルレイヤー。
   - SEKKEIYA 共通の Global Master Asset Layer です。
   - *注意:* `downloadUrl`は一時的な参照目的とし、正規のリンク元としては**`storagePath`を正**とします。

※ 過去の `items` ベースの Global Hub 対象データは、既存レコードとの整合性を考慮し**別途移行バッチによる `assets` への変換**を実施します（今回は新規アップロード分からこの構造を適用）。

* プロジェクトメタデータ (Landing / Overview): `projects/{projectId}`
* モデリングアセット: `projects/{projectId}/models/{modelId}`
* 図面・レイアウト: `projects/{projectId}/drawings/{drawingId}`
* レンダリング画像: `projects/{projectId}/renders/{renderId}`
* 動画: `projects/{projectId}/movies/{movieId}`
* 記事・テキスト: `projects/{projectId}/articles/{articleId}`
* スライド: `projects/{projectId}/slides/{slideId}`
* 分析データ: `projects/{projectId}/analysis/{analysisId}`

※レガシーの `projects/{projectId}/boards/{boardId}` は廃止され、上記フラットなセクション構成に移行します。

## 子アプリが従うべき保存ルール
**「子アプリは独自の root schema（ルートコレクション）を増やしてはいけません」**
* 3DSS, 3DSL, 3DSP 等は、「Project Web Site の特定のセクションを作り上げるための生成ジェネレータ（機能アプリ）」に過ぎません。
* 各アプリは出力結果を、自身が担当する `projects/{projectId}/<section>` に送信・保存しなければなりません。
* 【例外】共有価値のあるグローバル資産（公開3Dモデル等）は、特定のアプリ専用ではないため `/assets` を共通のマスター層として利用します。

## 公開 / 非公開データの扱い
* **Project レベルの公開**: プロジェクトはEdit Mode, Internal View, Public Viewを持ちます。
* 公開URL（例: `/p/:publicSlug`）を用いたアクセス時には、`projects` コレクション側のメタデータやフラグに基づいてサイトとしての閲覧権限が制御されます。

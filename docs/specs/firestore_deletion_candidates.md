# Firestore Deletion Candidates

本番DBから安全にパージ可能なコレクションと、その対応方針の整理。
いずれもUnified Schema（Project -> Board）への移行に伴い発生した残骸や、使われなくなった旧機能のコレクションです。

## teamBoards
- 用途: 旧アーキテクチャにおける複数人共有ボードの実体
- 現在の使用状況: 未稼働。実データはSoft/Hard Delete済み。
- 実データ件数: 0件（Phase 9にてHard Delete実施済み）
- 依存箇所: `api/boards/teamBoards.js` (本来は削除済みのファイル)、`firestore.rules` のマッチ、各種移行スクリプト
- 削除可否: **削除可能 (A)**
- 削除前注意点: レガシーAPIファイルや `.rules` に残る古い参照パスのルールの掃除が必要。
- 推奨アクション: Firebase Console からコレクション自体が表示されていれば削除（実質空）。残存するRules、Functions、レガシーAPIクライアント側の不要コードの完全撤去を実行する。

## teamBoardInvitations
- 用途: 旧 `teamBoards` への招待フローを管理するコレクション
- 現在の使用状況: 機能完全廃止済み。現在のボードは Unified Schema (boards) の members 配列などで直接アクセス権限を制御している。
- 実データ件数: 不明 (Consoleで確認要、おそらく数件のテスト残骸)
- 依存箇所: 旧API `api/boards/teamBoards.js`、`firestore.rules` (\`match /teamBoardInvitations\`)
- 削除可否: **削除可能 (A)**
- 削除前注意点: なし。
- 推奨アクション: Firebase Console からコレクション実データを一括削除し、`firestore.rules` 内の記述を削除する。

## layoutShares
- 用途: 旧 3DSL (3D Shape Layout) におけるレイアウト設定の単発共有用リンクデータ
- 現在の使用状況: 未稼働。現在の 3DSL は boards 経由でデータを保存・共有する。
- 実データ件数: 不明 (おそらく昔の残骸のみ)
- 依存箇所: コードベース上に参照箇所なし (0マッチ)
- 削除可否: **削除可能 (A)**
- 削除前注意点: 完全に孤立しているため副作用なし。
- 推奨アクション: Firebase Consoleからの即時一括コレクション（ドキュメント）削除。

## publicModelIndex
- 用途: 全体の公開モデルを検索するためのインデックスコレクション（旧構想）
- 現在の使用状況: 廃止。検索は `tags` コレクションや 別サービス、あるいは Drive 検索機能に集約・移行済み。
- 実データ件数: 不明
- 依存箇所: ドキュメント内での言及のみ。実稼働コードなし。
- 削除可否: **削除可能 (A)**
- 削除前注意点: なし。
- 推奨アクション: コレクション削除。

## viewerShares
- 用途: 3D Master Viewer用の読み取り専用共有リンク発行機能
- 現在の使用状況: 使用されていない。パブリックな共有は Unified boards や `boardsPublic` に移行済み。
- 実データ件数: 不明
- 依存箇所: `firestore.rules` に1箇所のみ (`match /viewerShares/{shareId}`)
- 削除可否: **削除可能 (A)**
- 削除前注意点: なし。
- 推奨アクション: コレクション削除および `firestore.rules` からのエントリ削除。

## articles (Root Collection)
- 用途: ユーザーがパブリックに投稿する記事データ（旧構想）
- 現在の使用状況: 未稼働。新アーキテクチャでは、記事は各ボードのサブコレクション (`boards/{boardId}/articles`) として管理されている。公式記事は `officialArticles` を使用している。
- 実データ件数: 不明
- 依存箇所: `firestore.rules` 内 (\`match /articles/{id}\`)、`firestore.indexes.json`
- 削除可否: **削除可能 (A)**
- 削除前注意点: `boards` 配下の `articles` サブコレクションと混同しないよう注意。消すのはルートの `articles` のみ。
- 推奨アクション: ルートコレクションの `articles` を削除し、`firestore.rules` から該当パスマッチ `match /articles/{id}` および `firestore.indexes.json` からの定義を削除する。

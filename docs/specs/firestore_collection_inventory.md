# Firestore Collection Inventory

各コレクションの用途、現在の使用状況、今後のアクションを整理した一覧表です。
コードベース全域（API, UI, Rules, Functions）への静的解析（grep監査）結果に基づいています。

| Collection | 用途 | 現在使用中 | 参照箇所 | 将来利用予定 | 削除候補 | 備考 |
|------------|------|------------|----------|--------------|----------|------|
| `boards` | Unified Schema（OSの中核となる作業領域） | ✅ A | UI, API, Rules, Storage | - | - | SEKKEIYAアーキテクチャにおける唯一の情報源 (Single Source of Truth) |
| `users` | ユーザープロファイル、環境設定、権限 | ✅ A | Auth, App UI, API, Functions, Rules | - | - | - |
| `plans` | Stripeサブスクリプション情報 | ✅ A | Stripe Functions, `useDriveStore`, Rules | - | - | - |
| `tags` | アセットやボードの検索・分析用メタデータ | ✅ A | Search Functions, AI Action, UIコンポーネント | - | - | 検索インデックスの基盤 |
| `chats` | ボードに紐づくAIチャット | ✅ A | `LeftSidebar.jsx`, Rules | - | - | ルートではなく `boards/{id}/chats` のサブコレクションとして稼働 |
| `officialArticles` | 運営プラットフォームの公式記事やチュートリアル | ✅ A | `officialArticles.js`, Rules, Storage | - | - | - |
| `usernames` | ユーザーの固有ハンドルのレジストリ | ✅ A | `username.js`, Rules | - | - | @名前のユニーク制約管理に使用 |
| `boardsPublic` | ボードのパブリック公開用データ（フィード・シェア用） | ✅ A | `public.js`, Rules, API | - | - | 読み取り専用公開フィードのための別コレクションとして稼働 |
| `projects` | 複数のBoardを束ねる最上位の概念領域 | - | サイドバーUI上のテキスト等 | ✅ B | - | 現在DB実体としては未稼働だが、設計上「Project -> Board」として存在 |
| `articles` | ユーザー投稿記事（旧構想のルート配置） | - | Rules, indexes | - | ✅ C | 新schemaではboardsのサブコレクションに移行しているため、ルートのarticlesは不要 |
| `layoutShares` | 旧3DSLレイアウト共有 | - | - | - | ✅ C | 参照元コード0件 |
| `publicModelIndex` | 旧モデル公開用インデックス | - | docsメモのみ | - | ✅ C | 参照元コード0件（tags等に移行済み） |
| `viewerShares` | 旧マスタービューアの単発共有リンク | - | Rulesのみ | - | ✅ C | 新規APIやUIからの参照は存在しない |
| `teamBoardInvitations`| 旧チームボード招待機能 | - | `teamBoards.js` (旧API), Rules | - | ✅ C | Unified Boardsの`memberIds`配列による権限管理に移行済み |
| `teamBoards` | 旧チームボード実体 | - | `teamBoards.js` (旧API), Rules | - | ✅ C | 実データのHard DeleteはPhase 9にて実行済み。レガシーコードの撤去待ち |

# SEKKEIYA 経路・ルーティング定義 (Routing Specs)

SEKKEIYAエコシステムのルーティングは、旧来のボードベースのURL構造（`/dashboard/boards` 等）から、Projectに完全に依存する構造（`/projects/:projectId`）へ移行します。

## 1. ダッシュボード経路 (Parent OS)

| Role | 旧ルーティング (Legacy) | 新ルーティング (Project-Centric) | 概要 |
| :--- | :--- | :--- | :--- |
| **ホーム一覧** | `/dashboard/boards` | `/dashboard/projects` | ユーザーが所属する全プロジェクトの一覧を表示するメインページ。 |
| **プロジェクト詳細** | - | `/projects/:projectId` | プロジェクトの詳細画面（要件の編集、所属メンバー管理、ボード一覧）。 |
| **ユーザー設定** | `/dashboard/settings` | `/dashboard/settings` | アカウント・プランの設定。 |

## 2. 子アプリへのアクセス (Child Apps)

子アプリケーション（Workspace）へのアクセスは、明確な `projectId` を必須とします。これにより、子アプリは常に起動直後から `projectId` を確定させ、正しいコンテキストで Firestore や AI Drive を読み込めます。

| アプリ名 | 旧ルーティング (Legacy) | 新ルーティング (Project-Centric) | URL解決の方針 |
| :--- | :--- | :--- | :--- |
| **3DSS (Models)** | `/app/share?boardId=xxx` | `/app/share/projects/:projectId` | パスパラメータから `projectId` を抽出し、デフォルトの Models Board をローディング。 |
| **3DSL (Layouts)** | `/app/layout?boardId=xxx` | `/app/layout/projects/:projectId` | パスパラメータから `projectId` を抽出し、該当プロジェクトの Layout Workspace を起動。 |
| **3DSP (Presents)** | `/app/presents?boardId=xxx` | `/app/presents/projects/:projectId` | パスパラメータから `projectId` を抽出し、プレゼンエディターを起動。 |
| **(Legacy Fallback)** | `/app/share?boardId=xxx` | (Same if no projectId) | 過去共有されたリンクや、インポート処理前のレガシーボードを閲覧するための互換URL。新規発行はされない。 |

## 3. URL設計の原則

1. **Top-Level `projectId`**:
   `SEKKEIYA` 経由であっても、子アプリ単体アクセスであっても、URLに `projects/:projectId` というセグメントを明示的に含めます。
2. **BoardIdの隠蔽 (View Context)**:
   ユーザーは「3DSSアプリ（Models Workspace）」を開いているのであり、「特定のBoardID」という概念を意識する必要はありません。`projectId` が与えられれば、裏側のAPIルーティングで `boardType: models` を持つボードを自動解決（Fallback to `boardId` in query if multiple exist, e.g. `?boardId=xxx` if the user creates multiple layout workspaces inside one project）します。
3. **Single Default Workspace**:
   多くのプロジェクトでは、3DSLなどのワークスペースは1つあれば足ります。もしあるプロジェクト内で「第1案レイアウト」「第2案レイアウト」と複数Boardを作った場合のみ、`/app/layout/projects/:projectId?boardId=secondLayoutId` のようにクエリパラメータで特定します。

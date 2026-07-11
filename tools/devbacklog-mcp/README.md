# sekkeiya-devbacklog-mcp (v2.3: スプリント方式)

管理者（あなた）専用のローカル MCP サーバー。**Claude Code から SEKKEIYA の「開発状況」ボード
（Firestore `/devBacklog` + `/devSprints`）を読み書き**する。書き込むと `onSnapshot` で
Web/Desktop の管理画面に即反映される。

## データモデル（v2.1）

- **スプリント** `/devSprints`: `{ seq, startDate, endDate, archived }` — 2週間単位・自動採番。
  期限は個別に持たず「所属スプリントの終了日」に一本化。
  **現在のスプリント＝未アーカイブの最小番号**。`complete_sprint` でアーカイブすると
  未完了の要件はバックログへ返却され、完了済みは履歴としてスプリントに残る。
- **要求(request)**: ユーザーの「〜がいい」。完了は子要件から**導出**（手動進捗なし）。
- **要件(requirement)**: `requestId`（親要求・**1対多**・任意）＋ `sprintId`（**null=バックログ**）＋
  `status`（**todo/doing/testing/done** = 未着手/着手/テスト/完了）＋ `category`（機能カテゴリ）。
  `category` は子アプリ scope（`3dss`=S.Model, `3dsl`=S.Layout, `3dsp`=S.Slide, `3dsc`=S.Create,
  `3dsd`=S.Diagram, `3dsr`=S.Drawing, `3dsi`=S.Image, `3dsq`=S.Quest, `3dsf`=S.Portfolio,
  `3dsk`=S.Library, `3dsb`=S.Blog, `3dsm`=S.Movie, `3dsmt`=S.Material）＋横断（`general`基盤 /
  `chat` / `drive` / `ai` / `web` / `billing`）。スプリント移動は UI ではドラッグ&ドロップのみ。
- アイデアという種別は無い。**スプリント未アサインの要件＝バックログ**がその役割。
  思い付きレベルのものは要求として追加する。

## 提供ツール

| ツール | 引数 | 用途 |
|---|---|---|
| `list_backlog` | なし | ボード全体（スプリント別要件・バックログ・要求+子要件） |
| `add_item` | `type, title, requestId?, sprintId?, status?, category?` | 追加（要件は親要求・スプリント・状態・カテゴリ指定可） |
| `update_item` | `id, {title?, status?, category?}` | 状態・カテゴリ・タイトル更新 |
| `set_request` | `requirementId, requestId\|null` | 要件の親要求を付け替え |
| `assign_sprint` | `requirementId, sprintId\|null` | スプリントへ割当 / バックログに戻す |
| `create_sprint` | `startDate?, endDate?` | 作成（省略時: 前回終了日翌日から2週間） |
| `update_sprint` | `sprintId, startDate?, endDate?` | 期間変更 |
| `complete_sprint` | `sprintId` | 完了（アーカイブ）。未完了要件はバックログへ返却 |
| `reopen_sprint` | `sprintId` | アーカイブ解除（履歴から戻す） |
| `delete_sprint` | `sprintId` | 削除（所属要件はバックログへ） |
| `delete_item` | `id` | 削除（要求削除時は子要件の requestId を null に） |

## Research & Memo（v2.4 追加）

`hello@sekkeiya.com` のアカウントサイト Research & Memo（ノードグラフ）を読み書きする。
保存先 `users/{uid}/research/{boardId}`（uid はメールから解決）。1ボード=1ドキュメント
`{ title, items[], edges[] }`。UI の researchBoardBridge と同じ挙動（自動配置・エッジ検証・掃除）。

| ツール | 引数 | 用途 |
|---|---|---|
| `research_list_boards` | なし | ボード一覧（メイン＋追加・ノード/エッジ数） |
| `research_get_board` | `boardId?` | ノード＋エッジ取得（省略=メインボード canvas） |
| `research_add_notes` | `boardId?, notes[]{text,kind?,color?,role?,url?}` | メモ追加（座標は自動配置） |
| `research_connect` | `boardId?, edges[]{source,target,relation,label?}` | ノード間を接続（supports等） |
| `research_update_note` | `boardId?, id, {text?,color?,role?}` | メモ更新 |
| `research_remove` | `boardId?, ids[]` | メモ削除（ぶら下がりエッジも掃除） |
| `research_create_board` / `research_delete_board` | `title` / `boardId` | ボード作成／削除（canvasは削除不可） |

例:「Research & Memo のメインボードを見せて」「"○○" というメモを追加して、△△の根拠として□□につないで」

## セットアップ / 登録

```bash
cd sekkeiya/tools/devbacklog-mcp
npm install
node server.mjs --smoke   # 接続確認
```

プロジェクト直下 `.mcp.json` に `sekkeiya-devbacklog` として登録済み。
**Claude Code を再起動**し、初回はプロジェクトスコープ MCP の利用を許可 → `/mcp` で確認。

- 認証: `sekkeiya/serviceAccountKey.json`（project `shapeshare3d`、.gitignore 済）をパス参照のみ。
  変更する場合は `env: { "GOOGLE_APPLICATION_CREDENTIALS": "..." }` で上書き。

## 使い方（例）

- 「開発ボードを見せて」→ `list_backlog`
- 「次のスプリントを作成」→ `create_sprint`
- 「"モバイルで3DSCが重い"を要求に追加し、要件"描画のLOD対応"を切り出して Sprint 2 へ」
  → `add_item(request)` → `add_item(requirement, requestId, sprintId)`
- 「要件3を60%に」→ `update_item(progress: 60)`

## セキュリティ

- Admin SDK は Firestore ルールをバイパスする。「管理者だけ」は鍵をローカルで持つあなただけ、で担保。
- 鍵は**絶対にコミットしない**。このサーバーは `/devBacklog` と `/devSprints` 以外を操作しない。
- クライアントUI用に `firestore.rules` へ `/devSprints`（isAdmin のみ）を追加済み — **ルールのデプロイが必要**。

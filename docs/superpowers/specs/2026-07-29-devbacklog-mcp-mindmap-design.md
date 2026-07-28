# devbacklog MCP からマインドマップを読み書きする

作成日: 2026-07-29
対象: `tools/devbacklog-mcp/server.mjs`（本リポジトリ）と、参照先として `sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts`

## 1. 背景と問題

Research & Memo の既定ビューはマインドマップだが、devbacklog MCP からはマインドマップを読むことも書くこともできない。MCP が扱えるのは「ノード」ビュー（`items` / `edges`）だけである。

これは単なる未対応ではなく、**積極的に誤解を招く状態**になっている。

- `research_list_boards` は各ボードを `notes` / `edges` の件数だけで返す。マインドマップに多数のトピックがある S.Model ボードが `notes: 0, edges: 0` と表示される。
- `research_get_board` は `items` / `edges` だけを返し、`mindmap` を黙って落とす。

実際にこの2点が原因で「マインドマップは MCP からは見えない別データ」と誤って判断した経緯がある。

## 2. 現状の調査結果

**マインドマップは同じドキュメントに入っている。** `users/{uid}/research/{boardId}` の1ドキュメントが次を持つ（`ResearchCanvasRepository.ts` の `ResearchCanvasDoc`）。

| フィールド | 内容 |
|---|---|
| `items` | ノードビューのメモ |
| `edges` | ノードビューの型付きエッジ |
| `mindmap` | `MindMapNode[]` — マインドマップの木 |
| `mindmapStyle` | レイアウト・テーマ・背景 |
| `mindmapSummaries` | まとめノード |
| `mindmapRelations` | `MindMapRelation[]` — 木の親子とは別の横断関係線 |

MCP の `loadBoard` が `items` と `edges` しか読んでいないだけで、権限もパスも既に通っている。

**操作の意味論は既に定義済み。** `mindmapVerbs.ts` に SEKKEIYA Chat の AI 用の verb が5つある（`mindmap_get` / `mindmap_add_topics` / `mindmap_update_topic` / `mindmap_remove_topics` / `mindmap_connect_topics`）。本設計はこれを MCP へ写すものであり、新しい意味論は導入しない。

**確定している規則**（`mindmapBridge.ts` / `ResearchCanvasRepository.ts` より）

- `MindMapNode` = `{ id, parentId, rank, text, collapsed?, color?, icons?, image?, imageW?, imageH?, link?, note?, refType?, refId?, refTitle?, childBoardId?, originBoardId?, createdAt, updatedAt }`
- `parentId: null` が中心トピック。1ボードに1つ。**存在しなければ `{ parentId: null, rank: 0, text: '中心トピック' }` を自動生成する。**
- `rank` は親ごとの並び順。採番は**既存の兄弟の最大 rank + 1、兄弟が無ければ 0**。
- `MindMapRelation` = `{ id, source, target, text?, createdAt, updatedAt }`
- 削除は**部分木ごと**消える。

## 3. 目的と成功基準

**目的**: MCP からマインドマップを読み、部分木を組み、直せるようにする。

**成功基準**

1. `research_list_boards` の結果を見て、そのボードにマインドマップがあるかどうかが分かる。
2. `mindmap_get` でツリーを取得し、その id を使って親を指定して追加できる。
3. 1回の `mindmap_add_topics` で親子関係のある部分木を組める。
4. 書き間違えたトピックを、MCP だけで修正・削除できる。
5. MCP から書いたマインドマップが、アプリの UI で違和感なく表示・編集できる（verb 経由で書いたものと区別がつかない）。

## 4. 決定事項

### 4.1 追加するツール（5つ）

既存 verb と**同名・同スキーマ**にする。唯一の違いは対象ボードの指定方法で、verb の `projectId` ではなく、他の `research_*` と同じ `boardId`（省略時はメインボード `canvas`）を取る。

| ツール | 入力 | 返り値 |
|---|---|---|
| `mindmap_get` | `boardId?` | トピック配列（`id` / `parentId` / `rank` / `text` / `note` / `link` / `icons` / `collapsed` / `childBoardId`）と関係線配列 |
| `mindmap_add_topics` | `boardId?`, `topics[]`, `relations[]?` | 追加した `{ id, parentId, text }` の配列 |
| `mindmap_update_topic` | `boardId?`, `id`, `text?`, `note?`, `link?`, `parent?`, `collapsed?` | 更新後の要約 |
| `mindmap_remove_topics` | `boardId?`, `ids[]` | 削除した id（部分木を含む） |
| `mindmap_connect_topics` | `boardId?`, `relations[]` | 張った関係線と、スキップした理由 |

`topics[]` の各要素: `text`（必須）/ `parent`（既存 id または `"#N"`）/ `note` / `link` / `image` / `refType` / `refId` / `refTitle`。

`relations[]` の各要素: `source` / `target`（既存 id または `"#N"`）/ `text`。

**`"#N"` 記法**が本設計の要点である。`topics` 配列の添字を親や関係線の端点として参照でき、1回の呼び出しで部分木を丸ごと組める。verb と同じ挙動にする。

`mindmap_update_topic` が扱うのは `text` / `note` / `link` / `parent` / `collapsed` の5つに限る。`MindMapNode` は `color` / `icons` も持つが、**verb が扱っていないため揃える**。必要になった時点で両方に足す。

### 4.2 既存2ツールの修正

- `research_list_boards`: 各ボードに `topics`（マインドマップのトピック数）と `relations`（関係線数）を追加する。`notes` / `edges` はそのまま。
- `research_get_board`: 返り値に `mindmap` と `mindmapRelations` を追加する。`items` / `edges` の形は変えない。

これにより「ノードビューが空＝ボードが空」という誤読ができなくなる。

### 4.3 バリデーション

verb と同じものを移植する。

- `text` が空のトピックは追加せず、理由を返す。
- `image` が `data:` URL のものは拒否する（https の実 URL のみ）。
- 存在しない `parent` / `source` / `target` を指すものはスキップし、理由を返す。
- 自己ループはスキップする。
- `mindmap_remove_topics` で中心トピック（`parentId: null`）を消そうとした場合は拒否する。ボードを空にするなら子を全部消す。

`research_connect` と同じく、**エラーで全体を落とさずスキップして理由を返す**方針に揃える。

## 5. 実装

`server.mjs`（953行）に追記する。既存の `loadBoard` / `saveBoard` / `compact` / `rNewId` / `ok` / `fail` がそのまま使えるため、新しい基盤は要らない。

| 対象 | 変更 |
|---|---|
| `loadBoard` | `mindmap` / `mindmapRelations` も返すようにする |
| `research_list_boards` | 件数に `topics` / `relations` を追加 |
| `research_get_board` | 返り値に `mindmap` / `mindmapRelations` を追加 |
| 新規 | 上記5ツールの `registerTool` |
| 新規ヘルパー | 中心トピックの取得または生成、親ごとの rank 採番、`"#N"` の解決、部分木の収集 |

`sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts` の先頭に、MCP 側に写しがある旨のコメントを入れて相互参照にする（`server.mjs` 側にも同様のコメントを入れる）。

## 6. 割り切ること

**同じ意味論の実装が2つ並存する。** verb 側は desktop の TypeScript、MCP は standalone の `.mjs` で、ランタイムが異なるためコードを共有できない。`rank` の採番規則や削除時の部分木の扱いがずれると、チャットから触ったときと MCP から触ったときで挙動が変わる。

対策は相互参照コメントに留める。共通パッケージを切るのはこの規模では過剰と判断した。**4章の「確定している規則」が両者の契約**であり、どちらかを変えるときは両方を直す。

## 7. 非スコープ

- `mindmapStyle`（レイアウト・テーマ・背景）の変更。見た目はアプリ側で設定する。
- `mindmapSummaries`（まとめノード）の操作。
- 子ボードへのドリルダウン（`childBoardId`）の作成・解除。
- ノードビュー（`items` / `edges`）とマインドマップの相互変換。
- verb 側の改修。

## 8. リスク

| リスク | 対応 |
|---|---|
| MCP が壊れた木を書き、UI が表示できなくなる | 中心トピックの存在を保証し、`parentId` が実在するトピックを指すことを保存前に検証する。孤児が生じる操作は拒否する |
| verb 実装との挙動のずれ | 4章の規則を契約として明記し、両ファイルに相互参照コメントを置く |
| 大きな部分木を一度に書いてドキュメントが肥大する | Firestore の1ドキュメント上限は 1MiB。既存の `mindmap` 配列も同じ制約下にあり、本設計で新たに増える要因は無い。将来トピック数が数千規模になったら分割を検討する |
| 既存の `research_*` の返り値変更が、利用側の想定を壊す | 追加のみで既存フィールドの形は変えない |

## 9. 検証

このリポジトリ（`sekkeiya`）にはテストスイートが無いため、実行して確かめる。

1. MCP を再起動し、`research_list_boards` が S.Model ボードに `topics > 0` を返すこと。
2. `mindmap_get` が、アプリの画面で見えているトピックと一致する木を返すこと。
3. `mindmap_add_topics` で `"#N"` を使った2階層の部分木を1回で追加し、アプリの UI で正しい親子関係で表示されること。
4. `mindmap_update_topic` で本文を変え、UI に反映されること。
5. `mindmap_remove_topics` で 3 で足した部分木を消し、UI から消えること。
6. 中心トピックの削除が拒否されること。
7. 一連の操作の後、アプリ側でマインドマップを手で編集しても壊れないこと。

**MCP サーバーの変更は Claude Code の再起動が必要**であることに注意する。

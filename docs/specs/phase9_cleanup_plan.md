# Phase 9: Legacy Boards Cleanup & Execution Plan

## 1. 旧構造コード監査結果 (Legacy Code Audit)

### 残存 legacy 参照一覧 (Remaining Legacy References)
コード検索の結果、以下のファイル群に旧構造の参照が残存しています。

**1. フロントエンドUI / Hooks**
- `packages/global-panel/src/pages/BoardManagementPage.jsx`
- `packages/global-panel/src/MiniSidebar.jsx`
- `packages/global-panel/src/hooks/useBoards.js`
- `src/shared/layout/LeftSidebar.jsx` (SEKKEIYA本体)
- `src/shared/layout/sidebar/MiniSidebar.jsx` (SEKKEIYA本体)

**2. データアクセスAPI (Firestore CRUD)**
- `packages/global-panel/src/api/boards/myBoards.js`
- `packages/global-panel/src/api/boards/teamBoards.js`
- `packages/global-panel/src/api/adapters/boardAdapters.js`
- `src/shared/api/models/read.js`, `update.js`, `delete.js`
- `src/shared/api/boards/read.js`, `sidebar.js`, `teamBoards.js`

**3. セキュリティルール (Storage)**
- `storage.rules`: 旧 `myBoards` や `teamBoards` パスの Read/Write ルールが多数残存しています。
- ⚠️ `firestore.rules` および `functions/` (Cloud Functions) には旧構造の依存はありませんでした。

### 削除してよい箇所 (Can be Deleted)
アプリ側ですでに新しい `boards` コレクションへの参照移行が完了しているため、**上記リストの事実上すべてが段階的に削除対象（またはリファクタリング対象）** となります。
特に `api/boards/myBoards.js` などの API コードはファイルごと削除可能です。

### まだ残すべき箇所 (Keep for Now)
- **Hard Delete 実行完了までの間**: `soft_delete_legacy_boards.mjs` および作成する `hard_delete_legacy_boards.mjs` スクリプト。
- **URL互換性ルーティング**: 万が一旧 URL（`teamBoards/{id}`など）にアクセスしてきたユーザー向けの `boards/{id}` へのリダイレクトなどのFallbackがあれば残します。

### Hard Delete 実行前に注意すべき点
- **Storageの残骸**: Firestore 上の親ドキュメントが消えても、`Storage` 内にあるサムネイル画像等（`boardCovers/myBoards/...`）は残ります。これは Firestore の Hard Delete には直接影響しませんが、後日 Storage の別クリーンアップタスクとして整理する必要があります。

---

## 2. Phase 9 実施方針の提案

### 案A：即時 Hard Delete
- **メリット**: 対象が2件と判明しており、バックアップも完了済み。さらに UI 側の Unified Schema 移行も完了しているため、即座に削除することで最も早くクリーンな環境を作れる。
- **デメリット**: 復元には GCP エクスポートデータからの手動リストア作業が必要。

### 案B：一定期間保留後に Hard Delete
- **メリット**: 予期せぬ不具合があった際、フラグを戻すだけで瞬時に復元が可能。
- **デメリット**: 対象はわずか2件と極小であり、保留状態を維持するだけ管理コストが実態と見合わない。

#### 💡 **結論：【案A：即時 Hard Delete】を提案します**
理由：Phase 8 により、本番環境のアクティブな旧データが極少（2件）であることが確定しています。「大量データのユーザー影響」を考慮する期間は不要と判断できるため、即座に Hard Delete を実行してコードベースのクリーンアップに移行するアプローチが妥当です。

---

## 3. Legacy Code Cleanup 計画 (実行順序)
Hard Delete 完了後、以下の順序でアプリコードの撤去を実施します。

1. **Storage Rules の整理**: `storage.rules` から旧パスのルールを削除。
2. **API ファイルの削除/統合**: `myBoards.js`, `teamBoards.js` を削除し、Unified な `boards` API に一本化。
3. **Hooks & Components**: `useBoards.js` 内の旧分類ロジックの排除。
4. **Adapter の撤去**: `boardAdapters.js` 等における fallback の完全削除。

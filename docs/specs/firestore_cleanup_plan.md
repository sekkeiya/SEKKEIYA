# Firestore Migration & Cleanup Plan (Phase 4)

この計画書は、旧構成の残骸の削除と新アーキテクチャへの完全移行を安全に実行するための手順を定義します。

---

## 🗑️ 1. 削除対象一覧

以下のコレクション群の段階的削除を実施します。
1.  `users/{uid}/myBoards`
2.  `users/{uid}/teamBoards`
3.  `teamBoards`

*(注: `boardsPublic`、`publicModelIndex`、`users/{uid}/driveAssets` は維持)*

---

## 📝 2. 移行前チェック項目（Preflight Checklist）

削除を実行する前に、以下のスクリプト（要作成）をドライランし、100%のデータ保証を確認すること。

1.  **整合性確認バッチ:** 全ての `users/{uid}/myBoards` ドキュメントに対し、Unified Schema 上 (`boards` where `ownerId == uid` && `boardType == myBoards`) に同等の情報・アイテムが展開済みか検証するスクリプト。
2.  **UI 参照箇所の撲滅（必須）:** コードベース全体で、旧コレクションパス (`teamBoards/`, `users/*/myBoards`, `users/*/teamBoards`) に対する `collection()` や `doc()` 呼び出しが全く存在しないかを `grep` または `rg` で最終確認する。Soft Delete 前にこの参照件数がゼロであることが絶対条件。
3.  **孤立アイテムの検出:** `teamBoards` や `myBoards` 配下に格納されていて、新 `boards` へ移されなかった `models` が無いかチェック。

---

## 💾 3. バックアップ方針 \& ロールバック手順

*   **バックアップ:** 
    GCP Console (Firestore -> Import/Export) を利用するか、`gcloud firestore export` にて対象の旧コレクションのみを Google Cloud Storage にフルエクスポートする。
    `gcloud firestore export gs://[BUCKET_NAME]/firestore_backup_pre_cleanup --collection-ids=teamBoards,myBoards`
    ※ `--collection-ids` オプションはコレクショングループを指定するため、ルートの `teamBoards` だけでなく `users/{uid}/myBoards` や `users/{uid}/teamBoards` 等、同名の全階層が一括してバックアップ対象として厳密に保護される。
*   **ロールバック手順:**
    万が一問題が発生した場合は、UIのコードを即座にリバートし、エクスポートした GCS バケツから `gcloud firestore import` で対象コレクションをリストアする。

---

## ⏳ 4. 段階的削除手順

### Step 1: Soft Delete (リネームによる隔離) 
システム稼働中の事故を防ぐため、いきなり削除するのではなくフラグ管理退避を行う。
**※注意:** 旧パスを参照するコードの完全削除（Preflight Check 2番）が完了していること。コードが残ったままフラグを立てても、旧コードからは古い値が読めてしまう可能性があるため無意味となる。

1. スクリプトで対象ドキュメントを読み、全てに `isArchived_pendingDelete: true`, `archivedAt: timestamp` を付与。
2. 1週間本番運用を行い、UIに影響が出ないことを監視する。

### Step 2: Hard Delete (バッチ削除)
1. 監視期間終了後、`firebase-admin` を用いた Cloud Functions やローカル Node スクリプトを実行する。
2. クエリ負荷軽減のため `limit(500)` でチャンクし、`writeBatch` を用いて一気に削除。サブコレクション（`models`）から先に再帰削除すること。

---

## 🧪 5. 削除後確認対象画面 (QA Checklist)

削除（及び Soft Delete）実施後は、直ちに以下の画面で退行バグが発生していないか E2E または手動テストを実施する。

- [ ] **Dashboard:** ボードの最近の操作履歴や、ボード一覧（プロジェクト選択時含む）が正常に描画されるか。
- [ ] **モデル一覧:** ModelListUI でモデル情報を取得・表示できるか。（`users/{uid}/models` が無事か）
- [ ] **モデル詳細:** 個別のモデルデータが表示され、画像や情報を読み込めるか。
- [ ] **公開 / 非公開切替:** 3DSSなどでモデルの公開状態をトグルし、`publicModelIndex` が追従するか。
- [ ] **Board 一覧 / Board 詳細:** 左サイドバーから My Board, Team Board を開き、配置されたアイテム（スナップショット）が正常に読めるか。
- [ ] **Drive 検索:** AI Drive パネルを起動し、過去に同期された `driveAssets` や最近アップロードされたモデルが表示・機能するか。

---

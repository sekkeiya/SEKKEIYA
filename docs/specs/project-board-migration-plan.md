# Project / Board Migration Plan

## 1. 概要 (Overview)
本ドキュメントでは、既存の「BoardがProjectを兼ねている」状態から、「Project → Board → Item」の新しいアーキテクチャへの段階的かつ非破壊的な移行計画を定義します。

## 2. 移行単位と対応マッピング (Migration Mapping)

### 旧 (Legacy)
- `Board (MyHouse)`
  - タブ: `Models`
  - タブ: `Drawings`
  - タブ: `Renders`
  - タブ: `Movies`
  - タブ: `Articles`
  - タブ: `Slides`
  - タブ: `Analysis`

### 新 (Target Architecture)
- **`Project (MyHouse)`**
  - `Models Board` (3DSS) ← 旧 `Models` タブ
  - `Layout Board` (3DSL) ← 新設 (または旧 Drawings/Renders の適応)
  - `Presents Board` (3DSP) ← 旧 `Slides` タブ
  - `Requirements Board` (SEKKEIYA) ← 旧 `Articles` / メモ同等
  - `Analysis Board` (SEKKEIYA) ← 旧 `Analysis` タブ

## 3. データ移行手順 (Migration Steps)

### Step 1: `projects/{projectId}` スキーマの導入 (Phase 6 完了時)
既存の `boards` コレクションの各ドキュメントに対し、同名の `projects` ドキュメントを新規作成します。
- `boards/{boardId}` を読み込む。
- `projects/{projectId}` (IDは旧boardIdと同一でも可)を作成し、オーナー情報・名前・可視性を引き継ぐ。

### Step 2: 既存のBoardをProject配下へ付け替え
旧ボード内の「タブ」データを独立した `Board` として生成します。
- `projects/{projectId}/boards/{newModelsBoardId}` を作成。（`boardType="models"`）
- 旧 `boards/{boardId}/items` のうち、モデル系のものを `newModelsBoardId/items` にコピー（または移動）。

### Step 3: コードベースの参照先切り替え
UI の読み込み先を、旧 `boards` から新 `projects/{projectId}/boards/{boardId}` へ切り替えます。
この期間は旧データも残す（ダブルライト、または完全移行バッチ実行による一斉切り替え）。

## 4. 移行のリスクと対策 (Risks & Mitigation)

| リスク | 対策・互換期間 |
| :--- | :--- |
| **URL の互換性破損** | 旧 `/boards/:id` を踏んだ場合、該当する新しい `Project` のデフォルトボード (例: Requirements Board) へリダイレクトするルーティング互換層を `react-router` に設ける。 |
| **データの欠損** | 移行前のバックアップ取得必須。スクリプト実行時は Dry-Run で各タブアイテムのコピー件数が一致するかを検証するフェーズを設ける。 |
| **進行中のUI作業との競合** | 一気にUIを変えるのではなく、まずは裏側のデータ構造（Project ID/Board IDの二重管理）だけを実装し、UI上の見た目は「タブ」のまま新しいデータを読み書きさせる互換期間（Phase 6~7）を設ける。 |

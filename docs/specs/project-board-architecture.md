# Project / Board Architecture

## 1. 概要 (Overview)
本ドキュメントでは、SEKKEIYA および関連アプリ群 (3DSS / 3DSL / 3DSP 等) における基本構造パラダイムを定義します。
これまでの「Boardが実質的にProjectを兼ねる」曖昧な状態を解消し、**「Project → Board → Item」** という明確な階層構造へと移行します。

## 2. 既存構造との違い (Differences from Legacy Structure)

| 比較項目 | 旧構造 (Legacy) | 新構造 (New) |
| :--- | :--- | :--- |
| **最上位単位** | Board (例: MyHouse ボード) | **Project** (例: MyHouse プロジェクト) |
| **アプリ/用途の区切り** | Board 内の「タブ」(疑似的) | **Board** (実体を持つ独立したワークスペース) |
| **中身のデータ** | タブ内に属する個別のデータ | **Item** (Board内の要素、基本は参照) |

**最も重要な思想の転換:**
「Board ≠ Project」であると明文化します。
これまでの「MyHouse ボード」は「MyHouse プロジェクト」となり、その中に存在していた各種タブ (Models / Layout / Presents等) は、それぞれ独立した実体である「Models Board」「Layout Board」へと昇格します。

## 3. 各階層の正式定義 (Definitions)

### 3.1. Project (プロジェクト)
**定義:** 案件・仕事・企画そのものを表す最上位の単位 (The World)。
- **役割:** 複数の作業領域 (Board) を束ねるコンテナであり、**AI文脈の親単位**として機能します。
- **保持する情報:**
  - プロジェクト名、説明、ステータス
  - オーナー (Owner ID)、メンバー (Member IDs)
  - 可視性 (visibility)
  - カバー画像情報等
- **権限管理:** 原則として権限（アクセス制御）は**Project単位**で管理されます。

### 3.2. Board (ボード)
**定義:** Project の中で特定の目的・アプリに紐づく**作業面 / 情報面** (The Workspace)。
- **役割:** 単なる情報の「ビュー(タブ)」ではなく、**独立した意味と実体を持つ作業単位**です。
- **標準構成:** Project 作成時に、以下が最低限の標準Boardとして自動生成されます（将来拡張可能）。
  - **Requirements Board** (要件定義 / SEKKEIYA)
  - **Models Board** (3Dモデル / 3DSS)
  - **Layout Board** (空間レイアウト / 3DSL)
  - **Presents Board** (プレゼン / 3DSP)
  - **Analysis Board** (分析 / SEKKEIYA)
- **特徴:** 各Boardは、自身の用途に応じた `appScope` (対象アプリ) や `boardType` を持ち、どの子アプリで開かれるべきかを明示します。

### 3.3. Item (アイテム)
**定義:** Board の中に配置される実データへの**参照** (The Content)。
- **役割:** 3Dモデル、レイアウトデータ、プレゼンスライド、メモなどの実アセットをBoard内で管理・表示するためのラッパー。
- **特徴:** 
  - データ本体を丸ごとコピーするのではなく、**基本はエンティティへの参照 (`entityRef`) と最小限のスナップショット (`snapshot`)** を保持します。
  - AIやユーザーが特定のBoard内でアイテム群を見るとき、その実体を効率的に引っ張るための目次として機能します。

## 4. 今後の基本思想 (Core Philosophy)
1. **「Project が世界、Board が作業」**: ユーザーはまず Project という「世界 (案件)」に入り、目的に応じて各 Board (作業空間) を行き来します。
2. **AI の構造的文脈化**: AI Chat や AI Drive は、「今どの Project の、どの Board を見ているか」を強力なコンテキストとして受け取ります。例えば「MyHouse Project の Requirements Board」を読み解き、「Layout Board」向けに提案を行う、といった高度なクロスボード推論が可能になります。
3. **段階的移行**: 既存のBoardデータ構造は「中途半端な延命」をせず、明確にProjectへの格上げ移行プロセスを設けます（詳細はMigration Plan参照）。

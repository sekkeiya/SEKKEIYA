# Project / Board Architecture

## 1. 概要 (Overview)
本ドキュメントでは、SEKKEIYA および関連アプリ群 (3DSS / 3DSL / 3DSP 等) における基本構造パラダイムを定義します。
これまでの「Boardが実質的にProjectを兼ねる」曖昧な状態を解消し、構造的かつ直感的な階層モデルを導入します。

## 2. SEKKEIYA 統一階層モデル (Unified Hierarchy Model)
すべてのデータと機能は、以下の厳密な階層と順序に従います。

### 1. User
エコシステムを利用するユーザー。すべての操作と権限の起点となります。

### 2. SEKKEIYA
すべてのアプリ（3DSS, 3DSL 等）を統括する親システム。ユーザーは常に SEKKEIYA を入口としてエコシステムにアクセスします。

### 3. Project
案件・仕事・企画そのものを表す最上位の単位 (The World)。
- 複数の作業領域を束ねるコンテナであり、AI文脈の親単位として機能します。
- 権限（アクセス制御）は Project 単位で管理されます。

### 4. Boards
特定の Project に紐づき、各種 Board を束ねるコンテナ・コレクションです。

### 5. Board
Project の中で特定の目的に紐づく作業単位 / ワークスペース (The Workspace)。
- 独立した意味と実体を持つ作業面です。
- 標準構成として、Requirements Board, Models Board, Layout Board, Presents Board, Analysis Board などが存在します。

### 6. Item
Board の中に配置される実体データへの「参照ポインタ」 (The Pointer)。
- データ本体を丸ごコピーするのではなく、実体 (`entityRef`) への参照と軽量な表示データ (`snapshot`) のみを保持します。

### 7. Asset / Metadata
Item が参照する「実体データ本体」 (The Content)。
- 3Dモデルファイル (Storage)、巨大なレイアウトデータ、メタデータそのものが該当します。

### 8. AI Drive
Project および横断的な Asset をインデックス・解析する AI の記憶・検索エンジンです。
- Project 全体のコンテキストを保持し、クロスサーチを提供します。

### 9. AI Chat
ユーザーが自然言語でシステムと対話するためのインターフェース。
- AI Drive を通じて Project と Board のコンテキストを読み取った上で、ユーザーのアシストを行います。

### 10. AI Response / Action
AI Chat が生成した回答、またはシステムを直接操作するアクション (JSON Actions)。
- 最終的に生成された操作は、Project、Board、Item、Asset の各層へ適用されます。

## 3. 旧構造との違い (Differences from Legacy Structure)

| 比較項目 | 旧構造 (Legacy) | 新構造 (New) |
| :--- | :--- | :--- |
| **最上位単位** | Board (例: MyHouse ボード) | **Project** (例: MyHouse プロジェクト) |
| **アプリの区切り** | Board 内の「タブ」(疑似的) | **Board** (実体を持つ独立したワークスペース) |
| **中身のデータ** | タブ内に属する個別のデータ | **Item** (Assetへの参照) |

**最も重要な思想の転換:**
「Board ≠ Project」であると明文化します。また、「Project が世界であり、Board が作業領域であり、Item が実体へのポインタである」という原則を徹底します。

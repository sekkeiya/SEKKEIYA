# Project / Board UI Transition Plan

## 1. 概要 (Overview)
このドキュメントでは、「Board≠Project」という新アーキテクチャへの移行にともない、SEKKEIYAおよび関連アプリ(3DSS, 3DSL, 3DSP等)のUI/UXをどのように改修・展開していくかの段階的かつ非破壊的な計画をまとめます。

## 2. 画面遷移とUIの再設計案 (UI/UX Redesign)

### 旧 (Legacy) の課題
- **「ボード管理 (Dashboard)」**を開くと、実際には**プロジェクト管理**の粒度(MyHouseなど)が表示されている。
- ボードを開いた後の**タブUI** (Models, Drawings, Slides等) が擬似的に別のワークスペースのように振る舞っており、直感的な責務分離が弱い。
- AIの視点(Drive/Chat)が「今何のボード(タブ)にいるか」に強く依存し、Project全体の俯瞰視点が取りにくい。

### 新 (Target) の画面構造案
1. **プロジェクト一覧画面 (Projects Dashboard)**
   - アプリ起動時のポータル画面。旧「ボード管理」を格上げし、「プロジェクト一覧」として提供する。
   - プロジェクトカード (MyHouse等) をタップすると、そのプロジェクトの内部へ入る。
2. **プロジェクト・ホーム (Project Home & Board List)**
   - プロジェクトの詳細情報 (メンバー、タイムライン、概要) と、直下にある「Board一覧」タブを表示する。
   - Requirements, Models, Layout, Presents といったボードへの**入口（タイルまたはリスト）**が並ぶ。
3. **各 Board 画面 (Workspace)**
   - 例: Models Board をタップすると、該当のボードコンテキスト (`projectId` & `boardId`) を持った状態で **3DSS アプリ (またはその統合ビュー)** が起動する。
4. **App Switcher / MiniSidebar の役割**
   - MiniSidebar は現在開いている **Project のコンテキスト** を永続的に保持しつつ、別 Board へのショートカットやアプリ間遷移を提供する。

## 3. 段階的なUI置換プロセス (Phased Implementation)

| フェーズ | UI 変更内容 | 目的 / 状態 |
| :--- | :--- | :--- |
| **Phase 1** | **(非破壊的基礎)** 内部Stateに `projectId` と `boardId` を二重で持たせる。既存UI（BoardListとタブUI）は見た見上そのまま維持。 | データ層とAI文脈層への Project/Board 分離の事前導入。ユーザー影響ゼロ。 |
| **Phase 2** | **Project ポータルと Board 一覧の分割プレビュー**。既存の「Dashboard」を「Projects」と改名。Projectを開くと、(旧)タブUIではなく、Board一覧をカード形式で表示する「Project Home」を新設。 | UXの移行開始。「タブ」を物理的な「Board」としての見せ方に変える。 |
| **Phase 3** | タブUIの完全撤廃。各Boardを開く際は、その用途に特化した独立した画面(またはアプリ内ルーティング)へと切り替わる。MiniSidebarがBoard間のナビゲーションを担う。 | 最終形態の完成。「Project が世界、Board が作業」の体現。 |

## 4. Minimum Required Views (最低限必要な画面)
1. **Projects List View** (全プロジェクト一覧)
2. **Project Detail View** (プロジェクトの概要 + Board一覧)
3. **Board Workspace View** (旧タブ画面の実体化：3Dモデル一覧、レイアウトエディタ、プレゼンエディタ等)
4. **Settings/Members View** (プロジェクト全体に対する権限と設定管理)

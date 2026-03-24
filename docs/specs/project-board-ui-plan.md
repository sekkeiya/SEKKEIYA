# Project / Board UI Transition Plan

## 1. 概要 (Overview)
このドキュメントでは、「Project → Board → Item」という新アーキテクチャへの移行にともない、SEKKEIYAおよび関連アプリのUI/UXをどのように改修・展開していくかの非破壊的な計画をまとめます。

## 2. 画面遷移とUIの再設計案 (UI/UX Redesign)

### 旧 (Legacy) の課題
- 「ボード管理」画面を開くと、実際には Project の粒度が表示されている。
- タブUI が擬似的に別のワークスペースのように振る舞っており、「Board」としての独立性が弱い。
- AI Chat / AI Drive の視点がフラットで、階層化されていない。

### 新 (Target) の画面・機能構造案
すべてのUIは、以下の構造（User → SEKKEIYA → Project → Boards → Board ...）を体現します。

1. **プロジェクト一覧画面 (Projects Dashboard in SEKKEIYA)**
   - User が SEKKEIYA にアクセスした際のポータル画面。
   - Project カードをタップすると、その Project の内部（Boards一覧）へ入る。
2. **プロジェクト・ホーム (Project Home)**
   - Project の概要と、直下にある「Boards」コレクションを一覧表示する。
   - Requirements Board, Models Board などの独立したワークスペースへの入口が並ぶ。
3. **Board Workspace View (各アプリの作業画面)**
   - 例: Models Board をタップすると、該当のコンテキストで 3DSS アプリ が起動する。
   - UI内の操作はすべて Item および Asset / Metadata の編集として扱われる。
4. **AI インターフェースの統一 (AI Drive / AI Chat)**
   - MiniSidebar 等からアクセスできる AI Chat は、現在の Project / Board コンテキストを保持したままフロート表示され、User に対して AI Response / Action を返す。

## 3. 段階的なUI置換プロセス (Phased Implementation)

| フェーズ | UI 変更内容 | 目的 / 状態 |
| :--- | :--- | :--- |
| **Phase 1** | **(非破壊的基礎)** 内部Stateに Project と Board のIDを二重で持たせる。既存UI（タブ）は維持。 | データ層の準備。 |
| **Phase 2** | **Project ポータルの新設。** 既存の「Dashboard」を「Projects」と改名。「Project Home」で Boards をリスト表示。 | 構造の視覚化開始。 |
| **Phase 3** | **タブUIの完全撤廃。** 各 Board を開く際は専用のアプリ・画面へルーティング。AI Drive / AI Chat が Project コンテキストで動作。 | 最終形態の完成。「Project が世界、Board が作業領域」の体現。 |

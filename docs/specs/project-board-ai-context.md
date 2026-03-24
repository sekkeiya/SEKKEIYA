# Project / Board AI Context Specification

## 1. 概要 (Overview)
本ドキュメントでは、AI機能がどのように SEKKEIYA エコシステムの階層構造（Project → Board → Item 等）を認識し、自律的に文脈を統合・横断するかについての設計基準を定義します。

## 2. 旧仕様の課題 (Legacy Limitations)
- 旧仕様では、AIは「現在開いているボード」のスコープしか知らず、「その中で今どのタブを見ているか」といったミクロな文脈と、「プロジェクト全体」というマクロな文脈の区別がついていませんでした。

## 3. 階層に基づく新コンテキスト基盤 (The Context Hierarchy)

AI（特に `useAssistantStore` および `orchestrator/agent.js`）には、統一された構造に基づくコンテキストが送信されます。

### 3.1. マクロコンテキスト: Project 
案件全体 (The World) を表す `projectId` が常にコンテキストとして送信されます。
- **効果:** AI Drive や AI Chat は、この Project 内に属するすべての Boards (Requirements Board や Models Board など) を自律的に参照しにいくことが可能になります。

### 3.2. ミクロコンテキスト: Board
現在操作している作業領域 (The Workspace) を表す `boardId` が送信されます。
- **効果:** ユーザーが「ここにアイテムを置いて」と言った場合、わざわざ「Layout Board に」と言わなくとも、AI Chat は現在の Board 宛に AI Response / Action を発行します。

## 4. AIのクロスボーディング・フロー (Cross-Boarding Flow)

以下は、Project 階層全体を俯瞰した操作シナリオです。

1. **状況:** User は「MyHouse」Project 内の「Layout Board」を開き、AI Chat を立ち上げます。
2. **送信コンテキスト:**
   ```json
   {
      "context": {
         "projectId": "proj_myhouse_123",
         "boardId": "board_layout_456"
      }
   }
   ```
3. **User入力:** 「要件で決まったとおりに、ソファを配置して」
4. **AIの内部処理:**
   - (a) `projectId` を元に、AI Drive が同じ Project 内の「Requirements Board」を検索。
   - (b) Requirements Board 内の Item (テキストメモのAsset) から「ソファが必要」という要件を読み取る。
   - (c) AI Drive が全体検索をかけ、該当するソファの Asset ID を特定。
   - (d) 現在の `boardId` に向けて、対象 Item を配置する AI Response / Action を生成する。

## 5. Agent プロンプトの方針
- **メタ認知:** AIは常に「自分は特定の Project 全体を把握しつつ、現在は特定の Board で User をサポートしている」という認識を持ちます。
- AI Response / Action レイヤーを通じて、特定の Board へ Item の追加や Asset の更新を実行します。

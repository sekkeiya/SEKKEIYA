# Project / Board AI Context Specification

## 1. 概要 (Overview)
本ドキュメントでは、AI機能（AI Chat および AI Drive）が「Project」ならびに「Board」のコンテキストをどのように利用し、解釈し、自律的に横断参照を行うかについての設計基準を定義します。

## 2. 旧仕様の課題 (Legacy Limitations)
- 旧仕様では、AIは「現在開いているボード(事実上のプロジェクト)」のスコープしか知らず、「その中で今どのタブを見ているか」といったミクロな文脈と、「プロジェクト全体の要件」といったマクロな文脈の区別がついていませんでした。
- 結果として、「要件(Requirements)タブ」で話した内容を「レイアウト(Layout)タブ」の自動構築に上手く引き継げない、といったAIの断絶が発生していました。

## 3. 新コンテキスト基盤 (The Context Hierarchy)

AI（特に `useAssistantStore` および `orchestrator/agent.js`）には、以下の2層のコンテキストが常に送信されます。

### 3.1. マクロコンテキスト: `projectId` (Project Context)
これはユーザーが関心を持っている**「世界 (案件)」**全体です。
- **役割:** AIがクロス検索や全体俯瞰を行うための境界。
- **効果:** AIは現在開いている Board に縛られず、「この Project 内の Requirements Board を読んで」と指示された際に、自身で該当 Board の Items へアクセスしにいくことが可能になります。

### 3.2. ミクロコンテキスト: `boardId` (Active Board Context)
これはユーザーが今画面に開いて、操作している**「作業面」**です。
- **役割:** AIの「デフォルトの操作対象」および「暗黙の文脈」。
- **効果:** ユーザーが「ここにソファを置いてほしい」と言った場合、わざわざ「Layout Board に」と言わなくとも、AIは現在の `boardId` が Layout用であると認識し、そこへ変更用の JSON Actions (`addModelToBoard`, `changeLayout` 等) を発行します。

## 4. AIのクロスボーディング・フロー (Cross-Boarding Flow)

以下は、あるBoardから別のBoardの情報を読み取り、操作を生成するシナリオです。

1. **状況:** ユーザーは「MyHouseプロジェクト」の「Layout Board」を開き、AI Chatを立ち上げます。
2. **送信コンテキスト:**
   ```json
   {
      "context": {
         "projectId": "proj_myhouse_123",
         "projectName": "MyHouse",
         "activeBoardId": "board_layout_456",
         "activeBoardType": "layout"
      }
   }
   ```
3. **ユーザー入力:** 「要件で決まったとおりに、ソファとテーブルを配置して」
4. **AIの内部処理:**
   - (a) `projectId: proj_myhouse_123` を元に、このプロジェクトの「Requirements Board」を自律的に Firebase 検索。
   - (b) Requirements Board 内の Items (テキストやメモ) を取得し、「2人掛けのソファと丸型テーブルが必要」という要件を読み取る。
   - (c) AI Drive (または `publicModelIndex`) を叩き、該当する家具IDを特定。
   - (d) 現在の `activeBoardId: board_layout_456` に向けて、アイテムを配置する `executeAIAction` を生成する。

## 5. Agent プロンプトの方針 (Prompt Engineering Strategy)
- 今後の `baseRules` では、**「あなたは Project (案件全体) に対して働く AI であり、現在は特定の Board でユーザーをサポートしている」**というメタ認知を持たせます。
- AIが発行できるFunction Calling の対象に、「指定したBoard内のItemsを読む (`readBoardItems`)」を追加拡張し、Project 内の別 Board 情報をオンデマンドで取得させます。

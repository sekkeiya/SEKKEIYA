# Project / Board Lifecycle & Flow Diagram

## 概要 (Overview)
この図は、SEKKEIYA エコシステムにおいて、プロジェクトが作成され、標準ボードが自動生成され、AIコンテキストがどのように読み書きされるかを示す Mermaid 構造図です。すべての要素は基本的なコアシステムマップの層（User → SEKKEIYA → Project → Boards → Board → Item → Asset → AI Drive → AI Chat → AI Response）に準拠しています。

```mermaid
flowchart TD
    %% Styling
    classDef sekkeiya fill:#2980b9,stroke:#2471a3,stroke-width:2px,color:#fff
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef board fill:#27ae60,stroke:#2ecc71,stroke-width:2px,color:#fff
    classDef item fill:#f39c12,stroke:#d68910,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff

    subgraph Phase1_Creation [1. 案件プロジェクト作成]
        User1[User]
        Sekkeiya_App[SEKKEIYA]:::sekkeiya
        Proj_Create[Project]:::project
        Boards_Root[Boards]:::board
        
        ReqBoard[Requirements Board]:::board
        ModBoard[Models Board]:::board
        LayBoard[Layout Board]:::board
        PreBoard[Presents Board]:::board

        User1 -->|新規作成| Sekkeiya_App
        Sekkeiya_App --> Proj_Create
        Proj_Create --> Boards_Root
        Boards_Root -->|自動生成| ReqBoard
        Boards_Root -->|自動生成| ModBoard
        Boards_Root -->|自動生成| LayBoard
        Boards_Root -->|自動生成| PreBoard
    end

    subgraph Phase2_Work [2. ボード内での作業]
        User2[User]
        WorkBoard[Active Board]:::board
        NewItem[Item]:::item
        NewAsset[Asset / Metadata]:::item
        
        User2 --> WorkBoard
        WorkBoard -->|追加| NewItem
        NewItem --> NewAsset
    end

    subgraph Phase3_AI [3. AI文脈統合と相互参照]
        User3[User]
        AID[AI Drive]:::ai
        AIC[AI Chat]:::ai
        AIR[AI Response / Action]:::ai
        SourceBoard[Source Board]:::board
        TargetBoard[Target Board]:::board
        
        User3 --> AIC
        Proj_Create -.->|コンテキスト提供| AID
        SourceBoard -.->|コンテキスト提供| AID
        AID --> AIC
        
        AIC --> AIR
        AIR -->|提案・配置| TargetBoard
    end
```

## フローの重要ポイント
1. **即座の環境構築:** ユーザーが Project を生成した瞬間、Boards を経由して要件定義からプレゼンまでを網羅する空の Board 群が生成されます。
2. **アイテムの独立と参照:** 操作は常に Board 内の Item として格納され、実体は Asset として存在します。
3. **AIによるクロスボーディング:** AI Chat は AI Drive を通じて Project 全体のコンテキストを読み取り、現在の Board だけでなく他の Board（Source Board 等）をまたいで AI Response / Action を返します。

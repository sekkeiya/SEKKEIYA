# SEKKEIYA Final System Map (The Architect's Blueprint)

## 概要 (Overview)
このモデルは、SEKKEIYA エコシステムにおけるデータとコンテキストの最終的な統一アーキテクチャを示すマスタップです。すべての開発者・AIエージェントは、実装時にこの階層と依存関係を厳格に遵守する必要があります。

```mermaid
flowchart TD
    %% Styling
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px,color:#333
    classDef user fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef sekkeiya fill:#2980b9,stroke:#2471a3,stroke-width:2px,color:#fff
    classDef project fill:#2c3e50,stroke:#1a252f,stroke-width:2px,color:#fff
    classDef boards fill:#27ae60,stroke:#1e8449,stroke-width:2px,color:#fff
    classDef board fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#fff
    classDef item fill:#f39c12,stroke:#d68910,stroke-width:2px,color:#fff
    classDef asset fill:#d35400,stroke:#ba4a00,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#7d3c98,stroke-width:2px,color:#fff
    classDef action fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:#fff

    %% 構造の定義 (Structure)
    subgraph Architecture_Layers [SEKKEIYA 10-Layer Ecosystem]
        L1_User[User]:::user
        
        L2_Sekkeiya[SEKKEIYA]:::sekkeiya
        
        L3_Project[Project]:::project
        
        L4_Boards[Boards]:::boards
        
        L5_Board_Req[Requirements Board : SEKKEIYA]:::board
        L5_Board_Mod[Models Board : 3DSS]:::board
        L5_Board_Lay[Layout Board : 3DSL]:::board
        L5_Board_Pre[Presents Board : 3DSP]:::board
        L5_Board_Ana[Analysis Board : SEKKEIYA]:::board
        
        L6_Item[Item]:::item
        
        L7_Asset[Asset / Metadata]:::asset
        
        L8_AIDrive[AI Drive]:::ai
        
        L9_AIChat[AI Chat]:::ai
        
        L10_AIResponse[AI Response / Action]:::action
        
        %% リレーション (Relations)
        L1_User --> L2_Sekkeiya
        L2_Sekkeiya --> L3_Project
        L3_Project --> L4_Boards
        
        L4_Boards --> L5_Board_Req
        L4_Boards --> L5_Board_Mod
        L4_Boards --> L5_Board_Lay
        L4_Boards --> L5_Board_Pre
        L4_Boards --> L5_Board_Ana
        
        L5_Board_Req --> L6_Item
        L5_Board_Mod --> L6_Item
        L5_Board_Lay --> L6_Item
        L5_Board_Pre --> L6_Item
        L5_Board_Ana --> L6_Item
        
        L6_Item --> L7_Asset
        
        L7_Asset -.->|インデックス化| L8_AIDrive
        L3_Project -.->|検索対象| L8_AIDrive
        
        L8_AIDrive --> L9_AIChat
        L1_User -.->|指示| L9_AIChat
        
        L9_AIChat --> L10_AIResponse
        
        L10_AIResponse -.->|変更適用| L3_Project
        L10_AIResponse -.->|自動生成| L5_Board_Req
        L10_AIResponse -.->|自動配置| L5_Board_Lay
        L10_AIResponse -.->|修正| L6_Item
        L10_AIResponse -.->|操作| L7_Asset
    end
```

## 哲学 (Philosophy)
1. **The World:** `Project` (案件・企画の境界線であり、権限と文脈のコンテナ)
2. **The Workspace:** `Board` (ユーザーとアプリ間の担当ごとの作業領域)
3. **The Pointer:** `Item` (各Boardにピン留めされた、実体への軽量な参照)
4. **The Content:** `Asset` (3Dモデルファイルやメモなどの重い実体データ)
5. **The Brain:** `AI` (全体を俯瞰し横断的にユーザーを助け、自律アクションを起こす主体)

# OS / Generator Responsibility Map

## 概要 (Overview)
SEKKEIYA（OSクラスの親アプリ）と各子アプリ（3DSS, 3DSL, 3DSP等ジェネレーター）が、それぞれどの階層のデータと機能を管轄しているかを示す責任推移図です。「1 Project = 1 Website」の原則に基づき、OSがプロジェクト全体を、ジェネレーターが個別セクションのコンテンツ生成を担います。

```mermaid
flowchart LR
    %% Styling
    classDef sekkeiya fill:#2980b9,stroke:#2471a3,stroke-width:2px,color:#fff
    classDef apps fill:#16a085,stroke:#117a65,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#7d3c98,stroke-width:2px,color:#fff

    Sekkeiya[SEKKEIYA OS]:::sekkeiya

    subgraph SekkeiyaScope [SEKKEIYA OS 管轄 (全体統合・パブリッシュ・AI)]
        P[Project Website]
        Str[Thinking Layer / Strategy]
        Sec[Website Sections Config]
        Pub[Public/Internal Views]
        U[User Profile / Identity]
        AD[AI Drive - Knowledge Base]:::ai
        AC[AI Chat - Navigator]:::ai
        AR[AI Response / Gen Action]:::ai
    end

    subgraph AppScope [Generator Apps 管轄 (コンテンツ生成・編集)]
        G_Mod[3DSS : Models Generator]:::apps
        G_Lay[3DSL : Drawings Generator]:::apps
        G_Pre[3DSP : Slides Generator]:::apps
        
        SecItems[Section Items Container]:::apps
        A[Asset / Storage 実体アクセス]:::apps
    end

    Sekkeiya --> P
    Sekkeiya --> Str
    Sekkeiya --> Sec
    Sekkeiya --> Pub

    P --> AD
    Sec --> G_Mod
    Sec --> G_Lay
    Sec --> G_Pre
    
    G_Mod -.->|生成/編集 (subcollection)| SecItems
    G_Lay -.->|生成/編集 (subcollection)| SecItems
    G_Pre -.->|生成/編集 (subcollection)| SecItems
    
    SecItems --> A
```

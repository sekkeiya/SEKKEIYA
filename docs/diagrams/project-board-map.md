# Project vs Board マップ

Project（案件・目的）と Board（作業・分類空間）の階層定義、および各サブアプリとの繋がりを示します。

```mermaid
flowchart TD
    classDef project fill:#ede7f6,stroke:#9575cd,color:#311b92,stroke-width:2px;
    classDef board fill:#fff3e0,stroke:#ffb74d,color:#e65100,stroke-width:1px;
    classDef subapp fill:#eceff1,stroke:#b0bec5,color:#37474f,stroke-dasharray: 3 3;

    Proj["Project<br>(案件 / 目的 / 文脈)<br>★ Single Source of Truth"]:::project
    
    Members["Project Members"]
    Meta["Project Requirements & Meta"]
    Boards["Project Boards (Workspace)"]
    Items["Project Items (All Pointers)"]
    
    B_Ref["Models Board"]:::board
    B_Layout["Layout Board"]:::board
    B_Presen["Presents Board"]:::board

    App_3DSS["3DSS (Models)"]:::subapp
    App_3DSL["3DSL (Layouts)"]:::subapp
    App_3DSP["3DSP (Presents)"]:::subapp

    Proj --> Members
    Proj --> Meta
    Proj --> Items
    Proj --> Boards
    
    Boards --> B_Ref
    Boards --> B_Layout
    Boards --> B_Presen

    B_Ref -->|"参照"| App_3DSS
    B_Layout -->|"配置"| App_3DSL
    B_Presen -->|"スライド"| App_3DSP
```

**補足説明:**
- **Project**: 「何の目的で集まっているかのコンテナ（SSOT）」。全体をまとめる権限、参加者の単位、またAIが解釈すべき要件（Requirements）はここに格納される。
- **Board**: Project内で生じる「用途別・作業別の空間（Workspace）」。
- 例：ひとつのProject（カフェ内装設計など）の中に、モデリングのインスピレーションを集めるModels Board、実際のレイアウト図（3DSL）を集めるLayout Board、会議用のプレゼン（3DSP）をまとめるPresents Boardなどが論理的に並列して存在します。要件自体はProject直下のMetadataとして管理されます。

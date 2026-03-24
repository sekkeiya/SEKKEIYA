# Project vs Board マップ

Project（案件・目的）と Board（作業・分類空間）の階層定義、および各サブアプリとの繋がりを示します。

```mermaid
flowchart TD
    classDef project fill:#ede7f6,stroke:#9575cd,color:#311b92,stroke-width:2px;
    classDef board fill:#fff3e0,stroke:#ffb74d,color:#e65100,stroke-width:1px;
    classDef subapp fill:#eceff1,stroke:#b0bec5,color:#37474f,stroke-dasharray: 3 3;

    Proj["Project<br>(案件 / 目的 / 文脈)"]:::project
    
    Members["Project Members"]
    Boards["Project Boards (複数)"]
    
    B_Ref["参考モデル Board"]:::board
    B_Layout["レイアウト Board"]:::board
    B_Presen["プレゼン Board"]:::board
    B_Req["要件整理 Board"]:::board

    App_3DSS["3DSS (Models)"]:::subapp
    App_3DSL["3DSL (Layouts)"]:::subapp
    App_3DSP["3DSP (Presents)"]:::subapp
    App_Req["Requirements / Notes"]:::subapp

    Proj --> Members
    Proj --> Boards
    
    Boards --> B_Ref
    Boards --> B_Layout
    Boards --> B_Presen
    Boards --> B_Req

    B_Ref -->|"参照"| App_3DSS
    B_Layout -->|"配置"| App_3DSL
    B_Presen -->|"スライド"| App_3DSP
    B_Req -->|"メモ"| App_Req
```

**補足説明:**
- **Project**: 「何の目的で集まっているか（案件名など）」のコンテナ。全体をまとめる権限や参加者の単位です。
- **Board**: Project内で生じる「用途別・作業別の空間」。
- 例：ひとつのProject（カフェ内装設計など）の中に、モデリングのインスピレーションを集めるBoard、実際のレイアウト図（3DSL）を集めるBoard、会議用のプレゼン（3DSP）をまとめるBoardなどが論理的に並列して存在します。

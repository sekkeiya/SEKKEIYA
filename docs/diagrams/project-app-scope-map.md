# Project / App Scope Map

## 概要 (Overview)
この図は、SEKKEIYAの「Project」単位内に内包される各 Board が、エコシステム上のどの子アプリ (appScope) に対応しているかを示す Mermaid フローチャートです。
すべての基本階層（User → SEKKEIYA → Project → Boards → Board → Item → Asset / Metadata → AI Drive → AI Chat → AI Response / Action）に準拠しています。

```mermaid
flowchart TD
    %% Styling
    classDef sekkeiya fill:#2980b9,stroke:#3498db,stroke-width:2px,color:#fff
    classDef app3dss fill:#16a085,stroke:#1abc9c,stroke-width:2px,color:#fff
    classDef app3dsl fill:#d35400,stroke:#e67e22,stroke-width:2px,color:#fff
    classDef app3dsp fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef boards fill:#27ae60,stroke:#2ecc71,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff

    User[User] --> Sekkeiya[SEKKEIYA]:::sekkeiya
    Sekkeiya --> Proj[Project]:::project
    Proj --> Bds[Boards]:::boards

    subgraph Workspaces [Board 領域 (アプリへのルーティング)]
        Req[Requirements Board]:::sekkeiya
        Mod[Models Board]:::app3dss
        Lay[Layout Board]:::app3dsl
        Pre[Presents Board]:::app3dsp
        Ana[Analysis Board]:::sekkeiya
    end

    Bds --> Req
    Bds --> Mod
    Bds --> Lay
    Bds --> Pre
    Bds --> Ana

    Req -.->|appScope = sekkeiya| SekApp1((SEKKEIYA)):::sekkeiya
    Mod -.->|appScope = 3dss| DSSApp((3DSS)):::app3dss
    Lay -.->|appScope = 3dsl| DSLApp((3DSL)):::app3dsl
    Pre -.->|appScope = 3dsp| DSPApp((3DSP)):::app3dsp
    Ana -.->|appScope = sekkeiya| SekApp2((SEKKEIYA)):::sekkeiya

    %% AI レイヤーの統合表示
    AID[AI Drive]:::ai
    AIC[AI Chat]:::ai
    AIR[AI Response / Action]:::ai

    Proj -.->|全Boardのコンテクスト提供| AID
    AID --> AIC
    User -.-> AIC
    AIC --> AIR
    AIR -.->|結果適用| Req
    AIR -.->|結果適用| Mod
    AIR -.->|結果適用| Lay
    AIR -.->|結果適用| Pre
    AIR -.->|結果適用| Ana
```

## appScope の概念
Firestore 上の Board エンティティには `appScope` (例: `"3dss"`, `"3dsl"`) が定義されます。
ユーザーが「Models Board」をタップした場合、SEKKEIYA アプリはそれを検知し、適切な子アプリ (3DSS) へ `projectId` および `boardId` のコンテキストを付与して画面やルーティングを切り替えます。

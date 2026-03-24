# Responsibility Map

## 概要 (Overview)
SEKKEIYA（親アプリ）と各子アプリ（3DSS, 3DSL, 3DSP等）が、それぞれどの階層のデータと機能を管轄しているかを示す責任推移図です。

```mermaid
flowchart LR
    %% Styling
    classDef sekkeiya fill:#2980b9,stroke:#2471a3,stroke-width:2px,color:#fff
    classDef apps fill:#16a085,stroke:#117a65,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#7d3c98,stroke-width:2px,color:#fff

    Sekkeiya[SEKKEIYA]:::sekkeiya

    subgraph SekkeiyaScope [SEKKEIYA 管轄 (マクロ・基盤)]
        P[Project]
        Bs[Boards]
        U[User Profile / Teams]
        AD[AI Drive]:::ai
        AC[AI Chat]:::ai
        AR[AI Response / Action]:::ai
    end

    subgraph AppScope [子アプリ 管轄 (ミクロ・作業実体)]
        B_Mod[Models Board : 3DSS]:::apps
        B_Lay[Layout Board : 3DSL]:::apps
        B_Pre[Presents Board : 3DSP]:::apps
        
        I[Item]
        A[Asset / Metadata]
    end

    Sekkeiya --> SekkeiyaScope
    Sekkeiya --> AppScope

    Bs --> B_Mod
    Bs --> B_Lay
    Bs --> B_Pre
    
    B_Mod --> I
    B_Lay --> I
    B_Pre --> I
    
    I --> A
```

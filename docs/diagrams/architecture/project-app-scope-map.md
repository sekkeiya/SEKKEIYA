# Project / Generator App Routing Map

## 概要 (Overview)
この図は、SEKKEIYAの「Project Website」内の各セクションが、エコシステム上のどの子アプリ (Generator) によって生成・編集されるかを示す定式的なルーティングマップです。
1 Project = 1 Website のアーキテクチャにおいて、各アプリがプロジェクトの特定の構成要素（Section）を担う形を可視化しています。

```mermaid
flowchart TD
    %% Styling
    classDef sekkeiya fill:#2980b9,stroke:#3498db,stroke-width:2px,color:#fff
    classDef app3dss fill:#16a085,stroke:#1abc9c,stroke-width:2px,color:#fff
    classDef app3dsl fill:#d35400,stroke:#e67e22,stroke-width:2px,color:#fff
    classDef app3dsp fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef sections fill:#27ae60,stroke:#2ecc71,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff

    User[User]
    Sekkeiya[SEKKEIYA OS]:::sekkeiya
    Proj[Project Website]:::project
    Secs[Website Sections]:::sections

    User --> Sekkeiya
    Sekkeiya --> Proj
    Proj --> Secs

    subgraph Sections
        Lan[Landing Section]:::sekkeiya
        Str[Strategy/Thinking Section]:::sekkeiya
        Mod[Models Section]:::app3dss
        Dra[Drawings/Layout Section]:::app3dsl
        Sli[Slides/Presents Section]:::app3dsp
        Ana[Analysis Section]:::sekkeiya
    end

    Secs --> Lan
    Secs --> Str
    Secs --> Mod
    Secs --> Dra
    Secs --> Sli
    Secs --> Ana

    SekApp1((SEKKEIYA<br>Core)):::sekkeiya
    DSSApp((3DSS<br>Generator)):::app3dss
    DSLApp((3DSL<br>Generator)):::app3dsl
    DSPApp((3DSP<br>Generator)):::app3dsp
    SekApp2((SEKKEIYA<br>Core)):::sekkeiya

    Lan -->|Managed by OS| SekApp1
    Str -->|Managed by OS| SekApp1
    Mod -->|Generated via 3DSS| DSSApp
    Dra -->|Generated via 3DSL| DSLApp
    Sli -->|Generated via 3DSP| DSPApp
    Ana -->|Managed by OS| SekApp2

    %% AI レイヤーの統合表示
    AID[AI Drive]:::ai
    AIC[AI Chat]:::ai
    AIR[AI Response / Generator Action]:::ai

    Proj -->|全セクションのコンテンツ提供| AID
    AID --> AIC
    User -.-> AIC
    AIC --> AIR
    AIR -->|UI構成/生成| Lan
    AIR -->|3Dモデル生成| Mod
    AIR -->|レイアウト生成| Dra
    AIR -->|スライド構成| Sli
    AIR -->|分析実行| Ana
```

## Section-based Routing
Firestore上の Project エンティティ配下には各セクションのサブコレクション（例: `projects/{projectId}/models`）が存在します。
ユーザーが特定セクションの編集（Edit Mode）を開始すると、SEKKEIYA OSはURLパラメータ（`?projectId=XYZ`）と共に適切なジェネレーターアプリ（3DSSなど）へルーティングします。
各ジェネレーターアプリは、Project IDと自身の担当Sectionを知っているため、適切なデータをシームレスに読み書きします。

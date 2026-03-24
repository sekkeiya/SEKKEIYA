# Project / App Scope Map

## 概要 (Overview)
この図は、SEKKEIYAの「プロジェクト単位」の中に内包される各ボードが、エコシステム上のどの子アプリ (appScope) に対応しているかを示す Mermaid フローチャートです。
Project は全体の世界・コンテキストを定義し、各 Board は個別の領域（アプリ機能）へユーザーをルーティングします。

```mermaid
flowchart TD
    %% Styling
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef sekkeiya fill:#2980b9,stroke:#3498db,stroke-width:2px,color:#fff
    classDef app3dss fill:#16a085,stroke:#1abc9c,stroke-width:2px,color:#fff
    classDef app3dsl fill:#d35400,stroke:#e67e22,stroke-width:2px,color:#fff
    classDef app3dsp fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff

    subgraph The_World [Project 領域 (全体管理)]
        Project[Project : MyHouse]:::project
    end

    Project --> BoardReq
    Project --> BoardMod
    Project --> BoardLay
    Project --> BoardPre
    Project --> BoardAna

    subgraph The_Workspaces [Board 領域 (作業単位・アプリへのルーティング)]
        BoardReq[Requirements Board\n(要件定義・与件情報)]:::sekkeiya --> AppSek_Req((SEKKEIYA\nApp Scope)):::sekkeiya
        
        BoardMod[Models Board\n(3Dアセット管理)]:::app3dss --> App3DSS((3DSS\nApp Scope)):::app3dss
        
        BoardLay[Layout Board\n(空間レイアウト構築)]:::app3dsl --> App3DSL((3DSL\nApp Scope)):::app3dsl
        
        BoardPre[Presents Board\n(プレゼンスライド)]:::app3dsp --> App3DSP((3DSP\nApp Scope)):::app3dsp
        
        BoardAna[Analysis Board\n(解析・分析)]:::sekkeiya --> AppSek_Ana((SEKKEIYA\nApp Scope)):::sekkeiya
    end

    %% AI の横断性
    AI((AI Context Layer\nCross-Board Intelligence)) -.->|Context 読取| BoardReq
    AI -.->|Context 読取| BoardMod
    AI -.->|Context 読取| BoardLay
    AI -.->|Context 読取| BoardPre
    AI -.->|Context 読取| BoardAna

    %% 役割の説明
    subgraph Legend [役割 (Roles)]
        L1[SEKKEIYA : 全体管理, 要件, 分析]:::sekkeiya
        L2[3DSS : 3Dアイテム登録・閲覧]:::app3dss
        L3[3DSL : 3D配置と空間構成]:::app3dsl
        L4[3DSP : アウトプット・プレゼン]:::app3dsp
    end
```

## appScope の概念
Firestore 上の Board エンティティには `appScope` (例: `"3dss"`, `"3dsl"`) が定義されます。
ユーザーが「Models Board」をタップした場合、SEKKEIYA アプリはそれを検知し、適切な子アプリ (3DSS) へ `projectId` および `boardId` のコンテキストを付与して画面やルーティングを切り替えます。

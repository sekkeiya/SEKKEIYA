# SEKKEIYA Final System Map (The Architect's Blueprint)

## 概要 (Overview)
このモデルは、SEKKEIYA エコシステムにおける「1 Project = 1 Website」思想を反映した最終アーキテクチャです。SEKKEIYAは単なるポータルではなく、プロジェクトページを完成させるためのOSです。

```mermaid
flowchart TD
    %% Styling
    classDef default fill:#f9f9f9,stroke:#333,stroke-width:1px,color:#333
    classDef user fill:#e74c3c,stroke:#c0392b,stroke-width:2px,color:#fff
    classDef sekkeiya fill:#2980b9,stroke:#2471a3,stroke-width:2px,color:#fff
    classDef project fill:#2c3e50,stroke:#1a252f,stroke-width:2px,color:#fff
    classDef section fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#fff
    classDef app fill:#d35400,stroke:#ba4a00,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#7d3c98,stroke-width:2px,color:#fff
    classDef mode fill:#16a085,stroke:#1abc9c,stroke-width:2px,color:#fff

    %% 構造の定義 (Structure)
    subgraph Architecture_Layers [SEKKEIYA OS Ecosystem]
        L1_User[User]:::user
        
        L2_Sekkeiya[SEKKEIYA - OS Layer]:::sekkeiya
        
        L3_Project[Project - Website Deliverable]:::project
        
        L4_Sec_Lan[Landing]:::section
        L4_Sec_Str[Strategy/Thinking]:::section
        L4_Sec_Mod[Models]:::section
        L4_Sec_Dra[Drawings]:::section
        L4_Sec_Ren[Renders]:::section
        L4_Sec_Mov[Movies]:::section
        L4_Sec_Art[Articles]:::section
        L4_Sec_Sli[Slides]:::section
        L4_Sec_Ana[Analysis]:::section
        
        L5_Mode_Edit[Edit Mode]:::mode
        L5_Mode_Int[Internal View]:::mode
        L5_Mode_Pub[Public View /p/:slug]:::mode
        
        L6_App_3DSS[3DSS - Generator]:::app
        L6_App_3DSL[3DSL - Generator]:::app
        L6_App_3DSC[3DSC - Generator]:::app
        L6_App_3DSP[3DSP - Generator]:::app
        L6_App_3DSB[3DSB - Generator]:::app
        L6_App_3DSQ[3DSQ - Generator]:::app
        
        L8_AIDrive[AI Drive - Context Store]:::ai
        L9_AIChat[AI Chat - Navigator]:::ai
        
        %% リレーション (Relations)
        L1_User --> L2_Sekkeiya
        L2_Sekkeiya --> L3_Project
        L3_Project --> L4_Sec_Lan
        L3_Project --> L4_Sec_Str
        L3_Project --> L4_Sec_Mod
        L3_Project --> L4_Sec_Dra
        L3_Project --> L4_Sec_Ren
        L3_Project --> L4_Sec_Mov
        L3_Project --> L4_Sec_Art
        L3_Project --> L4_Sec_Sli
        L3_Project --> L4_Sec_Ana
        
        L3_Project --- L5_Mode_Edit
        L3_Project --- L5_Mode_Int
        L3_Project --- L5_Mode_Pub
        
        L6_App_3DSS -.->|Feeds| L4_Sec_Mod
        L6_App_3DSL -.->|Feeds| L4_Sec_Dra
        L6_App_3DSL -.->|Feeds| L4_Sec_Ana
        L6_App_3DSC -.->|Feeds| L4_Sec_Mod
        L6_App_3DSC -.->|Feeds| L4_Sec_Ren
        L6_App_3DSP -.->|Feeds| L4_Sec_Sli
        L6_App_3DSB -.->|Feeds| L4_Sec_Art
        L6_App_3DSQ -.->|Feeds| L4_Sec_Ana
        
        L3_Project -.->|Context| L8_AIDrive
        L8_AIDrive --> L9_AIChat
        L1_User -.->|Orchestrates via| L9_AIChat
        L9_AIChat -.->|Generates content for| L3_Project
    end
```

## 哲学 (Philosophy)
1. **The Ecosystem:** `SEKKEIYA` (プロジェクト全体をオーケストレーションし、生成を司るOS)
2. **The Output:** `Project` (編集・公開可能な最終成果物としてのWebサイト)
3. **The Sections:** `Landing, Models, Drawings, Renders...` (プロジェクトサイトを構成する各セクション)
4. **The Generators:** `Child Apps (3DSS, etc.)` (プロジェクトの特定セクションにアセットとデータを供給するための生産装置)
5. **The Brain:** `AI` (全体を横断し、サイト完成へのガイドと自動生成を行うエンジン)

# Project Generation & Lifecycle Flow Diagram

## 概要 (Overview)
この図は、SEKKEIYA エコシステムにおいて、プロジェクトが作成され、標準セクションが自動生成され、AIコンテキストがどのように読み書きされるかを示す構造図です。ユーザーの「MyBoard / TeamBoard」時代から完全な「1 Project = 1 Website」制にシフトしています。

```mermaid
flowchart TD
    %% Styling
    classDef sekkeiya fill:#2980b9,stroke:#2471a3,stroke-width:2px,color:#fff
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef section fill:#27ae60,stroke:#2ecc71,stroke-width:2px,color:#fff
    classDef item fill:#f39c12,stroke:#d68910,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff

    subgraph Phase1_Creation [1. 案件プロジェクト作成]
        User1[User]
        Sekkeiya_App[SEKKEIYA OS]:::sekkeiya
        Proj_Create[Project Website]:::project
        Proj_MetaData[Project Metadata<br/>Requirements]:::project
        Sections_Root[Website Sections]:::section
        
        ModSection[Models Section]:::section
        LaySection[Layout Section]:::section
        PreSection[Presents Section]:::section

        User1 -->|新規プロジェクト作成| Sekkeiya_App
        Sekkeiya_App --> Proj_Create
        Proj_Create --> Proj_MetaData
        Proj_Create --> Sections_Root
        Sections_Root -->|自動生成| ModSection
        Sections_Root -->|自動生成| LaySection
        Sections_Root -->|自動生成| PreSection
    end

    subgraph Phase2_Work [2. セクション内での生成とアイテム管理]
        User2[User]
        WorkSection[Active Generator View]:::section
        NewItem[Item]:::item
        NewAsset[Asset / Metadata]:::item
        
        User2 --> WorkSection
        WorkSection -.->|UIフィルター表示| NewItem
        Proj_Create -->|Item追加と所有| NewItem
        NewItem --> NewAsset
    end

    subgraph Phase3_AI [3. AI文脈としてのProject Website]
        User3[User]
        AID[AI Drive]:::ai
        AIC[AI Chat]:::ai
        AIR[AI Response / Generator Action]:::ai
        TargetSection[Target Section]:::section
        
        User3 --> AIC
        Proj_MetaData -.->|プロジェクト要件を常時展開| AID
        ModSection -.->|コンテキスト提供| AID
        AID --> AIC
        
        AIC --> AIR
        AIR -->|提案・配置・アイテム生成| Proj_Create
    end
```

## フローの重要ポイント
1. **SSOTの集中:** ユーザーが Project を生成した瞬間、`metadata` に要件を保存でき、Sections を経由して各ジェネレーターアプリへ遷移します。
2. **すべてのアイテムはプロジェクトへ:** 操作は Generator(Section) のUIで行われますが、Firestore上の保存はすべて `projects/{projectId}/items` に対して行われます。
3. **AIによる全体把握:** AI Chat は Project そのものの要件や全アイテムを包括的に把握できるため、単一のセクションに縛られない俯瞰的な提案とWebsiteの構成が可能です。

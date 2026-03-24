# Project / Board Lifecycle & Flow Diagram

## 概要 (Overview)
この図は、SEKKEIYA エコシステムにおいて、プロジェクトが作成され、標準ボードが自動生成され、AIコンテキストがどのように読み書きされるかを示す Mermaid 構造図です。

```mermaid
flowchart TD
    %% Styling
    classDef project fill:#2c3e50,stroke:#34495e,stroke-width:2px,color:#fff
    classDef board fill:#27ae60,stroke:#2ecc71,stroke-width:2px,color:#fff
    classDef ai fill:#8e44ad,stroke:#9b59b6,stroke-width:2px,color:#fff
    classDef action fill:#d35400,stroke:#e67e22,stroke-width:2px,color:#fff

    subgraph 1_Project_Creation [1. 案件 / プロジェクト作成]
        U[User] -->|新規プロジェクト作成| P_Create
        P_Create[System inserts `projects/{projectId}`]:::project --> B_Gen{自動標準ボード生成}
        
        B_Gen --> B_Req[Requirements Board\n(SEKKEIYA)]:::board
        B_Gen --> B_Mod[Models Board\n(3DSS)]:::board
        B_Gen --> B_Lay[Layout Board\n(3DSL)]:::board
        B_Gen --> B_Pre[Presents Board\n(3DSP)]:::board
        B_Gen --> B_Ana[Analysis Board\n(SEKKEIYA)]:::board
    end

    subgraph 2_Item_Management [2. ボード内での作業]
        User1[User in 3DSS] -->|モデル追加| I_Add[System inserts item into\n`projects/{projectId}/boards/{modelBoardId}/items`]:::action
        User2[User in 3DSL] -->|レイアウト保存| I_Lay[System inserts layout state into\n`projects/{projectId}/boards/{layoutBoardId}/items`]:::action
    end

    subgraph 3_AI_Context_Flow [3. AI文脈統合と相互参照]
        AIChat[User opens AI Chat\nin Layout Board] -->|現在の文脈送信| CtxGen[Context:\nProject = MyHouse\nActiveBoard = Layout Board]:::action
        CtxGen --> AI_Engine((AI Agent)):::ai
        
        AI_Engine -.->|Read| B_Req
        AI_Engine -.->|Read| B_Lay
        AI_Engine -->|Generate/Suggest| AI_Resp[新しいレイアウトの提案を\nLayout Boardへ反映]:::action
        
        AIDrive[User opens AI Drive] -->|現在の文脈送信| CtxGen2[Context:\nProject = MyHouse]:::action
        CtxGen2 --> AI_Drive_Engine((AI Drive)):::ai
        AI_Drive_Engine -.->|Cross-Search| B_Mod
        AI_Drive_Engine -.->|Cross-Search| B_Pre
    end
```

## フローの重要ポイント
1. **即座の環境構築:** ユーザーが「MyHouseプロジェクト」を1つ作った瞬間、要件定義からプレゼンまでを網羅する空の「Board群」が用意されます。
2. **アイテムの独立と参照:** アセット追加操作は常に「対象Board」内に格納され、Firestore上で物理的に整理された状態を保ちます。
3. **AIによるクロスボーディング:** AIは自明の `projectId` を受け取るため、現在開いているボード(例えばLayout)だけでなく、同じプロジェクト内の別ボード(Requirements)を自律的に参照して提案が行えます。

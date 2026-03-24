# 3Dモデル データフロー (Data Flow)

3Dモデルがアップロードされてから、Board に登録され、AI Chat や AI Drive で活用されるまでの一連の流れです。将来のAI連携を見据えた構造になっています。

```mermaid
flowchart TD
    %% Define Styles
    classDef action fill:#fff3e0,stroke:#ffb74d,color:#e65100;
    classDef db fill:#e3f2fd,stroke:#64b5f6,color:#0d47a1;
    classDef ai fill:#e8f5e9,stroke:#81c784,color:#1b5e20;

    Upload["1. モデルアップロード<br>(3DSS)"]:::action
    SaveModel["2. users/{userId}/models/{modelId}<br>への保存"]:::db
    SaveIndex["3. publicModelIndex への同期<br>(公開時)"]:::db
    
    BoardAdd["4. Board への登録操作"]:::action
    CreateRef["5. BOARD_MODEL_REFS<br>の作成 (実体コピーなし)"]:::db
    
    ViewBoard["6. Board 画面での表示<br>(参照IDから実体をFetch)"]:::action
    
    AIDialog["7. AI Chat に質問<br>「このモデルに合うものは？」"]:::ai
    AIFetch["8. AI が Board 文脈<br>から modelRef を読み取る"]:::ai
    AIResponse["9. AI による<br>推薦・アドバイス完了"]:::ai

    Upload --> SaveModel
    SaveModel --> SaveIndex
    SaveModel --> BoardAdd
    BoardAdd --> CreateRef
    CreateRef --> ViewBoard
    ViewBoard --> AIDialog
    AIDialog --> AIFetch
    AIFetch --> AIResponse
```

**補足説明:**
- 実体モデルデータは一度しか保存されず（`users/{uid}/models`）、以降の全ての利用（Board、AI分析など）は参照（modelRef）を介して行われます。
- AI Chat や AI Drive からデータにアプローチする際も、この参照ツリーを辿ることで「現在のプロジェクトやBoardで扱っている具体的な資産」を安全かつ高速に把握できます。

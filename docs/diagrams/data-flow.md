# Asset データフロー (Data Flow)

成果物（Asset）が作成されてから、Board に登録され、AI Chat や AI Drive で活用されるまでの一連の流れです。将来のAI連携を見据えた堅牢な構造になっています。

```mermaid
flowchart TD
    %% Define Styles
    classDef action fill:#fff3e0,stroke:#ffb74d,color:#e65100;
    classDef db fill:#e3f2fd,stroke:#64b5f6,color:#0d47a1;
    classDef ai fill:#e8f5e9,stroke:#81c784,color:#1b5e20;

    Upload["1. アセット生成/アップロード<br>(3DSS等)"]:::action
    SaveAsset["2. users/{userId}/assets/{assetId}<br>への保存 (実体のSSOT)"]:::db
    SaveIndex["3. Public Asset Index への同期<br>(公開設定時)"]:::db
    
    BoardAdd["4. Board 上の Item として追加操作"]:::action
    CreateItem["5. {boardId}/items/{itemId}<br>の作成 (実体コピーなし、ポインタのみ)"]:::db
    
    ViewBoard["6. Board 画面での表示<br>(ItemからAsset実体を解決)"]:::action
    
    AIDialog["7. AI Chat に質問<br>「このモデルに合うものは？」"]:::ai
    AIFetch["8. AI が Project/Board 文脈<br>から Item を読み取る"]:::ai
    AIResponse["9. AI による<br>推薦・アクション（Item追加等）"]:::ai

    Upload --> SaveAsset
    SaveAsset --> SaveIndex
    SaveAsset --> BoardAdd
    BoardAdd --> CreateItem
    CreateItem --> ViewBoard
    ViewBoard --> AIDialog
    AIDialog --> AIFetch
    AIFetch --> AIResponse
```

**補足説明:**
- 実体データは一度しか保存されず（`users/{uid}/assets` や `users/{uid}/models`）、以降の全ての利用（Project/Board内の配置、AI分析など）は参照ポインタ（Item）を介して行われます。
- AI Chat や AI Drive からデータにアプローチする際も、この参照ツリーを辿ることで「現在のプロジェクトやBoardで扱っている具体的な資産」を安全かつ高速に把握できます。

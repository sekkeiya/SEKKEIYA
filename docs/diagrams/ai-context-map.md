# AI Context Map

ユーザーの入力したチャットメッセージに対して、AIがどのようにコンテキスト（背景情報）を読み解いて回答を生成するかのアプローチ図です。

```mermaid
flowchart LR
    classDef user fill:#e8eaf6,stroke:#9fa8da,color:#1a237e;
    classDef context fill:#e0f2f1,stroke:#80cbc4,color:#004d40;
    classDef ai fill:#fff3e0,stroke:#ffb74d,color:#e65100,stroke-width:2px;

    Msg["User Message<br>(ユーザーからの指示)"]:::user
    
    ProjCtx["Project Context<br>(案件前提)"]:::context
    BoardCtx["Board Context<br>(現在作業中の空間)"]:::context
    AssetCtx["Model / Layout / Asset<br>(選択中の具体物)"]:::context
    
    Drive["AI Drive<br>(過去知識のRAG検索)"]:::context
    
    AIResponse["AI Chat Response<br>(文脈を考慮した回答)"]:::ai

    Msg --> ProjCtx
    ProjCtx --> BoardCtx
    BoardCtx --> AssetCtx
    AssetCtx --> Drive
    Drive --> AIResponse
```

**補足説明:**
- ユーザーからの短い一言（例:「これに合うテーブルは？」）は、SEKKEIYAの階層を伝播することで詳細な「文脈」として具体化されます。
- 現在開いているProject（=何の案件か）→ Board（=どのジャンルか）→ 選択中のModel（=これ、の指す実体）に変換された上で、AI Drive（過去の知見や類似アセット）を検索し、高精度なAI応答を返します。

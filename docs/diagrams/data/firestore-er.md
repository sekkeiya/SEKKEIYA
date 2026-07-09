# Firestore ER Diagram

## 概要 (Overview)
SEKKEIYA エコシステム全体の設計を反映した Firestore スキーマの ER 図です。
旧構造の「My Boards / Team Boards」は廃止され、「Project (1 Website) → Sections & Items → Asset」という一貫した階層モデルに完全に統一されています。

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "owns / participates"
    USERS ||--o{ ASSETS : "owns"
    
    PROJECTS ||--o{ SECTIONS : "contains website sections"
    PROJECTS ||--o{ ITEMS : "owns pointers"
    ITEMS }o--|| ASSETS : "references"
    ITEMS }o--|| SECTIONS : "filtered by sectionId"

    USERS {
        string uid PK "ユーザーUID"
        string displayName "表示名"
        string email "メールアドレス"
    }

    PROJECTS {
        string id PK "projects/{projectId}"
        string name "プロジェクト名"
        map metadata "プロジェクト要件等のSSOTデータ"
        string ownerId "オーナーUID"
        array memberIds "参加メンバー"
    }

    SECTIONS {
        string id PK "projects/{projectId}/sections/{sectionId}"
        string name "セクション名"
        string generatorApp "担当ジェネレーター (3DSS / 3DSL 等)"
    }

    ITEMS {
        string id PK "projects/{projectId}/items/{itemId}"
        string sectionId FK "所属先のセクションID (ビューフィルタ用)"
        string entityId "AssetのID"
        string entityRef "Assetのフルパス"
        map snapshot "軽量キャッシュデータ"
    }

    ASSETS {
        string id PK "users/{uid}/models/{modelId}"
        string type "モデル/レイアウト/画像などの実体データ"
        string storageUrl "実ファイルのStorageパス"
    }
```

## 設計思想
1. **SSOT (Single Source of Truth):**
   - ユーザーの権限やコンテキストの起点は全て「Project」です。
   - 3Dモデルなどのバイナリや重い実データは「Asset」として独立して保存されます。
   - 昔「Requirements Board」として管理しようとしていたメタデータ・要件は、Project ドキュメント自体の中に統合されました。
2. **参照モデル:**
   - 「Item」は「Asset」のポインタです（`entityRef`）。
   - Project内の各Section（構成要素）は、Project内に保存されたItem群のうち、自身に紐づく(`sectionId`が一致する)Itemのみをフィルタリングして表示します。

# Firestore ER Diagram

## 概要 (Overview)
SEKKEIYA エコシステム全体の設計を反映した Firestore スキーマの ER 図です。
旧構造の「My Boards / Team Boards」は廃止され、「Project → Board → Item → Asset」という一貫した階層モデルに統一されています。

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "owns / participates"
    USERS ||--o{ ASSETS : "owns"
    
    PROJECTS ||--o{ BOARDS : "contains"
    BOARDS ||--o{ ITEMS : "contains"
    ITEMS }o--|| ASSETS : "references"

    USERS {
        string uid PK "ユーザーUID"
        string displayName "表示名"
        string email "メールアドレス"
    }

    PROJECTS {
        string id PK "projects/{projectId}"
        string name "プロジェクト名"
        string ownerId "オーナーUID"
        array memberIds "参加メンバー"
    }

    BOARDS {
        string id PK "projects/{projectId}/boards/{boardId}"
        string name "ボード名"
        string appScope "担当アプリケーション"
    }

    ITEMS {
        string id PK "projects/{projectId}/boards/{boardId}/items/{itemId}"
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
   - ユーザーの権限やコンテキストの起点は「Project」です。
   - 3Dモデルなどのバイナリや重い実データは「Asset」として独立して保存されます。
2. **参照モデル:**
   - 「Item」は「Asset」のポインタです（`entityRef`）。
   - Project内の各Boardは、必要なAssetをItemとして参照することで構成されます。

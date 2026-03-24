# ユーザー＆ソーシャルマップ

ユーザーを中心としたソーシャルグラフと、公開される成果物との関連性を示します。

```mermaid
flowchart TD
    classDef user fill:#e1f5fe,stroke:#4fc3f7,color:#01579b,stroke-width:2px;
    classDef social fill:#fff8e1,stroke:#ffe082,color:#ff6f00;
    classDef artifact fill:#f3e5f5,stroke:#ce93d8,color:#4a148c;

    User(("User 中心")):::user
    
    Profile["プロフィール"]:::social
    Following["フォロー (Following)"]:::social
    Followers["フォロワー (Followers)"]:::social
    Projects["参加プロジェクト (Projects)"]:::social
    
    PublicAssets["公開成果物 (Public Assets)"]:::artifact
    
    P_Models["公開 Models (3DSS)"]:::artifact
    P_Layouts["公開 Layouts (3DSL)"]:::artifact
    P_Presents["公開 Presents (3DSP)"]:::artifact

    User --> Profile
    User --> Following
    User --> Followers
    User --> Projects
    User --> PublicAssets
    
    PublicAssets --> P_Models
    PublicAssets --> P_Layouts
    PublicAssets --> P_Presents
    
    Following -.->|"アクティビティ通知"| User
```

**補足説明:**
- ユーザー同士はフォロー関係を持ち、相互のアクティビティ（公開モデルの追加など）をタイムライン等でウォッチできます。
- 個人が作成した各子アプリの資産（Models, Layouts, Presentsなど）のうち、`isPublic = true` なものだけが `Public Assets` として集約・インデックス（例: `publicModelIndex`）化され、他ユーザーの横断検索機能の対象となります。

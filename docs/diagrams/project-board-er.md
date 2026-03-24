# Project / Board / Item ER Diagram

## 概要 (Overview)
この図は、SEKKEIYA エコシステムにおける新しい Firestore スキーマの基本エンティティリレーション (ER) を表しています。
「Project が最も外側の世界であり、Board がその作業空間、Item がその中身への参照である」という原則モデルです。

```mermaid
erDiagram
    %% Entities
    PROJECTS ||--o{ BOARDS : "contains"
    
    PROJECTS {
        string id PK "projects/{projectId}"
        string name "プロジェクト名"
        string description "説明"
        string ownerId "オーナーUID"
        array memberIds "参加メンバーの一覧"
        string visibility "public / private"
        string status "進行状態"
        string coverImageUrl "カバー画像URL"
        timestamp createdAt
        timestamp updatedAt
    }

    BOARDS ||--o{ ITEMS : "contains"
    
    BOARDS {
        string id PK "projects/{projectId}/boards/{boardId}"
        string name "ボード名"
        string boardType "役割区分"
        string appScope "担当アプリケーション"
        number order "表示順序"
        string visibility "Project権限継承/上書き設定"
        timestamp createdAt
        timestamp updatedAt
    }

    ITEMS {
        string id PK "projects/{projectId}/boards/{boardId}/items/{itemId}"
        string itemType "分類 (model / layout / note 等)"
        string entityId "実体のアセットID"
        string entityRef "実体への完全パス"
        map snapshot "表示用の軽量キャッシュ"
        string createdBy "アイテム追加者"
        timestamp createdAt
        timestamp updatedAt
    }
```

## 制約と思想 (Constraints & Philosophy)
1. **Projects コレクション:** 階層の最上位に `projects` が存在します。
2. **Boards サブコレクション:** 当該 Project 専用の Board 群を保持します。
3. **Items サブコレクション:** 実際のデータをリスト化します。
4. **Item は「参照」:** 巨大なデータ本体(Asset)を丸ごとコピーするのではなく、Item は Asset(`entityRef`) に対するポインターとして管理します。

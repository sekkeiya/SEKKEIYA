# Project / Section / Item ER Diagram

## 概要 (Overview)
この図は、SEKKEIYA エコシステムにおける新しい Firestore スキーマ（Project Website Architecture）のエンティティリレーション (ER) を表しています。
「Project が最も外側の世界(Website)であり、Section はその構成要素、Item がその中身への参照である」という原則モデルです。

```mermaid
erDiagram
    %% Entities
    PROJECTS ||--o{ SECTIONS : "contains (website section)"
    PROJECTS ||--o{ ITEMS : "owns (all pointers)"
    
    PROJECTS {
        string id PK "projects/{projectId}"
        string name "プロジェクト名"
        string type "personal / team"
        string description "プロジェクト説明"
        map metadata "★ 要件 (Requirements) などの固定情報"
        string ownerId "オーナーUID"
        array memberIds "参加メンバーの一覧"
        string visibility "public / private"
        string coverImageUrl "カバー画像URL"
        timestamp createdAt
        timestamp updatedAt
    }

    SECTIONS {
        string id PK "projects/{projectId}/sections/{sectionId}"
        string name "セクション名"
        string sectionType "役割区分 (models / layout / presen)"
        string generatorApp "担当ジェネレーター連携"
        number order "表示順序"
        string visibility "権限上書き設定"
        timestamp createdAt
        timestamp updatedAt
    }

    ITEMS {
        string id PK "projects/{projectId}/items/{itemId}"
        string sectionId FK "所属先のセクションID (ビューフィルタ用)"
        string itemType "分類 (model / layout / note 等)"
        string entityId "実体のアセットID"
        string entityRef "実体への完全パス"
        map snapshot "表示用の軽量キャッシュ"
        string createdBy "アイテム追加者"
        timestamp createdAt
        timestamp updatedAt
    }

    ITEMS ||--o{ ASSETS : "references"
    
    ASSETS {
        string id PK "users/{uid}/models/{itemId} 等"
        string storagePath "実ファイルパス"
        map metadata "詳細なアセットメタデータ"
    }
```

## 制約と思想 (Constraints & Philosophy)
1. **Projects コレクション:** 全ての Single Source of Truth。要件情報(Requirements)はSectionではなくここに保存されます。
2. **Sections サブコレクション:** Websiteの各構成要素 (Section)。実体データは持ちません。
3. **Items サブコレクション:** データの実体は全て `projects/{projectId}/items` にフラットに格納されます。`sectionId` フィールドを用いて所属セクションの出し分けを行います。移動時にはこの外部キーを変更するだけで済みます。
4. **Item は「参照」:** 巨大なデータ本体(Asset)を丸ごとコピーするのではなく、ポインターとして管理します。

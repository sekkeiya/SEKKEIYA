# Project / Board / Item ER Diagram

## 概要 (Overview)
この図は、SEKKEIYA エコシステムにおける新しい Firestore スキーマの基本エンティティリレーション (ER) を表しています。
「Project が最も外側の世界であり、Board がその作業空間、Item がその中身への参照である」という原則モデルです。

```mermaid
erDiagram
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

    BOARDS ||--o{ BOARD_ITEMS : "contains"
    BOARDS {
        string id PK "projects/{projectId}/boards/{boardId}"
        string name "ボード名 (Models Board 等)"
        string boardType "役割区分"
        string appScope "担当アプリケーション (3DSS / 3DSL / SEKKEIYA 等)"
        number order "表示順序"
        string visibility "Project権限継承/上書き設定"
        timestamp createdAt
        timestamp updatedAt
    }

    BOARD_ITEMS {
        string id PK "projects/{projectId}/boards/{boardId}/items/{itemId}"
        string itemType "分類 (model / layout / note 等)"
        string entityId "実体のアセットID"
        string entityRef "実体への完全パス"
        map snapshot "表示用の軽量キャッシュ (title, thumbnail 等)"
        string createdBy "アイテム追加者"
        timestamp createdAt
        timestamp updatedAt
    }
```

## 制約と思想 (Constraints & Philosophy)
1. **Projects コレクション:** 階層の最上位に `projects` コレクションが存在します。
2. **Boards サブコレクション:** `projects/{projectId}/boards` にて、当該Project専用のボード群(`Models Board` `Layout Board`等)を保持します。
3. **Items サブコレクション:** `projects/{projectId}/boards/{boardId}/items` にて、実際のデータをリスト化します。
4. **Item は「参照」:** 巨大な3Dモデルやレイアウトデータを丸ごとBoard配下にコピーするのではなく、アイテムの実体(`entityRef`)に対するポインターとして管理します。画面表示用の最小限のデータは `snapshot` マップに持たせます。

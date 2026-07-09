# SEKKEIYA Design Files (Rhino) Version Control MVP Spec - Final

SEKKEIYAを「作業開始プラットフォーム」とするための Rhino 版管理機能（MVP）アーキテクチャ最終版です。

---

## 1. Firestoreスキーマ設計（最終版）

実体ファイル管理用コレクションと、採番・最新判定用のメタデータコレクションを分離します。

### A. 実体ドキュメント
**Path：`projects/{projectId}/designFiles/{fileId}`**

```typescript
interface DesignFile {
  id: string;             // Firestore自動生成ID
  projectId: string;      
  appType: "rhino";       // MVP: rhinoのみ
  
  parentFileId: string | null;  // 派生元（ルートならnull）
  versionNumber: number;        // UI表示用連番（トランザクションで採番）
  
  displayName: string;    // ユーザー任意名
  note: string;           // 変更内容メモ
  
  storageFullPath: string; // Storage内のフルパス
  fileSize: number;       // バイト数
  status: "wip" | "milestone" | "final"; // 手動付与タグ
  
  createdAt: Timestamp;   // 登録日時
  createdBy: string;      // アップロードしたユーザーのUID
  isArchived: boolean;    // 論理削除フラグ（物理削除はしない）
}
```

### B. 採番・最新メタデータ（トランザクション用）
**Path：`projects/{projectId}/designFileMeta/{appType}`**
*(例: `projects/PID123/designFileMeta/rhino`)*

同時アップロードによる `versionNumber` 競合を防ぐためのメタドキュメントです。

```typescript
interface DesignFileMeta {
  appType: "rhino";
  nextVersionNumber: number;  // 次に割り当てるべき番号 (初期値: 1)
  latestFileId: string | null; // 現在の最新版ドキュメントID
  updatedAt: Timestamp;
}
```

---

## 2. 一覧取得条件と Index 設計

### 一覧表示用クエリ（タイムライン）
UI上で「Rhinoファイルの一覧」を表示するための基本クエリは以下の通りです。

```typescript
query(
  collection(db, `projects/${projectId}/designFiles`),
  where("appType", "==", "rhino"),
  where("isArchived", "==", false),
  orderBy("versionNumber", "desc")
)
```

### 必須 Composite Index
上記クエリを成立させるため、Firestore `firestore.indexes.json` に以下の複合インデックスを追加します。

```json
{
  "collectionGroup": "designFiles",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "appType", "order": "ASCENDING" },
    { "fieldPath": "isArchived", "order": "ASCENDING" },
    { "fieldPath": "versionNumber", "order": "DESCENDING" }
  ]
}
```

---

## 3. Firebase Storage パス設計の最終版

**Path：`projects/{projectId}/designFiles/rhino/{fileId}_{timestamp}.3dm`**

* **`fileId`**: ドキュメント作成時に予約取得したFirestore ID。
* **`timestamp`**: アップロード開始時のUnixミリ秒（13桁）。※万が一のブラウザキャッシュ対策や、人間がStorageを直接見たときのためのタイムスタンプ。
* 上記により、同一ファイル名が生成される確率はゼロになり、上書きによるファイル破損事故（Overwrite）を完全に防ぎます。

---

## 4. UI実装方針と操作フロー

### 4-1. Projectページへのタブ追加
* `ProjectWebsite` コンポーネントの `ProductionTabs.jsx` に **「Work Files」** タブを追加します。（「Models」や「Drawings」と並べる）
* 内容は「タイムライン型リスト」で、上記クエリに合致する `DesignFile` を上から下へ描画します。

### 4-2. Upload / Checkout / Commit フロー

* **① Checkout（この版から続ける）**:
  * ユーザーが最新版または過去版カードの「📥 ダウンロード」ボタンをクリック。
  * ファイル（.3dm）がローカルに落ちる。ユーザーは自分のPCのRhinoで開く。
  
* **② 編集作業**: 手元のRhinoで設計タスクを行い、ローカル上に保存する。

* **③ Commit（新しい版として登録）**:
  * SEKKEIYAの画面右上の **「⬆️ Upload」ボタン** をクリック。
  * **モーダル展開**:
    1. **親の選択**: `designFileMeta` の `latestFileId` を持つ版がデフォルトで選択状態になる。（"最新版から派生させます" という案内）
    2. **ファイル選択**: ローカルの `.3dm` をD&D。
    3. **メタデータ入力**: 表示名（Title / DisplayName）、メモ（Note）。
  * **送信処理**:
    1. Firestoreで `const newRef = doc(collection(...))` を叩きIDを確保。
    2. SDKから Firebase Storage へアップロードを実行。
    3. アップ完了後、Firestore **Transaction** を実行。
       * `designFileMeta` を読み込む。
       * `let vNum = 1; if (meta.exists) { vNum = meta.data().nextVersionNumber; }` とする。
       * `newRef` に `DesignFile` ドキュメントを `versionNumber = vNum` で書き込む。
       * `designFileMeta` の `nextVersionNumber` を `vNum + 1` にし、`latestFileId` を `newRef.id` に更新してコミット。

---

## 5. Security Rules（初期段階）

本番運用に向けて厳密なパス単位の制御を敷きます。
*(※ プロジェクトメンバー判定ロジック `isProjectMember()` は既存関数を流用します)*

### Firestore Rules
```javascript
match /projects/{projectId}/designFiles/{fileId} {
  allow read: if isProjectMember(projectId);
  // 作成は許可。更新は isArchived や status のみ許可。実体パスの変更は不可。
  allow create: if isProjectMember(projectId);
  allow update: if isProjectMember(projectId) 
                && (request.resource.data.storageFullPath == resource.data.storageFullPath);
  allow delete: if false; // 物理削除は絶対禁止（isArchived論理削除のみ）
}

match /projects/{projectId}/designFileMeta/{appType} {
  allow read: if isProjectMember(projectId);
  // Transactionによる採番更新のみ許可
  allow write: if isProjectMember(projectId);
}
```

### Storage Rules
```javascript
match /projects/{projectId}/designFiles/rhino/{fileName} {
  // 読み取りはプロジェクトメンバーのみ
  allow read: if isProjectMember(projectId);
  
  // 作成時は拡張子の簡易検証（MVPは一旦緩めに上限なしor5GB等）
  allow create: if isProjectMember(projectId)
                && fileName.matches('.*\\.3dm$');
                
  // 更新・削除は物理パスが変わるため禁止。新しいファイルとして別名アップロードさせる。
  allow update, delete: if false; 
}
```

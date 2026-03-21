---
trigger: always_on
---

# 複数リポジトリ横断 Git 運用ルール（SEKKEIYA main運用版 v3）

---

## ■ 対象リポジトリ

このワークスペースには以下のリポジトリが存在します。

1. sekkeiya（司令塔 / 親アプリ / OS）
2. r3dm-share（3D Shape Share / 3DSS）
3. 3d-shape-layout（3D Shape Layout / 3DSL）
4. 3dshapecreate-web（3D Shape Create / 3DSC）
5. 3dshapepresents-web（3D Shape Presents / 3DSP）
6. 3dshapebooks（3D Shape Books / 3DSB）
7. 3dshapequest（3D Shape Quest / 3DSQ）

---

## ■ 基本方針（最重要）

- Git運用は **原則 main のみを使用する**
- 作業は **各リポジトリ単位で完結させる**
- 作業完了後は **commit → push → deploy まで一気に行う**
- ブランチ切替による事故を防ぐことを最優先とする
- **「どのリポジトリを触っているか」を常に明確にする**

---

## ■ main運用ルール

- すべての通常作業は main で行う
- 修正後は即コミット（放置しない）
- push 前に最低限の動作確認を行う
- push 後は必要に応じて deploy する
- 作業途中でも細かくコミットしてよい
- **1コミット＝意味のある単位にする**

---

## ■ 例外ルール（ブランチ使用）

以下の場合のみ一時的にブランチ作成を許可する：

- 大規模リファクタリング
- Firestore構造変更
- API仕様変更
- 本番影響が大きい変更
- rollbackが必要な変更

※ 作業完了後は必ず main に戻す

---

## ■ コミットルール

### ▼ フォーマット

[app] 内容

### ▼ 例

[sekkeiya] ルーティング統合
[3DSS] モデル詳細UI修正
[3DSL] スナップ処理改善
[3DSC] 生成フロー追加
[3DSP] エディタUI構築
[3DSB] Reader機能追加
[3DSQ] ホーム画面とダッシュボード追加

---

## ■ push / deploy ルール

- 各リポジトリで個別に push する
- push 後は必要に応じて deploy
- 複数リポジトリの変更は「同日でも独立管理」
- **どのリポジトリをdeployしたかを意識する**

---

## ■ ディレクトリ確認ルール（超重要）

Git操作前に必ず確認する：

今どのリポジトリにいるか

例：

- sekkeiya
- r3dm-share
- 3d-shape-layout
- 3dshapecreate-web
- 3dshapepresents-web
- 3dshapebooks
- 3dshapequest

---

## ■ 新規リポジトリルール

- 新規アプリは必ずGitHubに即登録する
- 初回コミット前に `.gitignore` を整備する
- main ブランチに統一する
- ローカルのみで開発を進めない
- `.env.example` はコミットしてよい（環境変数テンプレート）

---

## ■ アーキテクチャルール（重要）

### ▼ SEKKEIYAの役割

- 認証（Auth）
- Firestore
- Storage
- API
- ルーティング統合

---

### ▼ 子アプリの役割

- UI/UXのみ担当
- Firebase初期化は禁止（必ずSEKKEIYA経由で利用する）
- 単独でデータ構造を持たない
- SEKKEIYA経由でデータアクセスする

---

### ▼ URL構造

/app/share
/app/layout
/app/create
/app/presents
/app/books
/app/quest

---

## ■ Vite / Routingルール

各アプリは必ず base を設定する：

- 3DSC → `/app/create/`
- 3DSP → `/app/presents/`
- 3DSB → `/app/books/`
- 3DSQ → `/app/quest/`

BrowserRouter を使用する場合は、対応する `basename` も必ず設定する。

---

## ■ 禁止事項（重要）

- node_modules を Git に含めること
- .env を commit すること
- 未コミットのまま長時間作業すること
- リポジトリを誤って操作すること
- main に一気に大規模変更を入れること
- Firebase構造を無断変更すること
- 子アプリでFirebaseを直接持つこと

---

## ■ トラブル防止ルール

- 必ず `git status` を確認してから操作する
- 不安な場合は commit してから作業する
- 大きな変更前は一度 push する
- エラー時はまず現在のブランチとディレクトリを確認する
- basename を使うアプリでは、Route path や navigate で絶対パスと相対パスが混在していないか確認する
- SEKKEIYA 経由で表示されない場合は、子アプリ単体ではなく **SEKKEIYA 側の proxy 設定** も確認する

---

## ■ 開発フェーズ定義（重要）

現在は以下フェーズ：

👉 **マルチアプリ統合フェーズ**

優先順位：

1. SEKKEIYA統合
2. ルーティング統一
3. Firebase共通化
4. UI統一
5. ホーム導線と App Switcher 整理

---
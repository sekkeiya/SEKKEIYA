# Docker & ハイブリッド開発モード運用ガイド

このドキュメントでは、SEKKEIYAプラットフォームと子アプリを統合動作させるための**「Dockerモード」**と、日々の高速なフロントエンド開発のための**「ハイブリッドモード」**の使い分けについて解説します。

---

## 2つの開発モード

### 1. Docker モード（標準統合環境）
全てのサービス（SEKKEIYA + 全ての子アプリ）をDockerコンテナ上で起動するモードです。
- **用途**: 本番に近い構成での結合テスト、子アプリ間の連携テスト、PR作成前の動作確認。
- **特徴**: 環境依存が少なく確実ですが、WindowsでDocker Desktopの `bind mount` + Vite pollingを使用する場合、ファイル保存からHMR反映までの遅延やCPU負荷が発生することがあります。

### 2. ハイブリッドモード（高速開発環境）
SEKKEIYAのDockerコンテナのみを起動しつつ、開発対象の子アプリはWindowsローカル環境のNode.jsで直接Viteを起動するモードです。
- **用途**: UI構築やロジック修正など、子アプリを単体でガリガリ開発する日々の作業。
- **特徴**: ViteのネイティブなHMRが効くため、ファイル保存時に**即時画面反映**されます。CPU負荷も抑えられます。

---

## 基本原則（★重要）

**すべての動作確認は `localhost:5173/app/...` (SEKKEIYA経由) を使うこと**

子アプリの単体ポート（例: `5174`, `5175`, `5176`）の直打ちは、あくまでViteやCSSの単体デバッグなどの **補助的な確認用途** に限定してください。
認証や横断ナビゲーション、CORS回避を含めた本来の動作は、必ず SEKKEIYA (5173) 側を通した状態で確認する必要があります。

---

## ハイブリッドモードの利用手順

### Step 1. SEKKEIYAでハイブリッド設定を有効にする
SEKKEIYAのルートディレクトリ（`040-sekkeiya/sekkeiya/`）に `.env.local` ファイルを作成（または編集）し、以下の設定を記載します。

```env
VITE_HYBRID_MODE=true
```

> ⚠️ 注意: この変数を変更した後は、設定を読み直させるために必ず SEKKEIYA のコンテナを**再起動**してください。

### Step 2. SEKKEIYA コンテナのみを起動する
ターミナルを開き、SEKKEIYA（親アプリ）だけを指定して Docker を起動します。

```bash
docker compose up sekkeiya -d
```
（※ もし既に `docker compose up -d` で全コンテナが起動している場合は、一度 `docker compose down` してから起動し直すか、`share-app` などの不要なコンテナを `docker stop` してください）

### Step 3. ローカルで子アプリを起動する
別のWindowsターミナル（またはVSCodeのターミナル）を開き、開発したい対象の子アプリのディレクトリに移動してViteを起動します。

例: 3DSS (share-app) を開発する場合
```bash
cd c:\Users\sekkeiya\02-WebApp\028-R3DM-ver2\r3dm-share
npm run dev
```

### Step 4. ブラウザで確認する
ブラウザを開き、SEKKEIYAのURLにアクセスします。
👉 `http://localhost:5173/app/share/dashboard`

SEKKEIYA（Docker内の5173）が、プロキシ経由でWindowsホスト（`host.docker.internal:5174`）へアクセスし、ローカルで起動しているViteの画面を表示します。
ファイルを保存すれば、瞬時に画面が更新されます。

---

## Docker モードに戻す手順（結合テスト時）

1. SEKKEIYAの `.env.local` を以下のように修正（またはコメントアウト）します。
   ```env
   VITE_HYBRID_MODE=false
   ```
2. **すべてのコンテナを再起動**します（設定の再読み込みに必須です）。
   ```bash
   docker compose down
   docker compose up -d
   ```
3. ブラウザで `http://localhost:5173/app/...` を開き、ローカルViteを停止しても画面が表示されることを確認します。

---

## トラブルシューティング

**Q: 画面が真っ暗なまま、または「接続が拒否されました (Connection Refused)」となる**
A: 以下を確認してください。
1. `VITE_HYBRID_MODE=true` を設定後、SEKKEIYAのコンテナを再起動しましたか？
2. Windows側のターミナルで対象の子アプリの `npm run dev` は起動中ですか？
3. 子アプリの `vite.config.js` のポート番号は正しいですか？（3DSS=5174, 3DSL=5175, 3DSC=5176）

**Q: Dockerモードに戻したのにローカルに繋ぎにいってしまう**
A: `VITE_HYBRID_MODE=false` に変更後、コンテナを再起動していない可能性があります。`docker compose restart sekkeiya` を実行してください。

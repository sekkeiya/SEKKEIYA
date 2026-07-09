# SEKKEIYA 開発用 Docker 統合ルール

## 1. 背景と目的
現在、SEKKEIYA エコシステムは「SEKKEIYA (親アプリ)」と「3DSS、3DSL などの 3D Shape 系 (子アプリ)」の複数リポジトリで構成されています。
各アプリをローカル環境で個別に起動すると `localhost:5173`, `5174`, `5175` のような管理地獄になり、CORS 制約やルーティングの複雑化を招いていました。これを解消するため、**すべてのローカル開発環境を Docker Compose で 1 つに統合し、親アプリからの service 名ベース proxy で一元的に動作検証できる状態** を目的として本ルールを策定しました。

## 2. 現在の構成とアーキテクチャ
* **SEKKEIYA (親アプリ)**: ルーティングと設定の中心。ポート `5173` で待受ける。
* **3D Shape Share / 3D Shape Layout (子アプリ)**: UI 実装部。それぞれ独立した `Dockerfile` でコンテナ化される。
* **通信・ルーティング**:
  ユーザーが `localhost:5173/app/share` にアクセスすると、SEKKEIYA の Vite proxy が Docker 内部ネットワークの `http://share-app:5174` にルーティングします。
* **依存・共有状態 (`sekkeiya_node_modules`)**:
  `global-panel` のような共通コンポーネントが要求する `@mui/material` や `firebase` を子アプリ側でシームレスに解決できるよう、SEKKEIYA が構築した `node_modules` を Named Volume として子アプリにマウントする仕組み（`sekkeiya_node_modules`）を採用しています。

## 3. `@sekkeiya/global-panel` の扱い方（重要）
共通UIコンポーネント群である `global-panel` は、子アプリに追加する際に **絶対に守るべき以下のルール** があります。

* **子アプリの `package.json` には書かない**:
  `"dependencies"` に `@sekkeiya/global-panel` を絶対に含めないでください。`npm install` 時にレジストリ（404）例外を引き起こす原因となります。
* **Vite alias で物理ソースのみを参照する**:
  子アプリの `vite.config.js` 内で alias（例: `../../040-sekkeiya/sekkeiya/packages/global-panel/src`）として直接ファイル群を参照し、コードだけを利用します。
* **依存解決は `peerDependencies` で管理**:
  `global-panel` の利用に伴い必要となる外部モジュール（例: `@mui/*`, `react-router-dom` など）は、`global-panel/package.json` 側の `peerDependencies` に明記します。新たに追加・使用する際も、まず `global-panel/package.json` を確認し不足していれば追加してください。

---

## 4. 子アプリ新規追加時（3DSC, 3DSP 等）の作法集

新規に子アプリを Docker Compose 環境に追加する際は、下記テンプレートに従ってください。

### 4.1. 子アプリ直下の `Dockerfile` (基本テンプレート)
ハック的な処理は入れず、最も標準的でクリーンな構成にします。

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json ./

# Install dependencies purely based on valid package.json
RUN npm install

COPY . .

CMD ["npm", "run", "dev"]
```

### 4.2. 子アプリ直下の `.dockerignore` (基本テンプレート)
```dockerignore
node_modules
dist
.env
.git
.firebase
```

### 4.3. 子アプリの `vite.config.js` 必須設定
Docker コンテナとして外部および他コンテナからのアクセスを受け付けるため、必ず以下を追加してください。

```javascript
export default defineConfig({
  plugins: [...],
  server: {
    host: "0.0.0.0", // Docker内からのバインディング許可
    port: [アプリ固有のポート番号],
    strictPort: true,
    watch: {
      usePolling: true, // Windows/Dockerにおけるファイル変更検知の安定化
    },
    fs: {
      strict: false,
      allow: ["..", "/040-sekkeiya"], // マウントされた親アプリのVolumeへのアクセス許可
    },
  },
  resolve: {
    alias: {
      // global-panel等へのエイリアス設定
    }
  }
});
```

### 4.4. `docker-compose.yml` への Service 追加ルール
`sekkeiya/docker-compose.yml` 内に変更を加えます。

```yaml
  [子アプリ名]-app:
    build:
      context: ../../[対象プロジェクトディレクトリ]
      dockerfile: Dockerfile
    volumes:
      - ../../[対象プロジェクトディレクトリ]:/app
      - /app/node_modules # ホストの node_modules 書き換え防止
      # global-panelの実体をマウント
      - ./packages/global-panel:/040-sekkeiya/sekkeiya/packages/global-panel
      # global-panel内の依存(@mui等)を解決するため SEKKEIYAのnode_modulesをマウント
      - sekkeiya_node_modules:/040-sekkeiya/sekkeiya/node_modules
    ports:
      - "[ホストポート]:[コンテナポート]"
```

### 4.5. SEKKEIYA 側の Proxy 追加ルール
親アプリである `sekkeiya/vite.config.js` の `proxy` ブロックに、`localhost:XXX` ではなく **追加した Service 名で** 遷移ルートを定義します。

```javascript
      "/app/[path]": {
        target: "http://[子アプリ名]-app:[コンテナポート]", // <-- localhostは禁止
        changeOrigin: true,
        // ...
      },
```

---

## 5. 現在のアーキテクチャにおける制約と今後の課題
* **本構成は「ローカル開発環境専用」** です。
* 本番（Cloud Run など）で単独コンテナとしてデプロイする段階になった際は、今回のように `global-panel` の解決を親の `sekkeiya_node_modules` Volume に頼ることはできません。
* 単独デプロイ時は、`global-panel` が要求するすべてのピア依存関係をデプロイ対象の `package.json` に個別に明示追記するか、依存解決方式（モノレポ化など）を見直す必要があります。今は開発サイクルの早さと保守性を重視して、この制限を容認しています。

---

## 6. 子アプリ追加完了時のチェックリスト
追加作業完了後は、必ず `docker compose up --build` を実行し、以下の項目を担保してください。

- [ ] `npm install` 操作がいかなるハックも無くネイティブに成功したか
- [ ] 子アプリの `vite.config.js` の alias パスが誤っていないか
- [ ] `docker-compose.yml` のマウント先指定（`/040-sekkeiya` 等）がズレていないか
- [ ] SEKKEIYA の proxy 先が `localhost` ではなく追加した service 名（例: `http://create-app:5176`）になっているか
- [ ] ブラウザから `http://localhost:5173/app/XXX` へアクセスし、対象の子アプリが表示されるか
- [ ] 子アプリ側のソースコードを保存し、ブラウザ上でホットリロード (HMR) が機能しているか

---

## 7. 追加ノウハウ (Phase 3 統合時の教訓)
3DSC・3DSS など複数アプリを統合開発する中で見つかった追加ルール・解決策です（Phase 4 以降の子アプリ追加時もこれを参照）。

### 7.1. React Router v6 の Outlet と `index` ルーティング
親アプリから `/app/create/dashboard` などにプロキシされたのち、子アプリの `App.jsx` 内で `AppLayout` (や `Outlet`) にネストさせる場合、**`path="*"` (ワイルドカード) のみに依存すると、正確なパス (`/dashboard` そのもの) へのアクセス時に画面が白（または背景色のみ）になる問題** が発生します。
**解決策**: 必ず `<Route index element={<DashboardPage />} />` のように `index` ルートを明示的に配置してください。

### 7.2. 認証リダイレクト (Login / Logout のハードコード禁止)
子アプリ内で `window.location.assign('/login')` などの絶対パス遷移をハードコードすると、proxy 環境下において正しい URL (`http://localhost:5173`) やリダイレクトパラメーター (`?return_to=...`) が維持されません。
**解決策**: 遷移には必ず `@sekkeiya/global-panel` が提供する URL ビルダーを利用します。
```javascript
import { toSekkeiyaLoginUrl, toSekkeiyaLogoutUrl, toSekkeiyaSignupUrl } from '@sekkeiya/global-panel';

window.location.assign(toSekkeiyaLoginUrl('/app/[xxx]/dashboard'));
window.location.assign(toSekkeiyaLogoutUrl('/app/[xxx]/'));
```

### 7.3. Vite キャッシュ枯渇と「初回表示の白画面」回避策
Vite が起動時に動的に依存関係をバンドル (optimizeDeps) する機能は、複数コンテナを同時起動する Docker 環境だと CPU 負荷と 504 Timeout による無限リロード（白画面）を引き起こします。
**解決策**:
1. `docker-compose.yml` で各子アプリの `node_modules` を **名前付きボリューム (Named Volume)** にして永続化し `.vite` キャッシュを保存する。
2. 各子アプリの `vite.config.js` の `optimizeDeps.include` に、`react`, `firebase`, `@mui/material`, `@sekkeiya/global-panel` 等の巨大依存を明示列挙し、事前ビルドを強制する。

---

## 8. Phase 4 (3DSP 等) 統合に向けたルール・教訓

3DSC 統合時の「黒画面バグ」と「パフォーマンス課題」から得られた今後の統合（3DSP等）に向けた追加の必須対応事項です。

### 8.1. 黒画面（サイレントクラッシュ）の防止
子アプリで予期せぬエラーや状態不足が発生した場合、React 18 の仕様によりコンポーネントツリー全体がアンマウントされ「完全に真っ暗（または背景色のみ）」になることがあります。
**解決策**:
1. ルート直下（または `AppLayout` を囲む位置）に必ず `ErrorBoundary` を設置し、クラッシュ時にエラー理由を表示できるようにする。
2. データのフェッチ待ち（`resolvingBoard` など）や空状態（`null` リターン）の場合は、必ず `Loading...` や各種 Empty State UI を明示的に表示し、無言の `null` リターンを避ける。

### 8.2. useSharedAuthState 移行時の残存コード削除
SEKKEIYA との認証共有 (`useSharedAuthState`) に移行した後は、子アプリ内での Firebase SDK への直接の依存（`onAuthStateChanged` など）を剥がす必要があります。
**解決策**:
`user === null` のまま early return して画面全体を描画しないような古い Guard が残っていないか点検し、必ず `useSharedAuthState` が提供する `isLoading` や `isAuthed` を用いて Router 側で一元管理（`ProtectedRoute` 等）を行う。

### 8.3. Three.js 等のヘビー系ライブラリの事前ビルド (optimizeDeps)
3DSC や 3DSP のような 3D レンダリングを主軸とするアプリでは、Vite の起動時およびブラウザの初回ロード時に依存関係が大量に解決され、Vite サーバーがフリーズする（Timeout になる）ことがあります。
**解決策**:
`vite.config.js` の `optimizeDeps.include` に、UI 系に加えて `three`, `@react-three/fiber`, `@react-three/drei` などの重いパッケージもすべて先んじて追加する。

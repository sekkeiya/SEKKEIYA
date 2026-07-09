# SEO 自動化スクリプト セットアップ手順

このフォルダの SEO 自動化スクリプトを動かすための初期設定。**初回のみ**実施すればよい。

| スクリプト | 役割 | 実行 | 状態 |
|---|---|---|---|
| `generate-sitemap.mjs` | sitemap.xml 生成（静的+記事） | `npm run sitemap` / build時自動 | ✅ 稼働中 |
| `prerender.mjs` | 全ルートを実HTML化 | build時自動（postbuild） | ✅ 稼働中 |
| `indexnow-ping.mjs` | URL更新を各検索エンジンに即通知 | `npm run indexnow` | ⏳ デプロイ後に有効 |
| `gsc-report.mjs` | 検索需要(惜しいKW)を抽出 | `npm run gsc-report` | ⏳ 下記設定が必要 |

---

## 1. IndexNow（Phase 5b）

**追加設定はほぼ不要。** 鍵ファイル `public/7addb61b75059d9d752035c62f724a79.txt` は同梱済み。

手順:
1. **次回デプロイ**で鍵ファイルを本番に反映する（`https://sekkeiya.com/7addb61b75059d9d752035c62f724a79.txt` が見えるようになる）。
2. デプロイ後に `npm run indexnow` を実行 → `public/sitemap.xml` の全URLを Bing 等へ通知。
3. 定常運用は `deploy-web.bat` の最後に `npm run indexnow` を足すか、Cloud Scheduler で週次実行。

> ⚠️ Google は IndexNow 非対応。Google 向けは sitemap の `lastmod` + GSC が本筋。
> IndexNow が効くのは **Bing / Yandex / Naver / Seznam と ChatGPT Search・Copilot 等のAI検索**。
> AI製品の SEKKEIYA にとってAI検索への露出は戦略的に重要。

---

## 2. Google Search Console レポート（Phase 5a）

### 2-1. GSC にサイトを登録（所有者確認）
1. https://search.google.com/search-console を開く
2. 「プロパティを追加」→ **ドメイン** で `sekkeiya.com` を入力（推奨。サブドメイン/http/https を全部まとめて計測できる）
3. 表示される **DNS TXTレコード** を、ドメインのDNS設定（お名前.com / Cloudflare 等）に追加 → 「確認」
   - ✅ **登録済み**（URLプレフィックス型: `https://sekkeiya.com/`）。所有者確認完了。
4. 数日〜でデータが貯まり始める（登録直後は空）

### 2-2. API用サービスアカウントを作る
1. https://console.cloud.google.com/ で **既存の `shapeshare3d` プロジェクト**を選択（新規でも可）
2. 「APIとサービス」→「ライブラリ」で **Google Search Console API** を検索 → 有効化
3. 「IAMと管理」→「サービスアカウント」→「作成」
   - 名前: `gsc-reporter` 等。ロールは付けなくてよい（GSC側で権限付与するため）
4. 作ったサービスアカウント →「キー」→「鍵を追加」→ **JSON** をダウンロード
5. ダウンロードした JSON を `scripts/gsc-service-account.json` として配置
   （または任意の場所に置き、環境変数 `GSC_SA_KEY_PATH` でパス指定）

### 2-3. サービスアカウントを GSC に招待
1. GSC →「設定」→「ユーザーと権限」→「ユーザーを追加」
2. サービスアカウントのメール（`...@....iam.gserviceaccount.com`、JSON内の `client_email`）を追加
3. 権限は **「制限付き」でOK**（読み取りのみ）

### 2-4. 依存をインストールして実行
```bash
npm i -D google-auth-library   # 初回のみ
npm run gsc-report
```
→ `scripts/reports/gsc-YYYY-MM-DD.md` に「掲載順位8〜20位の惜しいキーワード」が出力される。
これが記事ネタ（後述の topicQueue）の入力になる。

### 環境変数（任意の上書き）
| 変数 | 既定 | 意味 |
|---|---|---|
| `GSC_PROPERTY` | `sc-domain:sekkeiya.com` | プロパティ。URL型なら `https://sekkeiya.com/` |
| `GSC_SA_KEY_PATH` | `scripts/gsc-service-account.json` | サービスアカウント鍵のパス |
| `GSC_DAYS` | `28` | 集計期間（日） |
| `GSC_POS_MIN` / `GSC_POS_MAX` | `8` / `20.5` | striking distance の順位レンジ |
| `GSC_MIN_IMPRESSIONS` | `10` | ノイズ除去の最小表示回数 |

---

## 3. 秘匿情報の扱い（重要）
- `scripts/gsc-service-account.json` は**秘密鍵**。リポジトリにコミット・共有しない。
- `scripts/reports/` の出力はコミットしてもよいが、運用上はローカル/CIアーティファクト推奨。

---

## 4. 定期実行（自動化の常駐先）
これらは「作業PC」ではなく**本番インフラ側で常駐**させるのが本筋:
- **GitHub Actions**（cron）or **Cloud Scheduler + Cloud Functions** で週次:
  - `npm run gsc-report` → 惜しいKWレポートを生成・通知（Slack/メール）
  - デプロイ後に `npm run indexnow`
- sitemap / prerender は既に `npm run build` に連結済みなので追加設定不要。

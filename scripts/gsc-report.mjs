/**
 * gsc-report.mjs — Google Search Console から「惜しいキーワード」を抽出する。
 *
 * 目的（SEO戦略の起点）:
 *   勘でネタを決めず、**実際にSEKKEIYAが検索表示されているクエリ**から逆算する。
 *   特に「表示はされている × 掲載順位が8〜20位 × クリックされていない」= striking distance。
 *   ここを狙って記事/ページを作るのが最も費用対効果が高い。
 *
 * 出力:
 *   - コンソールに上位を表示
 *   - scripts/reports/gsc-YYYY-MM-DD.(json|md) に保存（記事ネタ＝topicQueueの入力に使う）
 *
 * 前提（初回のみ・SEO_AUTOMATION_SETUP.md 参照）:
 *   1. GSC で sekkeiya.com をプロパティ登録（所有者確認）
 *   2. Google Cloud でサービスアカウント作成 → JSON鍵DL → Search Console API有効化
 *   3. そのサービスアカウントのメールを GSC のユーザーに追加（「制限付き」でOK）
 *   4. 鍵を gsc-service-account.json として scripts/ に置く（または GSC_SA_KEY_PATH で指定）
 *
 * 設計方針: 認証情報/ライブラリが無ければ **セットアップ手順を表示して穏当に終了**（prerenderと同じ思想）。
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 設定（環境変数で上書き可）─────────────────────────────
// ドメインプロパティ推奨。URLプレフィックス型なら "https://sekkeiya.com/" を指定。
const PROPERTY = process.env.GSC_PROPERTY || "https://sekkeiya.com/";
const KEY_PATH = process.env.GSC_SA_KEY_PATH || resolve(__dirname, "gsc-service-account.json");
const DAYS = Number(process.env.GSC_DAYS || 28);          // 集計期間（日）
const POS_MIN = Number(process.env.GSC_POS_MIN || 8);     // striking distance 下限順位
const POS_MAX = Number(process.env.GSC_POS_MAX || 20.5);  // 同 上限順位
const MIN_IMPRESSIONS = Number(process.env.GSC_MIN_IMPRESSIONS || 10); // ノイズ除去
const ROW_LIMIT = Number(process.env.GSC_ROW_LIMIT || 1000);

const SETUP_HINT = `
  [gsc-report] セットアップが未完了です。scripts/SEO_AUTOMATION_SETUP.md を参照してください。
  概要:
    1) Google Search Console で sekkeiya.com を登録（所有者確認）
    2) Google Cloud でサービスアカウント作成 → JSON鍵をDL → "Search Console API" を有効化
    3) そのサービスアカウントのメールを GSC の設定 > ユーザーと権限 に追加（制限付き可）
    4) JSON鍵を scripts/gsc-service-account.json に配置（または環境変数 GSC_SA_KEY_PATH で指定）
    5) 依存をインストール:  npm i -D google-auth-library
  ※ 鍵ファイルは秘匿情報。リポジトリにコミットしないこと。
`;

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

async function getAccessToken() {
  if (!existsSync(KEY_PATH)) {
    console.warn(`[gsc-report] サービスアカウント鍵が見つかりません: ${KEY_PATH}`);
    console.warn(SETUP_HINT);
    return null;
  }
  let JWT;
  try {
    ({ JWT } = await import("google-auth-library"));
  } catch {
    console.warn("[gsc-report] google-auth-library 未インストール（npm i -D google-auth-library）。スキップ。");
    console.warn(SETUP_HINT);
    return null;
  }
  try {
    const key = JSON.parse(await readFile(KEY_PATH, "utf8"));
    const client = new JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const { token } = await client.getAccessToken();
    return token || null;
  } catch (e) {
    console.warn(`[gsc-report] 認証失敗: ${e?.message || e}`);
    console.warn(SETUP_HINT);
    return null;
  }
}

async function queryGSC(token) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - DAYS);

  const url =
    "https://searchconsole.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(PROPERTY) +
    "/searchAnalytics/query";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: ymd(start),
      endDate: ymd(end),
      dimensions: ["query"],
      rowLimit: ROW_LIMIT,
      dataState: "all",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.rows || [];
}

function buildMarkdown(rows, meta) {
  const lines = [
    `# GSC 惜しいキーワード レポート（${meta.date}）`,
    "",
    `- プロパティ: \`${PROPERTY}\``,
    `- 期間: 直近 ${DAYS} 日`,
    `- 抽出条件: 掲載順位 ${POS_MIN}〜${POS_MAX} 位 / 表示回数 ≥ ${MIN_IMPRESSIONS}`,
    `- 該当: ${rows.length} 件（全 ${meta.total} クエリ中）`,
    "",
    "順位8〜20位＝「あと一押しで1ページ目」。この語を主題にした記事/見出しを作るのが最優先。",
    "",
    "| # | キーワード | 表示 | クリック | CTR | 平均順位 |",
    "|---|---|---|---|---|---|",
    ...rows.map((r, i) =>
      `| ${i + 1} | ${r.keys[0]} | ${r.impressions} | ${r.clicks} | ${(r.ctr * 100).toFixed(1)}% | ${r.position.toFixed(1)} |`
    ),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const token = await getAccessToken();
  if (!token) return; // セットアップ未完 → 穏当に終了

  let rows;
  try {
    rows = await queryGSC(token);
  } catch (e) {
    console.warn(`[gsc-report] クエリ失敗: ${e?.message || e}`);
    return;
  }

  const total = rows.length;
  const striking = rows
    .filter((r) => r.position >= POS_MIN && r.position <= POS_MAX && r.impressions >= MIN_IMPRESSIONS)
    .sort((a, b) => b.impressions - a.impressions);

  const date = ymd(new Date());
  const outDir = resolve(__dirname, "reports");
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `gsc-${date}.json`), JSON.stringify(striking, null, 2), "utf8");
  await writeFile(join(outDir, `gsc-${date}.md`), buildMarkdown(striking, { date, total }), "utf8");

  console.log(`[gsc-report] 全 ${total} クエリ中、惜しいキーワード ${striking.length} 件を抽出`);
  console.log(`[gsc-report] 上位10件:`);
  striking.slice(0, 10).forEach((r, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${r.keys[0]}  (表示${r.impressions} / 順位${r.position.toFixed(1)})`)
  );
  console.log(`[gsc-report] 保存: scripts/reports/gsc-${date}.md`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.warn(`[gsc-report] 予期せぬエラー（無視）: ${e?.message || e}`); process.exit(0); });

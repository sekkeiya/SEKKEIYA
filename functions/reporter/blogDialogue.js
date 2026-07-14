/**
 * blogDialogue.js — S.Blog「AIと対話して書く」
 *
 * admin(公式記事)の取材フローのユーザー版。Web記事を題材に AI が下書きし、
 * 記事を挟んで AI と議論（選択肢タップ or 自由記述）→ ユーザーの考えを記事に反映する。
 *
 *  mode:"suggest"    … SEO×ユーザーの過去記事から記事テーマを戦略提案
 *  mode:"sources"    … クエリ → Google News RSS からWeb記事を収集し関連順に返す
 *  mode:"draft"      … テーマ(+選んだWeb記事) → ユーザー一人称の下書き(Markdown) + 議論の口火
 *  mode:"turn"       … 記事 + ソース + 対話履歴 + 発言 → AIの応答（+タップ用の選択肢）
 *  mode:"synthesize" … 下書き + 議論ログ → ユーザーの考えを織り込んだ完成記事（出典付き）
 *
 * 文章モデルは config/aiModels（Content Strategy で設定、Gemini/Claude）を共用。
 * この関数は blogArticles に書き込まない（保存はクライアント=S.Blog 側）。
 */
const admin = require("firebase-admin");
const crypto = require("crypto");
const { callLLM, getTextModelConfig } = require("./llm");
const { getDigestLines, buildMemorySection, extractAndSaveUserMemories } = require("./aiMemory");

const cleanJson = (raw) =>
  String(raw).replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

const decodeEntities = (s) =>
  String(s || "")
    // 数値実体参照（&#123; / &#x1F;）を先に処理
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return _; } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(parseInt(d, 10)); } catch { return _; } })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

const fmtHistory = (history = []) =>
  history
    .slice(-16) // 直近のみ（プロンプト肥大防止）
    .map((m) => `${m.role === "user" ? "著者" : "AI"}: ${String(m.text || "").slice(0, 500)}`)
    .join("\n");

const fmtSources = (refs = []) =>
  refs.slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.title}${r.source ? `（${r.source}）` : ""}${r.summary ? ` — ${r.summary}` : ""}`)
    .join("\n");

/** SEOスラッグを英数字ハイフンのASCIIへ整える（日本語/記号を落とす。空なら""）。 */
const seoSlug = (s) => String(s || "")
  .toLowerCase().trim()
  .replace(/[^a-z0-9\s-]+/g, "")
  .replace(/[\s_]+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 60)
  .replace(/-$/, "");

/** LLMが返した画像プランを検証（セクション見出しに紐づく画像・最大8枚）。 */
function sanitizeImagePlan(images) {
  if (!Array.isArray(images)) return [];
  return images
    .map((im) => ({
      heading: String((im && im.heading) || "").trim().slice(0, 120),
      caption: String((im && im.caption) || "").trim().slice(0, 60),
      prompt: String((im && im.prompt) || "").trim().slice(0, 600),
    }))
    .filter((im) => im.prompt)
    .slice(0, 8);
}

/** LLMが返したカバー（サムネ）画像プランを検証。無効なら null。 */
function sanitizeCoverPlan(cover) {
  if (!cover || typeof cover !== "object") return null;
  const caption = String(cover.caption || "").trim().slice(0, 60);
  const prompt = String(cover.prompt || "").trim().slice(0, 600);
  return prompt ? { caption, prompt } : null;
}

/* ---------- Web記事の収集（RSS・キー不要） ----------
 * Google News はボット判定で 503 を返すことがあるため、
 * ブラウザ相当の UA で叩き、失敗時は Bing News RSS にフォールバックする。 */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function parseRssItems(xml, limit) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < limit) {
    const block = m[1];
    const pick = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
      return r ? decodeEntities(r[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()) : "";
    };
    const rawTitle = pick("title");
    const link = pick("link");
    const source = pick("source");
    const pubDate = pick("pubDate");
    const title = rawTitle.replace(/\s+-\s+[^-]+$/, "").trim(); // 末尾の「 - 媒体名」を除去
    if (title && link) items.push({ title, url: link, source, date: pubDate });
  }
  return items;
}

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "ja,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`);
  return await res.text();
}

/** RSS item / Atom entry ブロックからサムネイル画像URLを抽出（無ければ空文字）。 */
function extractFeedItemImage(block) {
  const cands = [
    (/<media:content[^>]*url=["']([^"']+)["']/i.exec(block) || [])[1],
    (/<media:thumbnail[^>]*url=["']([^"']+)["']/i.exec(block) || [])[1],
    (/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i.exec(block) || [])[1],
    (/<enclosure[^>]*type=["']image[^>]*url=["']([^"']+)["']/i.exec(block) || [])[1],
    // content:encoded / description 内の最初の <img>
    (/<img\b[^>]*?(?:data-src|src)=["']([^"']+)["']/i.exec(block) || [])[1],
  ].filter(Boolean);
  for (const c of cands) {
    const u = decodeEntities(c);
    if (!u || u.startsWith("data:")) continue;
    if (/spacer|placeholder|blank|pixel|1x1|\.svg(\?|$)|logo|icon|avatar/i.test(u)) continue;
    if (/^https?:\/\//.test(u)) return u;
  }
  return "";
}

/** 特定サイトのRSS/Atomフィードから最新記事を取得（おすすめソースサイト用）。 */
async function fetchSiteFeed(feedUrl, limit = 12) {
  const xml = await fetchRss(feedUrl);
  // RSS(<item>) と Atom(<entry>) の両対応
  const items = [];
  const blocks = xml.split(/<item[\s>]|<entry[\s>]/).slice(1);
  for (const block of blocks) {
    if (items.length >= limit) break;
    const pick = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
      return r ? decodeEntities(r[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim()) : "";
    };
    const title = pick("title");
    // Atom は <link href="..."/>、RSS は <link>...</link>
    let link = pick("link");
    if (!link) {
      const lr = /<link[^>]*href="([^"]+)"/.exec(block);
      link = lr ? decodeEntities(lr[1]) : "";
    }
    const date = pick("pubDate") || pick("published") || pick("updated");
    if (title && link) items.push({ title, url: link, source: "", date, image: extractFeedItemImage(block) });
  }
  return items;
}

async function fetchNewsItems(query, limit = 8) {
  const errors = [];
  // 1) Google News RSS
  try {
    const xml = await fetchRss(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`);
    const items = parseRssItems(xml, limit);
    if (items.length) return items;
    errors.push("Google News: 0 items");
  } catch (e) { errors.push(`Google News: ${e.message}`); }
  // 2) Bing News RSS（フォールバック）
  try {
    const xml = await fetchRss(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setlang=ja&cc=jp`);
    const items = parseRssItems(xml, limit);
    if (items.length) return items;
    errors.push("Bing News: 0 items");
  } catch (e) { errors.push(`Bing News: ${e.message}`); }
  throw new Error(errors.join(" / "));
}

/** 記事ページのHTMLを取得（ベストエフォート。失敗時は空文字） */
async function fetchHtmlRaw(url, timeoutMs = 8000) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "ja,en;q=0.8" },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/** 記事ページ本文の取得（ベストエフォート。失敗時は空文字） */
async function fetchArticleText(url, maxChars = 1800) {
  const html = await fetchHtmlRaw(url, 6000);
  if (!html) return "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return decodeEntities(text.slice(0, maxChars));
}

/* リーダー本文のテキスト上限。旧7000字では長文ニュースレター（Substack等）の後半が
 * 丸ごと消えたため、全文が収まる水準へ引き上げ（翻訳側もバッチ化して出力切れを防止）。 */
const READER_TEXT_CAP = 36000;
const READER_BLOCK_CAP = 300;

/**
 * 長すぎる段落テキストを文境界（。．！？!?.）優先で max 字以下のチャンク列に分割する。
 * 旧実装は翻訳入力を900字でsliceしており超過分が無言で消えていた（Substackの
 * <br>区切り巨大<p>で顕在化）。分割して全文を翻訳・表示できるようにする。
 */
function splitLongText(text, max = 900) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const out = [];
  let rest = t;
  while (rest.length > max) {
    const win = rest.slice(0, max);
    let cut = Math.max(
      win.lastIndexOf("。"), win.lastIndexOf("．"), win.lastIndexOf("！"), win.lastIndexOf("？"),
      win.lastIndexOf(". "), win.lastIndexOf("! "), win.lastIndexOf("? "),
    );
    if (cut < max * 0.4) cut = win.lastIndexOf(" "); // 文末が見つからなければ単語境界
    if (cut < max * 0.4) cut = max - 1;              // それも無ければ強制分割
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * リーダーモード用の本文抽出。<article>/<main> を優先し、ナビ・フッター等を除去して
 * <p>/<h2>/<h3>/<img> を出現順のブロック列にする（画像は元記事の位置のまま表示できる）。
 */
function extractReadableBlocks(html, baseUrl) {
  let h = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  const article =
    (/<article[^>]*>([\s\S]*?)<\/article>/i.exec(h) || [])[1] ||
    (/<main[^>]*>([\s\S]*?)<\/main>/i.exec(h) || [])[1] || h;

  const blocks = [];
  let charCount = 0;
  let imgCount = 0;
  const seenImg = new Set();

  // imgタグ1つを解決して blocks へ（遅延読み込み data-*/srcset 対応・spacer等除外・重複除外）
  const pushImg = (tag) => {
    if (imgCount >= 12) return; // なるべく記事内の画像は全て出す（上限のみ）
    const candidates = [
      (/(?:data-src|data-lazy-src|data-original|data-lazy)=["']([^"']+)["']/i.exec(tag) || [])[1],
      ((/(?:data-srcset|srcset)=["']([^"']+)["']/i.exec(tag) || [])[1] || "").split(/[\s,]/)[0],
      (/src=["']([^"']+)["']/i.exec(tag) || [])[1],
    ].filter(Boolean);
    let src = "";
    for (const c of candidates) {
      const u = decodeEntities(c);
      if (!u || u.startsWith("data:")) continue;
      if (/spacer|placeholder|blank|pixel|1x1|loading\.(gif|svg)/i.test(u)) continue;
      if (/\.svg(\?|$)/i.test(u) || /logo|icon|avatar|sprite|badge|button/i.test(u)) continue;
      src = u;
      break;
    }
    if (!src) return;
    try { src = new URL(src, baseUrl).href; } catch { return; }
    if (seenImg.has(src)) return;
    seenImg.add(src);
    blocks.push({ t: "img", src });
    imgCount++;
  };

  // 埋め込み動画（YouTube/Vimeo のみ許可 = 広告iframeは除外）
  const pushVideo = (tag) => {
    const src = decodeEntities((/src=["']([^"']+)["']/i.exec(tag) || [])[1] || "");
    if (!src) return;
    let embed = "";
    const yt = /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{6,})/i.exec(src);
    if (yt) embed = `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    else if (/player\.vimeo\.com\/video\/\d+/i.test(src)) embed = src.startsWith("http") ? src : `https:${src}`;
    if (!embed || seenImg.has(embed)) return;
    seenImg.add(embed);
    blocks.push({ t: "video", src: embed });
  };

  const re = /<iframe\b[^>]*>|<img\b[^>]*>|<(p|h2|h3|figure)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let m;
  while ((m = re.exec(article)) && blocks.length < READER_BLOCK_CAP) {
    const tag = m[0];
    if (/^<iframe/i.test(tag)) {
      pushVideo(tag);
    } else if (/^<img/i.test(tag)) {
      pushImg(tag);
    } else {
      // 段落/figure 内にネストした画像・動画も拾う（WordPress は <p><img></p> が典型）
      for (const it of tag.match(/<iframe\b[^>]*>/gi) || []) pushVideo(it);
      for (const it of tag.match(/<img\b[^>]*>/gi) || []) pushImg(it);
      const isHead = /^<h/i.test(tag);
      // Substack 等は1つの<p>に<br>区切りで記事全文を詰めるため、まず<br>で行に分割
      const segs = isHead ? [tag] : tag.split(/<br\s*\/?>/i);
      for (const seg of segs) {
        const text = decodeEntities(String(seg).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        const minLen = segs.length > 1 ? 25 : 40; // <br>行は短めでも本文（ナビ断片ではない）
        if (!text || (!isHead && text.length < minLen)) continue; // ナビ断片・キャプション未満は除外
        // 巨大段落は文境界で分割して全文を保持（翻訳入力の切り詰め対策）
        for (const chunk of splitLongText(text)) {
          if (charCount > READER_TEXT_CAP || blocks.length >= READER_BLOCK_CAP) break; // テキスト上限。後続の画像は引き続き収集する
          charCount += chunk.length;
          blocks.push({ t: isHead ? "h" : "p", text: chunk });
        }
      }
    }
  }
  // 本文中に画像が無ければ OGP 画像をヒーローとして先頭へ
  if (!blocks.some((b) => b.t === "img")) {
    const og = (/property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html) ||
                /content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html) || [])[1];
    if (og) blocks.unshift({ t: "img", src: decodeEntities(og) });
  }
  return blocks;
}

/* ---------- リーダー結果の共有キャッシュ（Firestore readerCache/{sha1(url)}） ----------
 * 抽出+翻訳済みブロックを全ユーザーで共有する。翻訳は記事1本につき1回だけ。
 * クライアントの localStorage キャッシュ（L1）の上に載る L2。7日で鮮度切れ。 */
const READER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 抽出・翻訳パイプライン変更時に上げる（v2: 巨大段落の分割＋全文翻訳。旧キャッシュは切り詰め済みのため破棄）
const READER_CACHE_VERSION = 2;
const readerCacheRef = (db, url) =>
  db.collection("readerCache").doc(crypto.createHash("sha1").update(url).digest("hex"));

async function readerCacheGet(db, url) {
  try {
    const snap = await readerCacheRef(db, url).get();
    if (!snap.exists) return null;
    const d = snap.data();
    if (!Array.isArray(d.blocks) || !d.blocks.length || Date.now() - (d.at || 0) > READER_CACHE_TTL_MS) return null;
    if ((d.v || 1) !== READER_CACHE_VERSION) return null;
    return { blocks: d.blocks, translated: !!d.translated };
  } catch { return null; }
}

async function readerCacheSet(db, url, blocks, translated) {
  try {
    await readerCacheRef(db, url).set({ url, blocks, translated, at: Date.now(), v: READER_CACHE_VERSION });
  } catch (e) {
    console.warn(`[readerCache] set failed: ${e.message}`);
  }
}

/**
 * ブロック列のテキストが英語なら日本語へ翻訳して返す（read / prewarm / clientBlocks 共通）。
 * 日本語記事・翻訳失敗時は原文のまま（translated: false）。
 */
async function translateBlocksJaIfNeeded(blocks) {
  const joined = blocks.filter((b) => b.t === "p" || b.t === "h").map((b) => b.text).join("\n");
  const jaChars = (joined.match(/[ぁ-んァ-ヶ一-龯]/g) || []).length;
  const isJa = jaChars > joined.length * 0.05;
  let translated = false;
  if (!isJa && joined.trim()) {
    try {
      const srcTexts = blocks.filter((b) => b.t === "p" || b.t === "h").map((b) => b.text);
      // 出力トークン上限（8192）でJSONが途中で切れないよう、約6000字ごとのバッチに分けて並列翻訳。
      // 旧実装の「全段落を1回で・入力900字slice」は長文記事の後半を無言で消していた。
      const batches = [];
      let cur = [];
      let curChars = 0;
      for (const t of srcTexts) {
        if (cur.length && curChars + t.length > 6000) { batches.push(cur); cur = []; curChars = 0; }
        cur.push(t);
        curChars += t.length;
      }
      if (cur.length) batches.push(cur);
      const translateBatch = async (texts) => {
        const prompt = `
以下は建築・デザイン系Web記事の段落です。各要素を自然で読みやすい日本語に翻訳してください。
- 入力と**同じ数・同じ順序**の配列で返す（結合・分割しない）
- 固有名詞（人名/事務所名/プロジェクト名）は原語のまま or 一般的なカタカナ表記
- 意訳しすぎず、事実関係を正確に

【入力(JSON)】
${JSON.stringify({ texts: texts.map((t) => t.slice(0, 4000)) })}

【出力（JSONのみ）】
{"texts":["翻訳1","翻訳2",...]}
`.trim();
        // 翻訳は速度優先で常に Gemini Flash（Claude設定でも読み込みを待たせない。品質は翻訳用途に十分）
        const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 8192 })));
        if (!Array.isArray(out.texts) || out.texts.length !== texts.length) {
          throw new Error(`batch count mismatch (${texts.length} -> ${Array.isArray(out.texts) ? out.texts.length : "?"})`);
        }
        return out.texts.map((t, i) => String(t || texts[i]));
      };
      const flat = (await Promise.all(batches.map(translateBatch))).flat();
      let i = 0;
      blocks = blocks.map((b) => (b.t === "p" || b.t === "h" ? { ...b, text: flat[i++] || b.text } : b));
      translated = true;
    } catch (e) {
      console.warn(`[translateBlocksJaIfNeeded] translate failed (原文のまま表示): ${e.message}`);
    }
  }
  return { blocks, translated, joined };
}

/**
 * クライアント抽出ブロック（clientBlocks）の検証・整形。
 * デスクトップの隠しWebView（本人のログインCookie）が抽出した本文で、
 * ArchDaily 等のログイン限定本文もここに乗ってくる（docs/blog_read_client_blocks_draft.md 参照）。
 * 信頼しない入力として上限と形を強制する。テキストが無ければ null（通常パスへ）。
 */
function sanitizeClientBlocks(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = [];
  let textChars = 0;
  for (const b of raw) {
    if (out.length >= 400) break;
    const t = b && b.t;
    if (t === "p" || t === "h") {
      // 旧: 2000字slice（超過分が消える）→ 文境界で分割して全文を保持
      const text = String(b.text || "").replace(/\s+/g, " ").trim();
      if (!text || textChars >= READER_TEXT_CAP) continue;
      for (const chunk of splitLongText(text)) {
        if (out.length >= 400 || textChars >= READER_TEXT_CAP) break;
        textChars += chunk.length;
        out.push({ t, text: chunk });
      }
    } else if (t === "img") {
      const src = String(b.src || "");
      if (!/^https:\/\/[^\s"'<>]+$/.test(src) || src.length > 2000) continue;
      out.push({ t: "img", src });
    } else if (t === "video") {
      const src = String(b.src || "");
      // 埋め込みは YouTube/Vimeo のみ許可（サーバー抽出と同じ基準）
      if (!/^https:\/\/(www\.)?(youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/.test(src)) continue;
      out.push({ t: "video", src });
    }
  }
  return out.some((b) => b.t === "p" || b.t === "h") ? out : null;
}

/**
 * リーダー用の記事ブロックを構築する（read / prewarm 共通のパイプライン）。
 * ページ版とRSS版（content:encoded）を両方抽出して濃い方を採用し、
 * 英語記事は Gemini Flash で日本語に翻訳する。失敗時は null。
 */
async function buildReaderBlocks(url, fallbackFeed) {
  // - dezeen: ページ403 → RSSのみ
  // - designboom: ページは本文画像がJS描画で取れない → RSS採用
  // - architecturephoto: ページで十分 → ページ採用
  const html = await fetchHtmlRaw(url);
  const pageBlocks = html ? extractReadableBlocks(html, url) : [];
  let rssBlocks = [];
  if (fallbackFeed) {
    try {
      const rss = await fetchRss(fallbackFeed);
      const item = rss.split(/<item[\s>]/).find((it) => it.includes(url.replace(/\/$/, "")));
      const enc = item ? (/<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(item) || [])[1] : "";
      const inner = enc ? enc.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "") : "";
      if (inner) rssBlocks = extractReadableBlocks(inner, url);
    } catch (e) {
      console.warn(`[buildReaderBlocks] rss extract failed: ${e.message}`);
    }
  }
  const score = (bs) =>
    bs.filter((b) => b.t === "p" || b.t === "h").reduce((a, b) => a + b.text.length, 0) +
    bs.filter((b) => b.t === "img").length * 800; // 画像は把握に効くので重み付け
  let blocks = score(rssBlocks) > score(pageBlocks) ? rssBlocks : pageBlocks;

  if (!blocks.filter((b) => b.t === "p" || b.t === "h").length) {
    // 最後のフォールバック: プレーンテキスト抽出
    const text = await fetchArticleText(url, 7000);
    if (!text) return null;
    blocks = text.split(/(?<=[。！？.!?])\s+/).filter((s) => s.trim().length > 30).map((s) => ({ t: "p", text: s }));
  }

  // 日本語判定＋翻訳は共通関数へ（clientBlocks パスと同じ処理）
  return await translateBlocksJaIfNeeded(blocks);
}

// blogMediaMeta のドキュメントID（feed URL の安定ハッシュ）。
// メディアの内容分析（keywords/tone/summary）は全ユーザー共有キャッシュにして、分析は媒体ごと1回だけ。
function blogMediaDocId(feed) {
  let h = 5381;
  const str = String(feed || "");
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return "m" + h.toString(36);
}

exports.blogDialogue = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const textCfg = await getTextModelConfig(db);
  const mode = data.mode;

  // 🧠 ユーザーメモリー（長期記憶・docs/21 Phase A）: 対話系モードのプロンプトに
  // 「人物像ダイジェスト」を注入し、応答をユーザーに最適化する。空なら注入なし。
  const memUid = context.auth?.uid;
  const memorySection = memUid && ["suggest", "draft", "turn", "synthesize"].includes(mode)
    ? buildMemorySection(await getDigestLines(db, "user", memUid), null)
    : "";

  /* ---------- テーマ提案（SEO×ユーザー文脈） ---------- */
  if (mode === "suggest") {
    const uid = context.auth?.uid;
    if (!uid) return { success: false, reason: "unauthenticated" };
    const count = Math.max(3, Math.min(8, Number(data.count) || 5));
    const categories = Array.isArray(data.categories) && data.categories.length
      ? data.categories : ["お知らせ", "設計", "インテリア", "施工事例", "コラム", "その他"];
    const authorName = String(data.authorName || "").trim();

    // ユーザーの過去記事（タイトル/カテゴリ/タグ）を読み、重複回避＆文脈に合わせる
    let past = [];
    try {
      const snap = await db.collection("users").doc(uid).collection("blogArticles")
        .orderBy("updatedAt", "desc").limit(30).get();
      past = snap.docs.map((d) => {
        const a = d.data();
        return { title: a.title || "", category: a.category || "", tags: Array.isArray(a.tags) ? a.tags : [] };
      }).filter((a) => a.title);
    } catch (e) {
      console.warn(`[blogDialogue:suggest] past articles read failed: ${e.message}`);
    }
    const pastLines = past.slice(0, 25)
      .map((a) => `- ${a.title}（${a.category}${a.tags.length ? ` / ${a.tags.slice(0, 3).join(",")}` : ""}）`)
      .join("\n") || "（まだ記事なし）";

    const prompt = `
あなたは建築・インテリア分野の個人ブログのSEO戦略アドバイザーです。
著者${authorName ? `（${authorName}さん）` : ""}のブログに合う記事テーマを${count}件提案してください。

【著者のこれまでの記事（文脈・重複回避に使う）】
${pastLines}

【使えるカテゴリ】
${categories.join(" / ")}

【提案の条件】
- 実際に検索されそうな具体的キーワードを含むテーマ（ロングテール歓迎）。既存記事と重複させない
- 既存記事の傾向から**著者の得意領域を読み取り**、その延長でトピッククラスターを育てる提案を優先（まだ記事が無ければ、住宅設計・インテリアの定番検索テーマから）
- 設計実務者・施主が知りたい実用テーマ。著者の一人称の経験談として書けるもの
- why には「検索意図・なぜこの著者が書くと強いか」を1行で
${memorySection}
【出力（JSONのみ）】
{"topics":[{"theme":"記事テーマ（検索キーワードを含む・25字前後）","category":"カテゴリ","keyword":"狙う検索キーワード","why":"検索意図・狙い"}]}
`.trim();

    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 2048 })));
      const topics = (Array.isArray(out.topics) ? out.topics : []).slice(0, count).map((t) => ({
        theme: String(t.theme || "").trim(),
        category: categories.includes(t.category) ? t.category : categories[0],
        keyword: String(t.keyword || "").trim(),
        why: String(t.why || "").trim(),
      })).filter((t) => t.theme);
      if (!topics.length) return { success: false, reason: "no topics generated" };
      return { success: true, topics };
    } catch (e) {
      return { success: false, reason: `suggest failed: ${e.message}` };
    }
  }

  /* ---------- 記事本文の抽出（リーダーモード用） ----------
   * エディタのメインエリアで「読みながら議論」するための本文。
   * <article>優先でナビ等を除去し、段落・見出し・画像を出現順のブロックで返す。
   * 英語記事は**既定で日本語に翻訳**して返す（原文が必要なら元記事リンクへ）。
   * 全文転載を避けるため上限あり。表示側は出典リンクと著作権注記を必ず出す。 */
  if (mode === "read") {
    const url = String(data.url || "").trim();
    const fallbackFeed = String(data.fallbackFeed || "").trim(); // 媒体のRSS（content:encoded フォールバック用）
    if (!/^https?:\/\//.test(url)) return { success: false, reason: "url is required" };

    // ★clientBlocks: クライアント（デスクトップの隠しWebView=本人のログインCookie）が
    // 抽出済みの本文。サーバー取得をスキップして翻訳のみ行う（ログイン限定本文が読める）。
    // キャッシュは「URL+内容ハッシュ」キーで通常版と分離する:
    // 未ログイン版と混ざらず、同じ内容を既に持っている人しかヒットしない（漏えいなし）。
    const clientBlocks = sanitizeClientBlocks(data.clientBlocks);
    if (clientBlocks) {
      const key = `${url}|client|${crypto.createHash("sha1").update(JSON.stringify(clientBlocks)).digest("hex")}`;
      const cachedClient = await readerCacheGet(db, key);
      if (cachedClient) {
        return { success: true, blocks: cachedClient.blocks, translated: cachedClient.translated, usedClientBlocks: true, serverCached: true };
      }
      const built = await translateBlocksJaIfNeeded(clientBlocks);
      await readerCacheSet(db, key, built.blocks, built.translated);
      return {
        success: true,
        blocks: built.blocks,
        translated: built.translated,
        usedClientBlocks: true,
        text: built.joined.slice(0, 7000), // 旧クライアント互換
      };
    }

    // 全ユーザー共有のサーバーキャッシュ（prewarm や他ユーザーの read で温まる）→ 即返し
    const cached = await readerCacheGet(db, url);
    if (cached) {
      const joined = cached.blocks.filter((b) => b.t === "p" || b.t === "h").map((b) => b.text).join("\n");
      return { success: true, blocks: cached.blocks, translated: cached.translated, text: joined.slice(0, 7000), serverCached: true };
    }

    const built = await buildReaderBlocks(url, fallbackFeed);
    if (!built) return { success: false, reason: "本文を取得できませんでした（元記事を開いてお読みください）" };
    await readerCacheSet(db, url, built.blocks, built.translated);
    return {
      success: true,
      blocks: built.blocks,
      translated: built.translated,
      text: built.joined.slice(0, 7000), // 旧クライアント互換
    };
  }

  /* ---------- 事前ウォーム（一覧表示時に上位記事を先回りで抽出+翻訳） ----------
   * クライアントがフィード表示直後に fire-and-forget で呼ぶ。結果は全ユーザー共有の
   * readerCache に載るため、記事を開いた瞬間に翻訳済みで表示される。
   * 翻訳は英語記事のみ（約2円/記事）・記事1本につき全ユーザーで1回だけ。 */
  if (mode === "prewarm") {
    if (!context.auth?.uid) return { success: false, reason: "unauthenticated" };
    const items = (Array.isArray(data.urls) ? data.urls : [])
      .slice(0, 12)
      .map((x) => ({ url: String(x?.url || ""), feed: String(x?.feed || "") }))
      .filter((x) => /^https?:\/\//.test(x.url));
    let warmed = 0;
    let skipped = 0;
    for (let i = 0; i < items.length; i += 3) {
      await Promise.all(items.slice(i, i + 3).map(async (it) => {
        try {
          if (await readerCacheGet(db, it.url)) { skipped++; return; }
          const built = await buildReaderBlocks(it.url, it.feed);
          if (built) { await readerCacheSet(db, it.url, built.blocks, built.translated); warmed++; }
        } catch (e) {
          console.warn(`[blogDialogue:prewarm] ${it.url}: ${e.message}`);
        }
      }));
    }
    console.log(`[blogDialogue:prewarm] warmed=${warmed} skipped=${skipped}/${items.length}`);
    return { success: true, warmed, skipped };
  }

  /* ---------- 言葉の意味を調べる（リーダーの辞書機能） ----------
   * 記事内で選択した言葉を、記事の文脈に即して短く解説する。速度優先で Gemini Flash 固定。 */
  if (mode === "define") {
    const term = String(data.term || "").trim().slice(0, 60);
    const context2 = String(data.context || "").slice(0, 400);
    if (!term) return { success: false, reason: "term is required" };
    // AI辞書もAPI利用が発生するため有料プラン限定（AI音声と同じ基準）
    const { isPaidUser } = require("./ttsSynthesize");
    const uid = context.auth?.uid;
    if (!uid || !(await isPaidUser(db, uid))) {
      return { success: false, code: "PLAN_REQUIRED", reason: "AI辞書は有料プランでご利用いただけます" };
    }
    const prompt = `
あなたは建築・デザイン分野に詳しい辞書編集者です。次の言葉の意味を日本語で簡潔に説明してください。

【言葉】${term}
${context2 ? `【出てきた文脈】${context2}` : ""}

【条件】
- 2〜3文・150字以内。建築/デザイン/アート記事の文脈に即した意味を優先
- 読みが難しい日本語なら「よみ」を付ける（不要なら空文字）
- 人名・作品名・企業名なら「誰/何か」を一言で
- 分からない場合は推測せず「一般的な情報が見つかりません」と書く

【出力（JSONのみ）】
{"reading":"よみ（不要なら空）","definition":"説明"}
`.trim();
    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 512 })));
      return {
        success: true,
        term,
        reading: String(out.reading || "").trim(),
        definition: String(out.definition || "").trim(),
      };
    } catch (e) {
      return { success: false, reason: `define failed: ${e.message}` };
    }
  }

  /* ---------- SEO 自動最適化 ----------
   * 記事本文からSEO要素（スラッグ/メタディスクリプション/タグ/フォーカスキーワード/
   * SEOタイトル案）をまとめて提案する。クライアントは提案を確認して個別/一括で適用する。 */
  if (mode === "seo") {
    const title = String(data.title || "").trim();
    const body = String(data.bodyMarkdown || "").slice(0, 6000);
    const excerpt = String(data.excerpt || "").trim();
    const category = String(data.category || "").trim();
    if (!title && !body) return { success: false, reason: "タイトルか本文が必要です" };

    const prompt = `
あなたは日本語ブログのSEO編集者です。以下の記事に対し、検索流入を最大化するSEO要素を提案してください。
建築・インテリア・デザイン領域の読者が検索しそうな語を重視します。

【記事タイトル】${title}
${category ? `【カテゴリ】${category}` : ""}
${excerpt ? `【現在の抜粋】${excerpt}` : ""}
【本文(Markdown・抜粋)】
${body || "（本文なし）"}

【提案の条件】
- slug: **英小文字・数字・ハイフンのみ**（日本語やローマ字混じり不可、必ずASCII）。記事の主題を表す3〜6語、60字以内。例: rosso-listening-bar-red-design
- metaTitle: 検索結果に出すタイトル案。**32字前後**、主要キーワードを前方に。元タイトルの主旨は保つ（大きく変えない）
- metaDescription: メタディスクリプション。**110〜120字**、主要キーワードを自然に含め、続きを読みたくなる要約。誇張しない
- tags: 検索されうるキーワード**5個**（日本語中心、必要なら英語や固有名詞も）。記事に実際に書かれている内容の語だけ
- focusKeyword: この記事で最も狙うべき主要キーワード（1つ、2〜8字程度）
- notes: SEO上の改善アドバイスを1〜2文（不足している観点があれば指摘）

【出力（JSONのみ）】
{"slug":"ascii-hyphenated","metaTitle":"タイトル案","metaDescription":"110〜120字の説明","tags":["語1","語2","語3","語4","語5"],"focusKeyword":"主要キーワード","notes":"アドバイス"}
`.trim();

    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 1024 })));
      const slug = seoSlug(out.slug);
      return {
        success: true,
        slug: slug || seoSlug(out.focusKeyword) || "",
        metaTitle: String(out.metaTitle || "").trim().slice(0, 80),
        metaDescription: String(out.metaDescription || "").trim().slice(0, 160),
        tags: Array.isArray(out.tags) ? out.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6) : [],
        focusKeyword: String(out.focusKeyword || "").trim().slice(0, 40),
        notes: String(out.notes || "").trim().slice(0, 300),
      };
    } catch (e) {
      return { success: false, reason: `seo failed: ${e.message}` };
    }
  }

  /* ---------- 記事内画像のAIナレーション（読み上げ用） ----------
   * 画像・グラフを視覚解析し、読み上げの合間に挿入する短い説明+感想を返す。
   * AI音声と同じく有料プラン限定。結果はクライアントがキャッシュし、音声もStorageにキャッシュされる。 */
  if (mode === "describeImages") {
    const { isPaidUser } = require("./ttsSynthesize");
    const uid = context.auth?.uid;
    if (!uid || !(await isPaidUser(db, uid))) {
      return { success: false, code: "PLAN_REQUIRED", reason: "画像のAIナレーションは有料プランでご利用いただけます" };
    }
    const title = String(data.title || "").slice(0, 120);
    const rawImages = (Array.isArray(data.images) ? data.images : []).slice(0, 6);
    const rawContexts = Array.isArray(data.contexts) ? data.contexts : [];
    const images = [];
    rawImages.forEach((u, i) => {
      const url = String(u || "");
      if (!/^https?:\/\//.test(url)) return;
      // context = 画像の前後の本文（クライアントが添える）。画像の「記事内での意図」を読み取る材料
      images.push({ url, context: String(rawContexts[i] || "").slice(0, 500) });
    });
    if (!images.length) return { success: true, descriptions: [] };

    // 文の途中で切らず、文末（。！？）で丸める。上限内に文末が無い短文はそのまま
    const trimToSentence = (s, max = 200) => {
      const t = String(s || "").trim();
      if (t.length <= max) return t;
      const cut = t.slice(0, max);
      const p = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("！"), cut.lastIndexOf("？"));
      return p > 20 ? cut.slice(0, p + 1) : cut;
    };

    const apiKey = process.env.GEMINI_API_KEY;
    const describeOne = async ({ url, context }) => {
      try {
        // 画像を取得して inline で渡す（4MB上限・画像以外はスキップ）
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": BROWSER_UA }, redirect: "follow" });
        clearTimeout(timer);
        if (!res.ok) return "";
        const mime = (res.headers.get("content-type") || "").split(";")[0];
        if (!/^image\/(jpeg|png|webp|gif)/.test(mime)) return "";
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 4 * 1024 * 1024) return "";

        const r2 = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { inlineData: { mimeType: mime, data: buf.toString("base64") } },
                  { text: `これは建築・デザイン記事「${title}」内の画像です。記事の読み上げ音声の合間に挿入するナレーション原稿を書いてください。
${context ? `【この画像の前後の本文】\n${context}\n` : ""}
- まず前後の本文から「この画像が記事の中で何を示すために置かれているか（意図）」を読み取り、その意図に沿って画像を簡潔に説明する
- 本文が触れている要素（素材・色・空間構成など）が画像に写っていれば、それを優先して言及する
- 2文・80字以内・ですます調。「この画像は」等の前置きは不要、本文のみ。必ず文末（。）で言い切る
- グラフや図表なら読み取れる要点を優先` },
                ],
              }],
              // 思考トークンが出力枠を食い潰して本文が途中で切れるのを防ぐ（説明タスクに思考は不要）
              generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } },
            }),
          },
        );
        if (!r2.ok) return "";
        const j = await r2.json();
        // 文の途中で切らない（従来の slice(0,200) が「説明が途中で途切れる」原因だった）
        return trimToSentence(String(j?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""));
      } catch {
        return "";
      }
    };

    // 3並列で解析（失敗した画像は空文字=読み上げスキップ）
    const descriptions = new Array(images.length).fill("");
    for (let i = 0; i < images.length; i += 3) {
      await Promise.all(images.slice(i, i + 3).map(async (im, j) => { descriptions[i + j] = await describeOne(im); }));
    }
    return { success: true, descriptions };
  }

  /* ---------- ニュースフィード（ホーム用・LLM不使用） ----------
   * 複数のおすすめサイトのRSSを並列取得してそのまま返す。
   * 本文は転載しない（タイトル/リンク/日付のみ＝S.Libraryのブックマーク表示と同じ扱い）。 */
  if (mode === "feed") {
    const sites = (Array.isArray(data.sites) ? data.sites : []).slice(0, 12)
      .map((s) => ({ name: String(s.name || "").slice(0, 40), feed: String(s.feed || "") }))
      .filter((s) => /^https:\/\//.test(s.feed));
    if (!sites.length) return { success: false, reason: "sites is required" };
    const perSite = Math.max(3, Math.min(12, Number(data.perSite) || 8));
    const results = await Promise.all(sites.map(async (s) => {
      try {
        const items = await fetchSiteFeed(s.feed, perSite);
        return { site: s.name, ok: true, items: items.map((it) => ({ ...it, source: s.name })) };
      } catch (e) {
        console.warn(`[blogDialogue:feed] ${s.name} failed: ${e.message}`);
        return { site: s.name, ok: false, items: [] };
      }
    }));
    const okCount = results.filter((r) => r.ok).length;
    if (!okCount) return { success: false, reason: "フィードを取得できませんでした（時間をおいて再試行してください）" };
    return { success: true, feeds: results };
  }

  /* ---------- Web記事の収集（題材候補） ----------
   * ① siteFeed 指定 … おすすめサイトの最新記事を直接取得（キーワード不要）
   * ② query のみ    … Google/Bing News をキーワード検索 */
  if (mode === "sources") {
    const query = String(data.query || "").trim();
    const siteFeed = String(data.siteFeed || "").trim();
    const siteName = String(data.siteName || "").trim();
    if (!query && !siteFeed) return { success: false, reason: "query or siteFeed is required" };

    let items = [];
    try {
      items = siteFeed ? await fetchSiteFeed(siteFeed, 12) : await fetchNewsItems(query, 10);
    } catch (e) {
      return { success: false, reason: `Web記事の取得に失敗しました: ${e.message}` };
    }
    if (siteName) items = items.map((it) => ({ ...it, source: it.source || siteName }));
    if (!items.length) {
      return { success: false, reason: siteFeed
        ? `${siteName || "このサイト"}の記事を取得できませんでした`
        : "該当する記事が見つかりませんでした（キーワードを変えてみてください）" };
    }

    // LLMで関連順に絞り込み＆1行要約（失敗時は先頭5件をそのまま）
    // siteFeed かつ query 無しなら「建築・インテリアの題材として良い記事」を選ぶ
    const rankTopic = query || "建築・インテリア設計者のブログの題材として価値が高い記事";
    try {
      const prompt = `
建築・インテリア設計者の個人ブログの題材として「${rankTopic}」の観点でWeb記事を選びます。
以下の記事一覧から、題材として適切なものを関連度順に最大5件選び、それぞれ1行の紹介文を付けてください。

${items.map((it, i) => `${i}: ${it.title}（${it.source || "不明"}）`).join("\n")}

【出力（JSONのみ）】
{"picks":[{"index":0,"summary":"1行の紹介（30字前後・タイトルの言い換えでなく読者にとっての意味）"}]}
`.trim();
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 1024 })));
      const picks = Array.isArray(out.picks) ? out.picks : [];
      const sources = picks
        .map((p) => ({ item: items[Number(p.index)], summary: String(p.summary || "").trim() }))
        .filter((p) => p.item)
        .slice(0, 5)
        .map((p) => ({ title: p.item.title, url: p.item.url, source: p.item.source || "", date: p.item.date || "", summary: p.summary }));
      if (sources.length) return { success: true, sources };
    } catch (e) {
      console.warn(`[blogDialogue:sources] rank failed: ${e.message}`);
    }
    return {
      success: true,
      sources: items.slice(0, 5).map((it) => ({ title: it.title, url: it.url, source: it.source || "", date: it.date || "", summary: "" })),
    };
  }

  /* ---------- AI によるメディア（RSSソース）候補の発見 ----------
   * ソース記事の「AIおまかせ検索」用。関心（カテゴリ/サブトピック/クエリ）から実在する
   * メディア/ブログ/ニュースサイトを LLM に提案させ、各 feed を実際に取得できた
   * （＝実在性が確認できた）候補だけを返す。壊れた/存在しない RSS は自動で除外。 */
  if (mode === "discoverMedia") {
    const uid = context.auth?.uid;
    if (!uid) return { success: false, reason: "unauthenticated" };
    const interests = (Array.isArray(data.interests) ? data.interests : [])
      .map((x) => String(x || "").slice(0, 40).trim()).filter(Boolean).slice(0, 12);
    const query = String(data.query || "").trim().slice(0, 120);
    const exclude = new Set(
      (Array.isArray(data.exclude) ? data.exclude : [])
        .map((x) => String(x || "").toLowerCase().trim()).filter(Boolean));
    const focus = [query, ...interests].filter(Boolean).join(" / ") || "建築・インテリア・デザイン";

    const prompt = `
あなたは建築・インテリア・デザイン・テック分野に詳しいメディアリサーチャーです。
下記の関心に沿って、継続的に読む価値がある「実在する」メディア/ブログ/ニュースサイトを最大14件挙げてください。
現在も更新されていて公開RSS/Atomフィードを持つものを優先。日本語・英語どちらでも構いません。
公式ブログ（例: Anthropic, OpenAI, Google AI / DeepMind, Meta AI, Microsoft AI）や定番テックメディア
（例: The Verge, Ars Technica, TechCrunch, MIT Technology Review, VentureBeat）、建築・インテリア系メディアなど、
関心に直結し、かつ RSS が実在しそうなものを優先してください。憶測で存在しない媒体を作らないこと。

【関心】${focus}

【各メディアに付ける情報】
- name: 媒体名（正式名・40字以内）
- feed: 公開RSS/AtomフィードのURL（分かる限り正確に。WordPress系なら .../feed/ など。トップURLでなくフィードURL）
- note: 日本語1行の説明（40字前後・何が読めるか）
- lang: "ja" か "en"
- category: 建築 / インテリア / デザイン / 住まい・暮らし / 海外・トレンド / AI・テック のうち最も近いもの

【出力（JSONのみ・コードブロックや前置き無し）】
{"media":[{"name":"","feed":"https://...","note":"","lang":"ja","category":""}]}
`.trim();

    let proposed = [];
    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, {
        provider: textCfg.provider, model: textCfg.model, maxTokens: 2048,
      })));
      proposed = Array.isArray(out.media) ? out.media : [];
    } catch (e) {
      console.warn(`[blogDialogue:discoverMedia] llm failed: ${e.message}`);
      return { success: false, reason: `AI候補の生成に失敗しました: ${e.message}` };
    }

    // 実在性検証: feed を実際に取得できた候補だけ返す（URL の一般的な派生も試す）。
    const seen = new Set();
    const results = await Promise.all(proposed.slice(0, 16).map(async (m) => {
      const name = String(m.name || "").slice(0, 40).trim();
      const rawFeed = String(m.feed || "").trim();
      if (!name || !/^https?:\/\//.test(rawFeed)) return null;
      const lower = name.toLowerCase();
      if (exclude.has(lower) || seen.has(lower)) return null;
      const base = rawFeed.replace(/\/+$/, "");
      const variants = [...new Set([rawFeed, base, `${base}/feed/`, `${base}/feed`, `${base}/rss`, `${base}/rss.xml`, `${base}/atom.xml`])];
      for (const f of variants) {
        try {
          const items = await fetchSiteFeed(f, 1);
          if (items && items.length) {
            seen.add(lower);
            return {
              name,
              feed: f,
              note: String(m.note || "").slice(0, 80).trim(),
              lang: m.lang === "en" ? "en" : "ja",
              category: String(m.category || "").slice(0, 40).trim(),
            };
          }
        } catch (_) { /* 次の派生URLを試す */ }
      }
      return null;
    }));
    const candidates = results.filter(Boolean).slice(0, 12);
    return { success: true, candidates };
  }

  /* ---------- 関心ワードランキングの自動生成 ----------
   * ブログのカテゴリ＋購読メディアの最近のタイトルから、関心キーワードを重要度順に抽出。
   * ユーザーは返り値をベースに手動で微調整（ソース記事の関心ワードランキング）。 */
  if (mode === "suggestKeywords") {
    const uid = context.auth?.uid;
    if (!uid) return { success: false, reason: "unauthenticated" };
    const categories = Array.isArray(data.categories) ? data.categories.map(String).slice(0, 20) : [];
    const sites = (Array.isArray(data.sites) ? data.sites : []).slice(0, 10)
      .map((s) => ({ name: String(s.name || "").slice(0, 40), feed: String(s.feed || "") }))
      .filter((s) => /^https:\/\//.test(s.feed));
    let titles = [];
    if (sites.length) {
      const results = await Promise.all(sites.map(async (s) => {
        try { const items = await fetchSiteFeed(s.feed, 6); return items.map((it) => it.title).filter(Boolean); }
        catch { return []; }
      }));
      titles = results.flat().slice(0, 80);
    }
    const prompt = `
建築・インテリア・デザイン・テックの個人ブロガーの「関心ワードランキング」を作ります。
下記のカテゴリと、購読メディアの最近の記事タイトルから、この人が関心を持つキーワードを重要度順に最大12語抽出してください。
固有名詞（例: Claude, Gemini, OpenAI）も一般語（例: AI, 建築, インテリア）も可。短く検索に使える語で。重複や冗長な語は避ける。

【ブログのカテゴリ】${categories.join("、") || "（未設定）"}

【購読メディアの最近のタイトル】
${titles.map((t) => `- ${t}`).join("\n") || "（なし）"}

【出力（JSONのみ・コードブロック無し）】{"keywords":["最重要", "次点", ...]}
`.trim();
    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 512 })));
      const keywords = (Array.isArray(out.keywords) ? out.keywords : [])
        .map((k) => String(k || "").trim()).filter(Boolean).slice(0, 12);
      return { success: true, keywords };
    } catch (e) {
      console.warn(`[blogDialogue:suggestKeywords] failed: ${e.message}`);
      return { success: false, reason: `関心ワードの生成に失敗しました: ${e.message}` };
    }
  }

  /* ---------- 関心を深めるチャット ----------
   * セマンティックグラフの右サイドバーの専用チャット。関心テーマについて対話しながら、
   * 関心ワードランキングへの操作（追加/削除/順位変更）を提案する。
   * クライアントは ops を適用してグラフへ即時反映する。 */
  if (mode === "interestChat") {
    const uid = context.auth?.uid;
    if (!uid) return { success: false, reason: "unauthenticated" };
    const messages = (Array.isArray(data.messages) ? data.messages : []).slice(-12)
      .map((m) => ({ role: m.role === "user" ? "user" : "ai", text: String(m.text || "").slice(0, 1200) }))
      .filter((m) => m.text);
    const keywords = (Array.isArray(data.keywords) ? data.keywords : []).map(String).slice(0, 20);
    const categories = (Array.isArray(data.categories) ? data.categories : []).map(String).slice(0, 20);
    if (!messages.length) return { success: false, reason: "messages is required" };

    const prompt = `
あなたは建築・インテリア・デザイン・テック分野の「関心探索パートナー」です。
ユーザーと対話しながら、興味のあるワードや事柄を一緒に深掘りします。関連トピック・対比・具体例を出して会話を広げ、
必要に応じて「関心ワードランキング」への操作（追加/削除/順位変更）を提案してください。

【現在の関心ワードランキング（上から順位順）】
${keywords.map((k, i) => `${i + 1}位: ${k}`).join("\n") || "（まだ無し）"}

【ブログのカテゴリ】${categories.join("、") || "（未設定）"}

【これまでの会話】
${messages.map((m) => `${m.role === "user" ? "ユーザー" : "AI"}: ${m.text}`).join("\n")}

【指示】
- 返答は日本語で3〜6文。会話を深める問いかけを1つ含める。
- ランキング操作は会話の流れから自然な場合のみ提案（無理に毎回出さない）。
- add は新しいワード（rank 指定は任意・1始まり）、remove は既存ワード、move は既存ワードを to 位へ。

【出力（JSONのみ・コードブロック無し）】
{"reply":"返答本文","ops":[{"op":"add","word":"Claude Code","rank":3},{"op":"remove","word":"○○"},{"op":"move","word":"AI","to":1}]}
opsが不要なら "ops":[] とする。
`.trim();
    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 1200 })));
      const reply = String(out.reply || "").trim();
      const ops = (Array.isArray(out.ops) ? out.ops : [])
        .map((o) => ({
          op: String(o.op || ""),
          word: String(o.word || "").trim().slice(0, 40),
          rank: Number.isFinite(Number(o.rank)) ? Number(o.rank) : undefined,
          to: Number.isFinite(Number(o.to)) ? Number(o.to) : undefined,
        }))
        .filter((o) => ["add", "remove", "move"].includes(o.op) && o.word)
        .slice(0, 6);
      if (!reply) return { success: false, reason: "応答を生成できませんでした" };
      return { success: true, reply, ops };
    } catch (e) {
      console.warn(`[blogDialogue:interestChat] failed: ${e.message}`);
      return { success: false, reason: `応答の生成に失敗しました: ${e.message}` };
    }
  }

  /* ---------- メディア内容タグのバッチ取得（カード表示用・全ユーザー共有キャッシュ） ----------
   * blogMediaMeta（feedハッシュ）を読み、鮮度内はキャッシュを返す。未取得/古いものだけ
   * 上限件数まで分析して共有キャッシュへ保存。分析は媒体ごと1回だけ＝コストは媒体数で頭打ち。
   * 未処理が残ればクライアントが再度呼んで順次埋める（pending を返す）。 */
  if (mode === "mediaMeta") {
    const uid = context.auth?.uid;
    if (!uid) return { success: false, reason: "unauthenticated" };
    const sites = (Array.isArray(data.sites) ? data.sites : []).slice(0, 60)
      .map((s) => ({ name: String(s.name || "").slice(0, 40), feed: String(s.feed || "").trim() }))
      .filter((s) => /^https?:\/\//.test(s.feed));
    if (!sites.length) return { success: true, meta: {}, pending: 0 };

    const db = admin.firestore();
    const col = db.collection("blogMediaMeta");
    const FRESH_MS = 30 * 24 * 3600 * 1000; // 30日鮮度
    const now = Date.now();
    const refs = sites.map((s) => col.doc(blogMediaDocId(s.feed)));
    let snaps = [];
    try { snaps = await db.getAll(...refs); } catch (e) { console.warn(`[mediaMeta] getAll failed: ${e.message}`); }

    const meta = {}; // feed -> {keywords, tone, summary}
    const missing = [];
    sites.forEach((s, i) => {
      const d = snaps[i] && snaps[i].exists ? snaps[i].data() : null;
      if (d && d.updatedAt && (now - d.updatedAt) < FRESH_MS && Array.isArray(d.keywords)) {
        meta[s.feed] = { keywords: d.keywords, tone: d.tone || "", summary: d.summary || "" };
      } else {
        missing.push({ ...s, ref: refs[i] });
      }
    });

    // 未取得のうち上限件数だけ今回分析（タイムアウト/レート回避）。残りは pending で返す。
    const CAP = 12;
    const toAnalyze = missing.slice(0, CAP);
    await Promise.all(toAnalyze.map(async (s) => {
      try {
        const items = await fetchSiteFeed(s.feed, 20);
        const titles = items.map((it) => it.title).filter(Boolean).slice(0, 20);
        if (!titles.length) return;
        const prompt = `
メディア「${s.name}」の最近の記事タイトルです。どんな内容を多く扱うか日本語で簡潔に分析してください。
${titles.map((t) => `- ${t}`).join("\n")}
【出力（JSONのみ）】{"summary":"1〜2文","keywords":["よく出るトピック", ...最大8語],"tone":"文体/レベルを一言"}
`.trim();
        const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 500 })));
        const rec = {
          name: s.name, feed: s.feed,
          summary: String(out.summary || "").trim(),
          keywords: (Array.isArray(out.keywords) ? out.keywords : []).map((k) => String(k || "").trim()).filter(Boolean).slice(0, 8),
          tone: String(out.tone || "").trim(),
          updatedAt: now,
        };
        await s.ref.set(rec, { merge: true });
        meta[s.feed] = { keywords: rec.keywords, tone: rec.tone, summary: rec.summary };
      } catch (e) { /* この媒体は次回に回す */ }
    }));

    return { success: true, meta, pending: Math.max(0, missing.length - toAnalyze.length) };
  }

  /* ---------- メディアの内容傾向の分析 ----------
   * 1媒体の最近のタイトルから「どんな内容が多いか」を LLM が要約。ソース記事のメディア詳細ダイアログ用。 */
  if (mode === "analyzeMedia") {
    const name = String(data.name || "").slice(0, 40).trim();
    const feed = String(data.feed || "").trim();
    if (!/^https:\/\//.test(feed)) return { success: false, reason: "feed is required" };
    let items = [];
    try { items = await fetchSiteFeed(feed, 20); }
    catch (e) { return { success: false, reason: `記事を取得できませんでした: ${e.message}` }; }
    if (!items.length) return { success: false, reason: "記事が取得できませんでした（時間をおいて再試行してください）" };
    const titles = items.map((it) => it.title).filter(Boolean).slice(0, 20);
    const sample = items.slice(0, 8).map((it) => ({ title: it.title, url: it.url, date: it.date || "" }));
    const prompt = `
メディア「${name}」の最近の記事タイトル一覧です。このメディアがどんな内容を多く扱うか、日本語で分析してください。

【最近のタイトル】
${titles.map((t) => `- ${t}`).join("\n")}

【出力（JSONのみ・コードブロック無し）】
{"summary":"2〜3文で、このメディアの傾向・強み・読者にとっての価値","keywords":["よく出るトピック", ...最大8語],"tone":"文体/レベルを一言（例: 速報系 / 専門的 / 初心者向け 等）"}
`.trim();
    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 700 })));
      const summary = String(out.summary || "").trim();
      const keywords = (Array.isArray(out.keywords) ? out.keywords : []).map((k) => String(k || "").trim()).filter(Boolean).slice(0, 8);
      const tone = String(out.tone || "").trim();
      // 全ユーザー共有キャッシュに保存（カード用バッチ mediaMeta と共用・再分析を防ぐ）
      try {
        await admin.firestore().collection("blogMediaMeta").doc(blogMediaDocId(feed))
          .set({ name, feed, summary, keywords, tone, updatedAt: Date.now() }, { merge: true });
      } catch (e) { console.warn(`[analyzeMedia] cache write failed: ${e.message}`); }
      return { success: true, analysis: {
        summary, keywords, tone,
        sampleTitles: titles.slice(0, 8),
        items: sample,
      } };
    } catch (e) {
      console.warn(`[blogDialogue:analyzeMedia] llm failed: ${e.message}`);
      // LLM 失敗でも最近のタイトルは返す（最低限の確認はできる）
      return { success: true, analysis: { summary: "", keywords: [], tone: "", sampleTitles: titles.slice(0, 8), items: sample } };
    }
  }

  /* ---------- テーマ(+Web記事)から下書き ---------- */
  if (mode === "draft") {
    const theme = String(data.theme || "").trim();
    const sourceRefs = Array.isArray(data.sourceRefs) ? data.sourceRefs.slice(0, 4) : [];
    if (!theme && !sourceRefs.length) return { success: false, reason: "theme is required" };
    const categories = Array.isArray(data.categories) && data.categories.length
      ? data.categories : ["お知らせ", "設計", "インテリア", "施工事例", "コラム", "その他"];
    const authorName = String(data.authorName || "").trim();

    // 選んだWeb記事の本文をベストエフォートで取得（並列・失敗は無視）
    let sourceBlock = "";
    if (sourceRefs.length) {
      const texts = await Promise.all(sourceRefs.map((r) => fetchArticleText(r.url)));
      sourceBlock = sourceRefs.map((r, i) =>
        `【題材${i + 1}】${r.title}${r.source ? `（${r.source}）` : ""}\nURL: ${r.url}\n${texts[i] ? `本文抜粋: ${texts[i]}` : (r.summary ? `概要: ${r.summary}` : "")}`
      ).join("\n\n");
    }

    const prompt = `
あなたは建築・インテリア分野のブログ執筆パートナーです。
ユーザー（設計者${authorName ? `・${authorName}さん` : ""}）の個人ブログに載せる記事の「下書き」を書いてください。

【条件】
- 著者はユーザー本人。「私」視点の一人称・ですます調
- テーマ: ${theme || "（下記の題材記事から適切に設定）"}
${sourceRefs.length ? `- **下記のWeb記事を題材に**、内容を自分の言葉で紹介・整理する。引用は要約にとどめ、コピーしない。記事末尾に「### 参考記事」としてMarkdownリンクのリストを必ず付ける` : ""}
- 構成と事実ベースの説明を用意する。ただし**意見・主張・体験談は書き込みすぎない**（この後ユーザーとAIが議論し、ユーザー自身の考えを反映するため。断定的な主張は避け、余白を残す）
- Markdown（## 見出し・リスト等）で800〜1200字
- あわせて「議論の口火」を用意する: ${sourceRefs.length ? "題材記事について著者がどう考えるかを引き出す呼びかけ" : "記事を挟んで議論を始めるための呼びかけ"}（挨拶+一番議論したい論点+問いかけ、100字前後）と、論点の候補3つ（各15字前後）

${sourceBlock ? `【題材のWeb記事】\n${sourceBlock}\n` : ""}
${memorySection}
【出力（JSONのみ。前後に説明やコードブロックを付けない）】
{"title":"記事タイトル","excerpt":"抜粋(80字以内)","bodyMarkdown":"## ...","tags":["タグ1","タグ2","タグ3"],"category":"${categories.join(" / ")} のいずれか1つ","opener":{"text":"議論の呼びかけ","points":["論点1","論点2","論点3"]}}
`.trim();

    let out;
    try {
      out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model })));
    } catch (e) {
      return { success: false, reason: `draft failed: ${e.message}` };
    }
    return {
      success: true,
      title: out.title || theme,
      excerpt: out.excerpt || "",
      bodyMarkdown: out.bodyMarkdown || "",
      tags: Array.isArray(out.tags) ? out.tags.slice(0, 5) : [],
      category: categories.includes(out.category) ? out.category : categories[0],
      sourceRefs,
      opener: out.opener && out.opener.text
        ? { text: String(out.opener.text), points: Array.isArray(out.opener.points) ? out.opener.points.slice(0, 3) : [] }
        : null,
    };
  }

  /* ---------- 対話（議論の1ターン。タップ用の選択肢付き） ----------
   * 通常: 下書きを挟んで議論。
   * 議論ファースト（ホームのフィード発）: 下書きが無い場合は Web記事本文を読んで議論。
   * sourceText はサーバーで一度だけ取得し、クライアントへ返してキャッシュ（以後のターンは再取得しない）。 */
  if (mode === "turn") {
    const title = String(data.title || "").trim();
    const body = String(data.bodyMarkdown || "").slice(0, 5000);
    const history = Array.isArray(data.history) ? data.history : [];
    const userMessage = String(data.userMessage || "").trim();
    const sourceRefs = Array.isArray(data.sourceRefs) ? data.sourceRefs : [];
    const isOpening = history.length === 0 && !userMessage;
    const noDraft = !body.trim() && sourceRefs.length > 0; // 議論ファーストモード

    // 🎭 インタビュアー人格（クライアントが選択。未指定なら従来の編集者）
    const interviewer = data.interviewer && typeof data.interviewer.prompt === "string" && data.interviewer.prompt.trim()
      ? data.interviewer : null;
    const personaSection = interviewer
      ? `${interviewer.prompt.trim()}\n共通の目的: 最終的に**ユーザー自身の考え・経験・立場を引き出す**こと。あなたの意見だけで記事を埋めない。`
      : `あなたはユーザー（ブログの著者本人）にインタビューする編集者です。\n目的は**ユーザー自身の考え・経験・立場を引き出す**こと。あなたの意見で記事を埋めることではありません。`;

    // 🎯 インタビューのペース配分（往復回数の目安。0=無制限）
    const targetRounds = Number.isFinite(data.targetRounds) ? Math.max(0, Math.floor(data.targetRounds)) : 0;
    const roundsSoFar = Number.isFinite(data.roundsSoFar)
      ? Math.max(0, Math.floor(data.roundsSoFar))
      : history.filter((h) => h.role === "user").length;
    const pacingSection = targetRounds > 0 ? `
【インタビューのペース配分】
このインタビューは合計およそ ${targetRounds} 往復で完結させる想定です（現在 ${roundsSoFar} 往復目）。
- 序盤（残り往復が多い）: 論点を広げ、ユーザーの立場・経験を引き出す
- 中盤: 記事の核になりそうな論点1〜2個に絞って深掘りする
- 終盤（残り1〜2往復）: 新しい論点は開かず、これまでの発言の確認・補強に徹する
- 目安に達したら: 質問を続けず「十分に材料が集まりました。記事の生成に進みましょう」と促し、"startWriting": true を返してよい（ユーザーがまだ話したそうなら無理に打ち切らない）` : "";

    // 📖 題材記事のブロック（本文・画像）。AIが具体的な段落・写真を取り上げて質問し、
    // 取り上げたブロックの番号を refs で返す（クライアントがリーダーをその箇所へスクロール）。
    const articleBlocks = Array.isArray(data.articleBlocks) ? data.articleBlocks.slice(0, 60) : [];
    const blocksSection = articleBlocks.length ? `
【題材記事のブロック一覧】（[番号] 内容。写真は near=前後の文脈から何が写っているか推測してよい）
${articleBlocks.map((b) => {
  const i = Number(b.i);
  if (!Number.isInteger(i)) return "";
  if (b.t === "img") return `[${i}]（写真）${String(b.near || "").slice(0, 200)}`;
  return `[${i}]${b.t === "h" ? "（見出し）" : ""}${String(b.text || "").slice(0, 240)}`;
}).filter(Boolean).join("\n")}` : "";

    // 議論ファースト時のみ、題材記事の本文をベストエフォートで取得（クライアントキャッシュ優先）
    let sourceText = String(data.sourceText || "").slice(0, 3000);
    if (noDraft && !sourceText) {
      const texts = await Promise.all(sourceRefs.slice(0, 2).map((r) => fetchArticleText(r.url, 1500)));
      sourceText = texts.filter(Boolean).join("\n---\n").slice(0, 3000);
    }

    // 議論ファーストの初回だけ、記事の日本語要約（英語記事は翻訳）を先に返す
    const wantSummary = noDraft && isOpening;

    const prompt = `
${personaSection}
${noDraft ? "※ ユーザーはまだ下書きを書いていません。世の中のWeb記事を題材に、自分のブログ記事を書こうとしています。記事の内容を踏まえてインタビューし、ユーザーの視点・考えを引き出してください。" : ""}

【応答の条件（インタビュー形式）】
- **質問は1回の応答につき1つだけ**。質問の前に「なぜそれを聞くのか（意図）」がひとことで伝わるようにする
- 3〜5文、話し言葉で簡潔に。堅すぎない
- 相づちだけで終わらない。ユーザーの発言は否定せず、まず受け止めてから次の質問で深掘りする
- あわせて、ユーザーが**タップするだけで答えられる選択肢を2〜4個**用意する（質問への立場・答えの候補。各8〜14字。「もっと詳しく話したい」のような逃げ道も1つ含めてよい）
- 素材が十分に集まり**執筆開始を宣言するとき**（例:「では下書きを作成しますね」）は、JSONに "startWriting": true を必ず含めること。アプリはこのフラグを見て実際に記事生成を開始する。**宣言だけしてフラグを付けないのは禁止**（ユーザーが待ちぼうけになる）。まだ聞きたいことが残っているなら宣言せず質問を続ける
${articleBlocks.length ? `- 題材記事のブロック一覧があるので、**具体的な写真や段落を1つ取り上げてから質問する**（毎ターン全部ではなく、話の流れに合う1〜2箇所だけ。例:「[4]の赤い照明の写真、印象的ですね。ご自身の設計ではこういう…」）。取り上げたブロックの番号を JSON の "refs":[番号] に入れる（0〜2個。取り上げなければ空配列）` : ""}
${wantSummary
  ? `- 初回なので、まず題材記事の**日本語の要約**を作る（元記事が英語でも必ず日本語に翻訳して要約）: overview=2〜3文の概要、points=重要ポイント3〜5個（各30字前後）。そのうえで reply では、ひとこと挨拶+インタビュー開始を告げ、最初の質問を1つする`
  : isOpening ? "- まだ対話が無いので、記事を読んだうえで最も議論したい論点を示し、最初の質問を1つしてください" : ""}
${pacingSection}

${noDraft ? "" : `【記事タイトル】${title}\n【記事本文(Markdown)】\n${body}`}
${sourceRefs.length ? `\n【題材にしたWeb記事】\n${fmtSources(sourceRefs)}` : ""}
${sourceText ? `\n【題材記事の本文（抜粋）】\n${sourceText}` : ""}
${blocksSection}

【これまでの対話】
${fmtHistory(history) || "（まだ無し）"}
${userMessage ? `\n【ユーザーの発言】\n${userMessage}` : ""}
${memorySection}
【出力（JSONのみ）】
${wantSummary
  ? `{"summary":{"overview":"2〜3文の日本語概要","points":["ポイント1","ポイント2","ポイント3"]},"reply":"挨拶+最初の質問","choices":["選択肢1","選択肢2","選択肢3"]${articleBlocks.length ? ',"refs":[]' : ""}}`
  : `{"reply":"あなたの応答","choices":["選択肢1","選択肢2","選択肢3"]${articleBlocks.length ? ',"refs":[]' : ""},"startWriting":false}`}
`.trim();

    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: wantSummary ? 2048 : 1024 })));
      const summary = wantSummary && out.summary && (out.summary.overview || (out.summary.points || []).length)
        ? {
            overview: String(out.summary.overview || "").trim(),
            points: (Array.isArray(out.summary.points) ? out.summary.points : []).slice(0, 5).map((p) => String(p).trim()).filter(Boolean),
          }
        : null;
      // 📖 AIが取り上げた記事内の箇所（refs）。範囲内の整数のみ・最大3個。
      const refs = Array.isArray(out.refs)
        ? out.refs.map(Number).filter((n) => Number.isInteger(n) && n >= 0).slice(0, 3)
        : [];
      return {
        success: true,
        reply: String(out.reply || "").trim(),
        choices: Array.isArray(out.choices)
          ? out.choices.slice(0, 4).map((c) => String(c).trim()).filter(Boolean)
          : [],
        ...(summary ? { summary } : {}),
        ...(refs.length ? { refs } : {}), // クライアントがサムネ/引用表示＋リーダーをスクロール
        ...(out.startWriting ? { startWriting: true } : {}), // 執筆開始宣言 → クライアントが自動で synthesize へ
        ...(noDraft && sourceText ? { sourceText } : {}), // クライアントがキャッシュして次ターンから送り返す
      };
    } catch (e) {
      return { success: false, reason: `turn failed: ${e.message}` };
    }
  }

  /* ---------- 画像プランのみ生成（エディタの「🖼 画像生成」ボタン用） ----------
   * 画像が入っていないセクションの見出しリストを受け取り、各見出しに1枚ずつの
   * 生成プロンプト（+必要ならカバー）を返す。画像の実生成はクライアントが generateBlogImage で行う。 */
  if (mode === "imagePlan") {
    const title = String(data.title || "").trim();
    const headings = (Array.isArray(data.headings) ? data.headings : [])
      .map((h) => String(h || "").trim().slice(0, 120)).filter(Boolean).slice(0, 8);
    const context = String(data.context || "").slice(0, 4000);
    const needCover = !!data.needCover;
    if (!headings.length && !needCover) return { success: true, images: [], cover: null };

    const prompt = `
あなたはブログ記事のアートディレクターです。以下の記事について、指定された各セクションに添えるAI生成画像を計画してください。

【記事タイトル】${title}
【本文（抜粋）】
${context}

【画像が必要なセクション見出し】
${headings.map((h) => `- ${h}`).join("\n") || "（なし）"}
${needCover ? "\n【あわせて】記事全体を象徴するカバー（サムネイル）画像も1つ計画する" : ""}

【条件】
- **上記の見出しそれぞれに必ず1枚ずつ**計画する（過不足なく）。heading は見出し文言をそのまま返す
- caption は日本語（20字前後）、prompt は**英語**の画像生成指示
- ⚠️著作権・誤認回避: 実在の特定建築物・人物・ロゴ・商標・文字は描かせない。セクションのテーマを象徴する一般的で抽象度の高いイメージ（空間の雰囲気・素材・光・スケール感）を photorealistic, architectural photography style で指示する

【出力（JSONのみ）】
{"images":[{"heading":"見出し","caption":"日本語キャプション","prompt":"English image generation prompt"}]${needCover ? ',"cover":{"caption":"日本語キャプション","prompt":"English prompt for the article key visual"}' : ""}}
`.trim();

    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model, maxTokens: 2048 })));
      return { success: true, images: sanitizeImagePlan(out.images), cover: sanitizeCoverPlan(out.cover) };
    } catch (e) {
      return { success: false, reason: `imagePlan failed: ${e.message}` };
    }
  }

  /* ---------- 議論を記事に反映（下書きが無ければ議論から新規生成） ---------- */
  if (mode === "synthesize") {
    const title = String(data.title || "").trim();
    const body = String(data.bodyMarkdown || "").slice(0, 8000);
    const history = Array.isArray(data.history) ? data.history : [];
    const sourceRefs = Array.isArray(data.sourceRefs) ? data.sourceRefs : [];
    const sourceText = String(data.sourceText || "").slice(0, 3000);
    const userTurns = history.filter((m) => m.role === "user" && String(m.text || "").trim());
    if (!userTurns.length) return { success: false, reason: "議論でのあなたの発言がまだありません" };

    // 🧠 議論からユーザーメモリーを自動抽出（docs/21 経路①）。記事生成と並走させ、
    // 応答に savedMemories を添える（クライアントが「メモリーに保存しました」チップを表示）。
    // 失敗は aiMemory 側で握りつぶされ []（記事生成は巻き込まない）。
    const memoryPromise = memUid
      ? extractAndSaveUserMemories(db, memUid, {
          history,
          sourceKind: "blogDiscussion",
          refId: data.articleId || sourceRefs[0]?.url || "",
          callLLM,
        })
      : Promise.resolve([]);

    // 🎯 目標文字数: クライアントが議論量から算出して送る（無ければ既定2000字）。SEO的に1500〜3000字帯が主戦場
    const targetChars = Math.min(4000, Math.max(1000, Number(data.targetChars) || 2000));

    // 🖼 画像プラン: **各セクション（##見出し）ごとに**、そのセクションを象徴するAI画像を1枚ずつ計画する。
    // 本文にはトークンを埋め込まない（配置はクライアントが heading を目印に見出し直後へ挿入する）。
    // images[] に heading（対応する##見出しの文言そのまま）/ caption（日本語）/ prompt（英語）を返す。
    const IMG_INSTRUCTION = `
【記事に添える画像（AI生成・全セクション必須）】
- **すべての ## セクションそれぞれに必ず1枚**、そのセクションのテーマに沿った画像を計画する（「参考記事」セクションだけは除く。既に画像 ![ ] がある節も除く）
- あわせて **cover（記事のサムネイル/カバー画像）を必ず1つ**計画する（記事全体を象徴するキービジュアル。本文には置かない）
- 本文にはプレースホルダを一切書かない。代わりに images 配列と cover で指定する:
  - heading: その画像を置くセクションの見出し文言（本文の ## の後ろの文字列と**完全一致**させる）
  - caption: 日本語のキャプション（20字前後）
  - prompt: **英語**の画像生成指示
- ⚠️著作権・誤認回避: **元記事の写真は使わない。実在の特定建築物・人物・ロゴ・商標・文字は描かせない**。各セクションのテーマを象徴する一般的で抽象度の高いイメージ（空間の雰囲気・素材・光・スケール感）を photorealistic, architectural photography style で指示する`;

    // 議論ファースト: 下書きが無い → 議論＋題材記事からブログ記事を新規生成
    if (!body.trim() && sourceRefs.length) {
      const genPrompt = `
以下は、Web記事を題材にした、ブログの著者（ユーザー）とAIの議論ログです。
この議論を軸に、**著者の一人称ブログ記事**をMarkdownで新規に書いてください。

【執筆の指示】
- 著者はユーザー本人。「私」視点の一人称・ですます調。本文はおよそ${targetChars}字（±2割）
- SEOを意識する: 導入の1〜2段落目に記事の結論・要旨を置く / ##見出しは検索されそうな言葉を含める / 1見出しあたり300〜500字で構造化する
- **議論で著者が述べた意見・経験・立場（選択肢で選んだ立場も含む）が記事の主張の軸**。前半〜中盤に配置
- 題材のWeb記事は自分の言葉で紹介・要約する（コピーしない）。記事の導入は「この記事を読んで考えたこと」の文脈で自然に
- AI側の発言は視点の整理としてのみ使い、記事の主張にしない。**著者の発言に無い意見・体験・数値を創作しない**
- Markdown（## 見出し2〜4個・リスト等）。末尾に「### 参考記事」としてMarkdownリンクのリストを必ず付ける
- SEO: slug は記事の主題を表す**英小文字・数字・ハイフンのみ**（ASCII、3〜6語、60字以内）。excerpt はメタディスクリプションとして**110〜120字**にする
${IMG_INSTRUCTION}

【題材のWeb記事】
${fmtSources(sourceRefs)}
URL:
${sourceRefs.slice(0, 5).map((r) => `- [${r.title}](${r.url})`).join("\n")}
${sourceText ? `\n【題材記事の本文（抜粋）】\n${sourceText}` : ""}

【議論ログ】
${fmtHistory(history)}
${memorySection}
【出力（JSONのみ）】
{"title":"記事タイトル（著者の視点が出る・30字前後）","slug":"ascii-hyphenated-keywords","excerpt":"メタディスクリプション(110〜120字)","bodyMarkdown":"## 見出し\n本文...","tags":["タグ1","タグ2","タグ3"],"images":[{"heading":"見出し（##の後の文言と完全一致）","caption":"日本語キャプション","prompt":"English image generation prompt"}],"cover":{"caption":"日本語キャプション","prompt":"English image generation prompt for the article key visual"}}
`.trim();
      try {
        const out = JSON.parse(cleanJson(await callLLM(genPrompt, { provider: textCfg.provider, model: textCfg.model })));
        return {
          success: true,
          title: out.title || title || (sourceRefs[0] ? `${sourceRefs[0].title}を読んで` : "無題"),
          slug: seoSlug(out.slug),
          excerpt: out.excerpt || "",
          bodyMarkdown: out.bodyMarkdown || "",
          tags: Array.isArray(out.tags) ? out.tags.slice(0, 5) : [],
          images: sanitizeImagePlan(out.images),
          cover: sanitizeCoverPlan(out.cover),
          generated: true, // 新規生成（before無し）
          before: { title, bodyMarkdown: "" },
          savedMemories: await memoryPromise,
        };
      } catch (e) {
        return { success: false, reason: `generate failed: ${e.message}` };
      }
    }

    const prompt = `
以下は、ユーザー（ブログの著者本人）の記事の下書きと、著者とAIの議論ログです。
両者を統合し、**著者自身の考えが伝わる完成記事**をMarkdownで書いてください。

【統合の指示】
- 著者はユーザー本人。「私」視点の一人称・ですます調
- **議論で著者が述べた意見・経験・立場（選択肢で選んだ立場も含む）を、記事の主張として織り込む**（断片的な発言でも、要旨を保ったまま自然な文章に整えてよい）
- AI側の発言は視点の整理・補助としてのみ使い、記事の主張にしない
- **著者の発言に無い意見・体験・数値を創作しない**
- 構成は下書きを活かす。著者の考えが際立つよう、主張部分は前半〜中盤に配置
${sourceRefs.length ? `- 下書きにある「### 参考記事」のリンクリストは末尾に必ず残す（無ければ追加する）` : ""}
- Markdown（## 見出し・リスト・引用等）。本文はおよそ${targetChars}字（±2割）を目安に、下書きの内容を損なわない範囲で調整する
- SEOを意識する: 導入の1〜2段落目に記事の結論・要旨を置く / ##見出しは検索されそうな言葉を含める
${IMG_INSTRUCTION}

【記事タイトル】${title}
【下書き(Markdown)】
${body}
${sourceRefs.length ? `\n【題材にしたWeb記事】\n${fmtSources(sourceRefs)}\nURL:\n${sourceRefs.slice(0, 5).map((r) => `- [${r.title}](${r.url})`).join("\n")}` : ""}

【議論ログ】
${fmtHistory(history)}
${memorySection}
- SEO: slug は記事の主題を表す**英小文字・数字・ハイフンのみ**（ASCII、3〜6語、60字以内）。excerpt はメタディスクリプションとして**110〜120字**にする

【出力（JSONのみ）】
{"title":"タイトル（必要なら微調整）","slug":"ascii-hyphenated-keywords","excerpt":"メタディスクリプション(110〜120字)","bodyMarkdown":"## 見出し\n本文...","images":[{"heading":"見出し（##の後の文言と完全一致・既に画像がある節は含めない）","caption":"日本語キャプション","prompt":"English image generation prompt"}],"cover":{"caption":"日本語キャプション","prompt":"English image generation prompt for the article key visual"}}
`.trim();

    try {
      const out = JSON.parse(cleanJson(await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model })));
      return {
        success: true,
        title: out.title || title,
        slug: seoSlug(out.slug),
        excerpt: out.excerpt || "",
        bodyMarkdown: out.bodyMarkdown || body,
        images: sanitizeImagePlan(out.images),
        cover: sanitizeCoverPlan(out.cover),
        before: { title, bodyMarkdown: body },
        savedMemories: await memoryPromise,
      };
    } catch (e) {
      return { success: false, reason: `synthesize failed: ${e.message}` };
    }
  }

  return { success: false, reason: `unknown mode: ${mode}` };
};

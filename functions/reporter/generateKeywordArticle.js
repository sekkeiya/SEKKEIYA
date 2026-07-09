/**
 * generateKeywordArticle.js — AI記者 モード②（検索需要記事）
 *
 * トピックキュー（topicQueue）の「狙いたい検索キーワード」を受け取り、
 * Gemini で SEO 最適化された記事を生成して officialArticles に status:"review" で投入する。
 *
 * フロー:
 *   /admin/strategy でトピック（keyword）を追加
 *   → 「記事を生成」ボタン → generateKeywordArticle({ topicId, keyword, category, note })
 *   → Gemini で SEO 記事を生成 → officialArticles status:"review"
 *   → topicQueue の該当トピックを status:"review" に更新
 *   → 管理者が /admin/articles でレビュー → published に変更 → 公開
 *
 * モード①（generateTrendArticle = 内部トレンド/ブランディング）との違い:
 *   こちらは「実際に検索されるキーワード」を狙う集客記事。検索意図を満たす実用記事を書く。
 *
 * 設計方針:
 *   - 全自動公開はしない（status:"review" で止める）
 *   - slug は Gemini に英語 kebab-case を生成させ、衝突時はサフィックスで一意化
 */
const admin = require("firebase-admin");
const { callLLM, getTextModelConfig } = require("./llm");
const { buildBrandBlock, sanitizeInternalLinks } = require("./officialBrandContext");

/**
 * 下書きから「創業者インタビュー」の質問を3〜5個生成する（担当記者の人格で問う）。
 * 失敗しても下書きは活かす想定なので、呼び出し側で try/catch する。
 */
async function generateInterviewQuestions(textCfg, { reporter, keyword, category, body }) {
  const persona = reporter
    ? `あなたは「${reporter.displayName || reporter.name}」という、${reporter.expertise || "建築・インテリア設計"}を専門とするSEKKEIYA公式ブログの記者です。文体・トーン: ${reporter.tone || "専門的で分かりやすい"}。`
    : `あなたはSEKKEIYA公式ブログの編集者です。`;
  const prompt = `
${persona}
以下は「${keyword}」についてAIが作成した記事の下書きです。創業者（運営者）の一次情報で差別化したい。
次の2つを作ってください。

【A. 記事の図解スライド（ペライチ）】創業者が数秒で記事の要点を把握でき、質問に答えやすくするための1枚要約。
- title: 記事の主題（20字以内）
- summary: 1行の要約（40字以内）
- points: 記事の要点を3〜4個（各 heading=見出し10字前後 / detail=補足25字前後）

【B. 取材質問】創業者に取材する質問を3〜5個、重要度が高い順に。
- **短く簡潔に**（30字前後・長くても40字）。二重質問・長い前置き禁止
- 選択 or 1〜2行で答えられる粒度。事実確認でなく「意見・体験・使いどころ・今後」を引き出す
- 各質問に、タップで選べる**短い選択肢を2〜4個**（8〜12字程度のキーワードや立場）
- 各質問に **intent（この質問のねらい）** を1文（25〜45字）：記者が創業者に語りかける体で「なぜ聞くのか／引き出したい一次情報／記事のどこで活きるか」を伝える。例:「読者が一番知りたい"導入効果"を、あなたの実感で語ってほしいです」

【下書き本文】
${String(body || "").slice(0, 3500)}

【出力形式（JSONのみ。前後に説明やコードブロックを付けない）】
{"slide":{"title":"","summary":"","points":[{"heading":"","detail":""}]},"questions":[{"q":"短い質問","priority":1,"intent":"この質問のねらい（記者の語りかけ）","choices":["選択肢1","選択肢2"]}]}
`.trim();
  const raw = await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model });
  const jsonStr = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(jsonStr);
  const qs = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions = qs
    .slice(0, 5)
    .map((x, i) => ({
      id: `q${i + 1}`,
      q: String(x.q || "").trim(),
      intent: String(x.intent || "").trim(),
      priority: Number(x.priority) || i + 1,
      choices: Array.isArray(x.choices)
        ? x.choices.slice(0, 4).map((c) => String(c).trim()).filter(Boolean)
        : [],
      answer: "",
      answeredAt: null,
    }))
    .filter((x) => x.q);
  let slide = null;
  if (parsed.slide && typeof parsed.slide === "object") {
    const pts = Array.isArray(parsed.slide.points) ? parsed.slide.points : [];
    slide = {
      title: String(parsed.slide.title || "").trim(),
      summary: String(parsed.slide.summary || "").trim(),
      points: pts.slice(0, 4)
        .map((p) => ({ heading: String(p.heading || "").trim(), detail: String(p.detail || "").trim() }))
        .filter((p) => p.heading || p.detail),
    };
  }
  return { questions, slide };
}

/** 英数字 kebab-case のみに正規化（日本語は落ちるので英語slug前提） */
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * カテゴリ名から「ハブ(category) + サブ(subCategory)」を解決する。
 * - サブカテゴリ名が渡されたら category=親ハブ / subCategory=そのサブ（公開フィルタはハブで一致）
 * - ハブ名が渡されたら category=それ自身 / subCategory=null
 * - categories 未整備なら渡された名前をそのまま category に使う
 */
async function resolveCategoryPath(db, name) {
  try {
    const snap = await db.collection("categories").get();
    const all = snap.docs.map((d) => d.data());
    const found = all.find((c) => c.name === name);
    if (found) {
      if (found.parent) {
        const par = all.find((c) => c.slug === found.parent);
        return {
          category: par ? { slug: par.slug, name: par.name } : { slug: found.slug, name: found.name },
          subCategory: { slug: found.slug, name: found.name },
        };
      }
      return { category: { slug: found.slug, name: found.name }, subCategory: null };
    }
  } catch (e) {
    console.warn(`[generateKeywordArticle] resolveCategoryPath failed: ${e.message}`);
  }
  return { category: { slug: slugify(name) || "tips", name }, subCategory: null };
}

/** 担当記者を解決する。reporterId 優先 → カテゴリ一致で自動マッチ → null（汎用ライター） */
async function resolveReporter(db, reporterId, category) {
  try {
    if (reporterId) {
      const snap = await db.collection("reporters").doc(reporterId).get();
      if (snap.exists) return { id: snap.id, ...snap.data() };
    }
    // reporters は少数想定。全件取得して active + カテゴリ一致を JS で判定（複合インデックス不要）
    const all = await db.collection("reporters").get();
    const reporters = all.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.active !== false);
    if (category) {
      const m = reporters.find((r) => Array.isArray(r.categories) && r.categories.includes(category));
      if (m) return m;
    }
  } catch (e) {
    console.warn(`[generateKeywordArticle] resolveReporter failed: ${e.message}`);
  }
  return null;
}

/** キーワードに応じて既存アセットから関連カバー画像を選ぶ */
function pickCover(keyword) {
  const k = String(keyword || "");
  if (/間取り|レイアウト|配置|平面|プラン|floor|plan|layout/i.test(k)) return "/images/demo_assets/floorplan.png";
  if (/外観|外構|敷地|外壁|ファサード|パース|exterior|site|facade/i.test(k)) return "/images/demo_assets/exterior.png";
  return "/images/demo_assets/interior.png";
}

/** col 内で slug が一意になるよう、衝突時は -2, -3 … を付与 */
async function uniqueSlug(col, base) {
  let slug = base || `kw-article`;
  let n = 1;
  // 最大20回まで（実用上十分）
  while (n <= 20) {
    const candidate = n === 1 ? slug : `${slug}-${n}`;
    const hit = await col.where("slug", "==", candidate).limit(1).get();
    if (hit.empty) return candidate;
    n++;
  }
  return `${slug}-${Date.now()}`;
}

exports.generateKeywordArticle = async (data = {}, context = {}, apiKey) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const textCfg = await getTextModelConfig(db); // 文章生成モデル（Gemini/Claude）
  console.log(`[generateKeywordArticle] textModel=${textCfg.provider}/${textCfg.model}`);

  const keyword = (data.keyword || "").trim();
  if (!keyword) return { success: false, reason: "keyword is required" };
  const category = (data.category || "Tips / Learn").trim();
  const note = (data.note || "").trim();
  const topicId = data.topicId || null;

  // 担当記者を解決（専門AI記者）。人格・専門性・文体をプロンプトに注入する。
  const reporter = await resolveReporter(db, data.reporterId, category);
  const personaBlock = reporter
    ? `あなたは「${reporter.displayName || reporter.name}」という、${reporter.expertise || "建築・インテリア設計"}を専門とするSEKKEIYA公式ブログの記者です。
文体・トーン: ${reporter.tone || "専門的で分かりやすい"}。
この専門性と文体を記事全体で一貫して保ちながら、SEOに強い記事を書いてください。`
    : `あなたはSEKKEIYA（AI空間設計OS）の公式ブログのSEOライターです。`;

  const prompt = `
${personaBlock}
検索キーワード「${keyword}」で検索したユーザーが「これが知りたかった」と満足する、SEO最適化された記事を日本語で書いてください。

${buildBrandBlock({ mode: "keyword" })}

【検索意図の見極め（最初に必ず行う）】
- 「${keyword}」で検索する人が**何を達成したいか（情報収集 / 手順を知りたい / 比較検討 / 事例探し）**を見極め、その意図に最短で応える構成にする
- 導入の1〜2段落で結論・要旨に触れ、読者が「ここに答えがある」と分かるようにする

【記事の要件】
- 検索意図を満たす実用的な内容にする。キーワード「${keyword}」とその関連語・共起語を、タイトル・見出し・本文に自然に配置する
- タイトル: 32字前後。キーワードをできるだけ前方に含め、クリックされやすく具体的に
- 本文: 1200〜1800字程度の**HTML**。使用可能タグは <h2> <h3> <p> <ul> <li> <ol> <strong> <blockquote> <a> のみ（<h1>・style属性・class・<img>・<script>は使わない）。<a> は上のルールに従い**内部リンク専用**。<h2>見出しを3〜5個使い、**末尾に必ず「SEKKEIYA で試す」CTAの<h2>**を置く。構成は「導入（読者の悩み・検索意図と結論）→ 本論（具体的な手順・比較・ポイント）→ まとめ → CTA」
- E-E-A-T を意識し、根拠のある具体的な記述にする。誇張・虚偽の数値・根拠のない断言は禁止
- カテゴリ: ${category}${note ? `\n- 編集メモ（参考）: ${note}` : ""}
- slug は記事内容を表す英語の kebab-case（小文字・ハイフン区切り、3〜6語）にする

【出力形式（JSONのみ。前後に説明やコードブロックを付けない）】
{"title":"記事タイトル","slug":"english-kebab-case-slug","excerpt":"記事の要約（100字以内）","body":"<h2>...</h2><p>...</p> のHTML本文","tags":["タグ1","タグ2","タグ3"],"seoTitle":"SEOタイトル（60字以内）","seoDescription":"メタdescription（120字以内）"}
`.trim();

  let articleData;
  try {
    const raw = await callLLM(prompt, { provider: textCfg.provider, model: textCfg.model });
    const jsonStr = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    articleData = JSON.parse(jsonStr);
  } catch (e) {
    return { success: false, reason: `Generation/parse failed: ${e.message}` };
  }

  // 下書きから取材（インタビュー）質問＋図解スライドを生成。失敗しても下書きは活かす。
  let interviewQuestions = [];
  let interviewSlide = null;
  try {
    const kit = await generateInterviewQuestions(textCfg, {
      reporter, keyword, category, body: articleData.body || "",
    });
    interviewQuestions = kit.questions || [];
    interviewSlide = kit.slide || null;
  } catch (e) {
    console.warn(`[generateKeywordArticle] interview kit gen failed: ${e.message}`);
  }
  const hasInterview = interviewQuestions.length > 0;

  // カテゴリをハブ+サブに解決（公開フィルタはハブ、SEOの具体性はサブで担保）
  const catPath = await resolveCategoryPath(db, category);

  const col = db.collection("officialArticles");
  const baseSlug = slugify(articleData.slug) || slugify(articleData.seoTitle) || "keyword-article";
  const slug = await uniqueSlug(col, baseSlug);

  const tags = Array.isArray(articleData.tags) && articleData.tags.length
    ? articleData.tags
    : [keyword, "SEKKEIYA"];

  const docData = {
    title:          articleData.title          || keyword,
    slug,
    excerpt:        articleData.excerpt         || "",
    // 内部リンク以外の <a> を除去（ハルシネーションの外部リンク対策）＋ href をパス正規化
    body:           sanitizeInternalLinks(articleData.body || ""),
    contentFormat:  "html",             // 新CMSエディタで編集可能なHTML
    tags,
    tagsLower:      tags.map((t) => String(t).toLowerCase()),
    // 取材質問があれば "interview"(取材待ち)、無ければ従来どおり "review"
    status:         hasInterview ? "interview" : "review",
    source:         "reporter-mode2",  // 生成モード識別（既存互換）
    channel:        "official",        // News ハブの区分（公式/news/community）
    aiDrafted:      true,
    targetKeyword:  keyword,
    featured:       false,
    seoTitle:       articleData.seoTitle       || articleData.title || "",
    seoDescription: articleData.seoDescription || "",
    category:       catPath.category,
    subCategory:    catPath.subCategory,
    author:         reporter
      ? { uid: `reporter:${reporter.id}`, displayName: reporter.displayName || reporter.name }
      : { uid: "system", displayName: "SEKKEIYA Reporter" },
    reporterId:     reporter?.id || null,
    reporterName:   reporter?.displayName || reporter?.name || null,
    interview:      hasInterview ? {
      status: "pending",
      model: "gemini-2.5-flash",
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      questions: interviewQuestions,
      slide: interviewSlide,          // 取材パネルに出す記事の図解スライド（ペライチ）
    } : null,
    coverUrl:       pickCover(keyword),
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: null,
  };

  const ref = await col.add(docData);
  const articleId = ref.id;
  console.log(`[generateKeywordArticle] created: ${slug} (kw="${keyword}", interview=${hasInterview})`);

  // 取材タスク（Schedules & Tasks）＋ 取材通知（ベル/デスクトップ通知）を公式アカウントに作成
  if (hasInterview) {
    try {
      const cfg = (await db.doc("config/official").get()).data() || {};
      const cpid = cfg.contentProjectId;
      const officialUid = cfg.uid;
      const repName = reporter?.displayName || reporter?.name || "記者";
      // 記事の執筆/取材はデスクトップ版 S.Blog（公式ブログモード）へ集約済み。
      // デスクトップは articleId + taskKind:"interview" で「取材を開始」を出すため、url は補助リンク。
      const editUrl = `https://sekkeiya.com/workspace`;

      // (1) ユーザータスク
      if (cpid && officialUid) {
        const taskRef = await db.collection("projects").doc(cpid).collection("tasks").add({
          title: `🎤 取材：${keyword}（${repName}から質問${interviewQuestions.length}件）`,
          description: `記事「${docData.title}」の取材。「取材を開始」から質問に回答すると本文に反映されます。`,
          type: "manual",            // ユーザータスクとして表示（type:'ai' 以外）
          priority: "high",
          status: "todo",
          dueDate: "",
          assigneeUid: officialUid,
          assigneeName: "SEKKEIYA",
          taskKind: "interview",     // デスクトップが「取材を開始」ボタンを出すための目印
          articleId,
          linkUrl: editUrl,
          createdBy: "ai-reporter",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await ref.update({ interviewTaskId: taskRef.id, interviewTaskProjectId: cpid });
        console.log(`[generateKeywordArticle] interview task created in project ${cpid}`);
      } else {
        console.log(`[generateKeywordArticle] config/official.contentProjectId 未設定のため取材タスク作成をスキップ`);
      }

      // (2) 取材通知（ベル + デスクトップ通知）
      if (officialUid) {
        await db.collection("users").doc(officialUid).collection("notifications").add({
          type: "interview_request",
          title: "🎤 取材の依頼",
          message: `「${keyword}」の記事について、${repName}から質問が${interviewQuestions.length}件届いています。`,
          articleId,
          url: editUrl,
          fromName: repName,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[generateKeywordArticle] interview notification created for ${officialUid}`);
      }
    } catch (e) {
      console.warn(`[generateKeywordArticle] interview task/notification failed: ${e.message}`);
    }
  }

  // トピックを更新（取材待ち or レビュー待ち）
  if (topicId) {
    try {
      await db.collection("topicQueue").doc(topicId).update({
        status: hasInterview ? "interview" : "review",
        generatedArticleSlug: slug,
        generatedArticleId: articleId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn(`[generateKeywordArticle] topic update failed: ${e.message}`);
    }
  }

  return {
    success: true,
    action: "created",
    slug,
    articleId,
    title: docData.title,
    reporter: reporter?.displayName || reporter?.name || null,
    interviewQuestions: interviewQuestions.length,
  };
};

/**
 * migrate-rename-slide-model.mjs
 * ブランド改名 S.Presentations→S.Slide / S.Models→S.Model の Firestore データ移行。
 *
 * 対象:
 *   1) categories コレクション … 旧slugのカテゴリ doc の { slug, name } を新値へ更新
 *        s-models        -> { slug: s-model, name: S.Model }
 *        s-presentations -> { slug: s-slide, name: S.Slide }
 *   2) officialArticles / communityArticles … 各記事に非正規化された
 *        category:{slug,name} / subCategory:{slug,name} / categories[] / tags[]
 *      の該当値を新値へ追従。
 *
 * 使い方（sekkeiya/ で実行、serviceAccountKey.json 必須）:
 *   node scripts/migrate-rename-slide-model.mjs            # ドライラン（変更内容を表示のみ）
 *   node scripts/migrate-rename-slide-model.mjs --apply    # 実際に書き込む
 *
 * 冪等: 既に新値のものは変更ゼロ。何度実行しても安全。
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// 旧 → 新（slug / 表示名）
const SLUG_MAP = { 's-models': 's-model', 's-presentations': 's-slide' };
const NAME_MAP = { 'S.Models': 'S.Model', 'S.Presentations': 'S.Slide' };
const ARTICLE_COLLECTIONS = ['officialArticles', 'communityArticles'];

const tag = APPLY ? '[APPLY]' : '[DRY-RUN]';
let catChanges = 0;
let artChanges = 0;

// {slug,name} オブジェクトを新値へ（変わったら true）
function remapCatObj(obj) {
  if (!obj || typeof obj !== 'object') return false;
  let changed = false;
  if (obj.slug && SLUG_MAP[obj.slug]) { obj.slug = SLUG_MAP[obj.slug]; changed = true; }
  if (obj.name && NAME_MAP[obj.name]) { obj.name = NAME_MAP[obj.name]; changed = true; }
  return changed;
}

// ── 1) categories コレクション ──
{
  const snap = await db.collection('categories').get();
  for (const d of snap.docs) {
    const data = d.data();
    if (!SLUG_MAP[data.slug]) continue;
    const next = {
      slug: SLUG_MAP[data.slug],
      name: NAME_MAP[data.name] || data.name,
      updatedAt: FieldValue.serverTimestamp(),
    };
    console.log(`${tag} categories/${d.id}: slug ${data.slug}->${next.slug}, name ${data.name}->${next.name}`);
    catChanges++;
    if (APPLY) await d.ref.update(next);
  }
}

// ── 2) 記事コレクション ──
for (const col of ARTICLE_COLLECTIONS) {
  let snap;
  try {
    snap = await db.collection(col).get();
  } catch (e) {
    console.log(`${tag} (skip) collection ${col}: ${e.message}`);
    continue;
  }
  for (const d of snap.docs) {
    const data = d.data();
    const patch = {};
    let changed = false;

    // category / subCategory（{slug,name} オブジェクト）
    for (const field of ['category', 'subCategory']) {
      if (data[field] && typeof data[field] === 'object') {
        const clone = { ...data[field] };
        if (remapCatObj(clone)) { patch[field] = clone; changed = true; }
      }
    }

    // categories[]（{slug,name} or 文字列の配列）
    if (Array.isArray(data.categories)) {
      let arrChanged = false;
      const next = data.categories.map((c) => {
        if (typeof c === 'string') {
          if (NAME_MAP[c]) { arrChanged = true; return NAME_MAP[c]; }
          return c;
        }
        const clone = { ...c };
        if (remapCatObj(clone)) { arrChanged = true; return clone; }
        return c;
      });
      if (arrChanged) { patch.categories = next; changed = true; }
    }

    // tags[]（表示名の文字列配列）
    if (Array.isArray(data.tags)) {
      let tagChanged = false;
      const next = data.tags.map((t) => {
        if (NAME_MAP[t]) { tagChanged = true; return NAME_MAP[t]; }
        return t;
      });
      if (tagChanged) { patch.tags = next; changed = true; }
    }

    if (changed) {
      const summary = Object.keys(patch).join(', ');
      console.log(`${tag} ${col}/${d.id}: updated { ${summary} }`);
      artChanges++;
      if (APPLY) await d.ref.update(patch);
    }
  }
}

console.log('----');
console.log(`${tag} categories changed: ${catChanges}, articles changed: ${artChanges}`);
if (!APPLY) console.log('ドライランです。実際に書き込むには --apply を付けて再実行してください。');
process.exit(0);

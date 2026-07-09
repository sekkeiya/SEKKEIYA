import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('apply');

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'serviceAccountKey.json'), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const COL = 'officialArticles';

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const toLowerArray = (arr) => Array.isArray(arr) ? arr.map(s => String(s).toLowerCase()).filter(Boolean) : [];

console.log(APPLY ? '=== APPLY MODE (writing to production) ===' : '=== DRY RUN (no writes) ===');

for (const item of manifest.keep) {
  const ref = db.doc(`${COL}/${item.id}`);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`[SKIP] ${item.id} not found`); continue; }
  const cur = snap.data();
  const body = fs.readFileSync(path.join(__dirname, item.bodyFile), 'utf8');

  const patch = {
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    body,
    contentFormat: 'html',
    category: item.category,
    subCategory: null,
    tags: item.tags,
    tagsLower: toLowerArray(item.tags),
    status: 'published',
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!cur.publishedAt) patch.publishedAt = FieldValue.serverTimestamp();

  console.log(`[UPDATE] ${item.id}  cat=${item.category.name}  slug=${item.slug}  body=${body.length}b  title="${item.title}"`);
  if (APPLY) await ref.update(patch);
}

for (const id of manifest.delete) {
  const ref = db.doc(`${COL}/${id}`);
  const snap = await ref.get();
  if (!snap.exists) { console.log(`[DEL-SKIP] ${id} not found`); continue; }
  console.log(`[DELETE] ${id}  "${snap.data().title}"`);
  if (APPLY) await ref.delete();
}

console.log(APPLY ? '=== DONE (applied) ===' : '=== DRY RUN complete. Re-run with "apply" to write. ===');
process.exit(0);

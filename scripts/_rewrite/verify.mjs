import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Mimic fetchPublishedArticles: where status==published, orderBy publishedAt desc
const snap = await db.collection('officialArticles')
  .where('status','==','published')
  .orderBy('publishedAt','desc')
  .get();

const CATS = ['AI News','SEKKEIYA','S.Models','S.Layout','S.Presentations','Desktop','Workflow','Tips / Learn'];
const rows = [];
const byCat = {};
let htmlCount = 0, withExcerpt = 0;
snap.forEach(d => {
  const a = d.data();
  rows.push({ name: a.category?.name, fmt: a.contentFormat, slug: a.slug, title: a.title });
  byCat[a.category?.name] = (byCat[a.category?.name]||0)+1;
  if (a.contentFormat === 'html') htmlCount++;
  if ((a.excerpt||'').length > 0) withExcerpt++;
});

console.log('PUBLIC published count (shows under すべて):', rows.length);
console.log('contentFormat=html:', htmlCount, ' / withExcerpt:', withExcerpt);
console.log('\nCategory distribution (filter chips):');
for (const c of CATS) console.log(`  ${c.padEnd(16)} : ${byCat[c]||0}`);
const unknown = Object.keys(byCat).filter(k => !CATS.includes(k));
console.log('  (uncategorized/other):', unknown.length ? unknown : 'none');
console.log('\nList:');
rows.forEach(r => console.log(`  [${(r.name||'-').padEnd(14)}] ${r.fmt}  ${r.slug}`));
process.exit(0);

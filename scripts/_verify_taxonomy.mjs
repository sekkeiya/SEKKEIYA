import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const cats = (await db.collection('categories').get()).docs.map(d=>d.data());
const tops = cats.filter(c=>!c.parent).sort((a,b)=>a.order-b.order);
console.log('CATEGORIES:', cats.length, `(hubs ${tops.length})`);
for (const t of tops) {
  const subs = cats.filter(c=>c.parent===t.slug).sort((a,b)=>a.order-b.order);
  console.log(`■ ${t.name} [${t.slug}]`);
  subs.forEach(s=>console.log(`    ・${s.name} [${s.slug}]`));
}

const arts = (await db.collection('officialArticles').where('status','==','published').get()).docs.map(d=>d.data());
console.log('\nPUBLISHED ARTICLES by hub category:');
const byHub = {};
arts.forEach(a=>{ const k=a.category?.name||'-'; byHub[k]=(byHub[k]||0)+1; });
Object.entries(byHub).forEach(([k,v])=>console.log(`  ${k}: ${v}`));
console.log('\nsample article cat/sub:');
arts.slice(0,3).forEach(a=>console.log(`  "${a.slug}" cat=${a.category?.name} / sub=${a.subCategory?.name||'-'}`));
process.exit(0);

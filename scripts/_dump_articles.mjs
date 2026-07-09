import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('officialArticles').orderBy('updatedAt','desc').get();
const out = [];
snap.forEach(d => {
  const x = d.data();
  out.push({
    id: d.id,
    title: x.title,
    slug: x.slug,
    status: x.status,
    contentFormat: x.contentFormat || '(none)',
    category: x.category || null,
    subCategory: x.subCategory || null,
    tags: x.tags || [],
    featured: !!x.featured,
    hasPublishedAt: !!x.publishedAt,
    publishedAt: x.publishedAt ? x.publishedAt.toDate().toISOString() : null,
    excerptLen: (x.excerpt||'').length,
    bodyLen: (x.body||'').length,
    coverUrl: x.coverUrl || '',
  });
});
console.log('TOTAL', out.length);
console.log(JSON.stringify(out, null, 2));
process.exit(0);

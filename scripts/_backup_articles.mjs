import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('officialArticles').orderBy('updatedAt','desc').get();
const out = [];
snap.forEach(d => out.push({ id: d.id, ...d.data() }));

// Convert Timestamps to ISO for readability backup
const serial = out.map(a => ({
  ...a,
  createdAt: a.createdAt?.toDate?.().toISOString?.() || null,
  updatedAt: a.updatedAt?.toDate?.().toISOString?.() || null,
  publishedAt: a.publishedAt?.toDate?.().toISOString?.() || null,
}));

const stamp = '20260701';
const backupPath = `./scripts/officialArticles.backup.${stamp}.json`;
fs.writeFileSync(backupPath, JSON.stringify(serial, null, 2), 'utf8');
console.log('BACKUP_WRITTEN', backupPath, 'count=', out.length);

// Also write full bodies to scratchpad for reading
const scratch = 'C:/Users/yumat/AppData/Local/Temp/claude/C--Users-sekkeiya-02-WebApp-040-sekkeiya/88f4a6f3-6e52-4b62-8ddf-5bb7ebc2bb3f/scratchpad';
fs.writeFileSync(scratch + '/all_bodies.json', JSON.stringify(serial.map(a=>({id:a.id,title:a.title,slug:a.slug,category:a.category,excerpt:a.excerpt,body:a.body})), null, 2), 'utf8');
console.log('SCRATCH_WRITTEN');
process.exit(0);

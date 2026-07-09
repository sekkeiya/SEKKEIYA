import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const DEFAULTS = [
  { name: "AI News",         slug: "ai-news",         description: "建築・設計×AIの最新ニュース",   order: 1 },
  { name: "SEKKEIYA",        slug: "sekkeiya",        description: "SEKKEIYA全般・思想・お知らせ",   order: 2 },
  { name: "S.Model",        slug: "s-model",        description: "3Dモデルの管理・共有・プレビュー", order: 3 },
  { name: "S.Layout",        slug: "s-layout",        description: "空間レイアウト・自動配置",       order: 4 },
  { name: "S.Slide", slug: "s-slide", description: "歩ける3Dプレゼン",              order: 5 },
  { name: "Desktop",         slug: "desktop",         description: "デスクトップアプリ・開発",       order: 6 },
  { name: "Workflow",        slug: "workflow",        description: "制作ワークフロー・Rhino連携",    order: 7 },
  { name: "Tips / Learn",    slug: "tips-learn",      description: "ノウハウ・使い方・学習",         order: 8 },
  { name: "トレンド",         slug: "trend",           description: "週次トレンド（内部集計）",       order: 9 },
];

const snap = await db.collection('categories').get();
const names = new Set(snap.docs.map(d => d.data().name));
let n = 0;
for (const c of DEFAULTS) {
  if (names.has(c.name)) continue;
  await db.collection('categories').add({ ...c, active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  n++;
}
console.log(`categories seeded: +${n} (existing ${snap.size})`);
const after = await db.collection('categories').get();
console.log('total categories:', after.size, '=>', after.docs.map(d=>d.data().name).join(', '));
process.exit(0);

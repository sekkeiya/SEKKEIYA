import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const UID = 'qFpjY03XXPdCU49WWKLGWWX4zAz2';

// 1) channel:'official' を公開記事に付与（News ハブ区分の土台）
const snap = await db.collection('officialArticles').where('status','==','published').get();
let n = 0;
for (const d of snap.docs) {
  if (d.data().channel !== 'official') { await d.ref.update({ channel: 'official' }); n++; }
}
console.log(`[1] channel='official' set on ${n} / ${snap.size} published articles`);

// 2) 公式コンテンツ用プロジェクト（取材タスクの置き場）。冪等。
const cfgRef = db.doc('config/official');
let cfg = (await cfgRef.get()).data() || {};
let cpid = cfg.contentProjectId;
let exists = false;
if (cpid) { exists = (await db.collection('projects').doc(cpid).get()).exists; }
if (!cpid || !exists) {
  const ref = db.collection('projects').doc();
  await ref.set({
    name: 'SEKKEIYA Content',
    visibility: 'public',
    ownerId: UID,
    ownerName: 'SEKKEIYA',
    roles: { [UID]: 'owner' },
    memberIds: [UID],
    isTeam: false,
    sourceApp: 'cms',
    schemaVersion: 2,
    itemCount: 0,
    coverThumbnailUrl: null,
    coverItemId: null,
    lastActivityAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  cpid = ref.id;
  console.log(`[2] created content project: ${cpid}`);
} else {
  console.log(`[2] reuse existing content project: ${cpid}`);
}

// 3) config/official に紐付け
await cfgRef.set({ contentProjectId: cpid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
const after = (await cfgRef.get()).data();
console.log('[3] config/official =>', JSON.stringify({ uid: after.uid, email: after.email, contentProjectId: after.contentProjectId }));
process.exit(0);

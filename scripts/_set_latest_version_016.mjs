import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

await db.doc('appGlobalConfig/latestVersion').set({
  version: '0.1.6',
  releaseNotes: 'S.Blog「AIと議論して書く」を追加。AI記者の取材通知（取材を開始ボタン・デスクトップ通知）、サイトビルダーの安定性修正など。',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
const after = (await db.doc('appGlobalConfig/latestVersion').get()).data();
console.log('latestVersion =>', JSON.stringify({ version: after.version, releaseNotes: after.releaseNotes }));
process.exit(0);

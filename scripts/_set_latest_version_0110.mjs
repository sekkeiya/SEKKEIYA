import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

await db.doc('appGlobalConfig/latestVersion').set({
  version: '0.1.10',
  releaseNotes: 'S.Blogに新ホーム: おすすめ建築・インテリアメディアの最新記事フィードを追加。気になる記事を読みながらAIと議論し、その議論を踏まえてAIがあなたの記事を生成します（議論ファースト）。旧ホームは「記事一覧」に名称変更。',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
const after = (await db.doc('appGlobalConfig/latestVersion').get()).data();
console.log('latestVersion =>', JSON.stringify({ version: after.version, releaseNotes: after.releaseNotes }));
process.exit(0);

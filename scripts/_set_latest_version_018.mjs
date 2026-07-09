import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

await db.doc('appGlobalConfig/latestVersion').set({
  version: '0.1.8',
  releaseNotes: 'S.Blog: ✨デザイン（記事全体をスタイルに沿って整形+図解/AI画像を統一デザインで挿入）と🎨スタイル設定（プリセット/アクセント色/署名）を追加。公開記事は sekkeiya.com/articles「みんなの記事」にも掲載されます。',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
const after = (await db.doc('appGlobalConfig/latestVersion').get()).data();
console.log('latestVersion =>', JSON.stringify({ version: after.version, releaseNotes: after.releaseNotes }));
process.exit(0);

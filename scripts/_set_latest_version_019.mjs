import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

await db.doc('appGlobalConfig/latestVersion').set({
  version: '0.1.9',
  releaseNotes: 'S.Blogの「AIで書く」に、おすすめの建築・インテリアメディア（architecturephoto/Casa BRUTUS/dezeen 等）から最新記事を題材に選ぶ機能を追加。選んだ題材はS.Libraryにも保存できます。',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
const after = (await db.doc('appGlobalConfig/latestVersion').get()).data();
console.log('latestVersion =>', JSON.stringify({ version: after.version, releaseNotes: after.releaseNotes }));
process.exit(0);

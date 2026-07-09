import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

await db.doc('appGlobalConfig/latestVersion').set({
  version: '0.1.11',
  releaseNotes: 'SEKKEIYA Chat に読み上げ機能を追加。AIの応答を音声で聞きながら設計を進められます（音声モードのON/OFF、メッセージ単位の読み上げ、読み上げ中の文ハイライト＋クリックでその文から再生、本文をAlt+クリックでその文から読み上げ、速度・声の設定）。S.Blogの記事読み上げと共通化し、「対話で設計する」体験を一歩前進させました。',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
const after = (await db.doc('appGlobalConfig/latestVersion').get()).data();
console.log('latestVersion =>', JSON.stringify({ version: after.version, releaseNotes: after.releaseNotes }));
process.exit(0);

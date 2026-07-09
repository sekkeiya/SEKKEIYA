// 本番 suggestNextActions を認証付きで直接検証する
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(sa) });

const WEB_API_KEY = 'AIzaSyB1q5bTAaBIJb1Ug0Tqqb_hSNH7Vo2B2CY';
const customToken = await getAuth().createCustomToken('cf-verify-test-uid');
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: customToken, returnSecureToken: true }),
});
const { idToken } = await signIn.json();
if (!idToken) { console.error('sign-in failed', await signIn.text?.()); process.exit(1); }

const digest = `## カフェ計画の相談（7/4・全6件）
- You: カフェのレイアウトを検討したい。南面採光を優先して、30席を確保するプランを考えて。
- AI: 南面に大開口を設けたプランを3案作成しました。案Aは窓際カウンター12席+テーブル18席で回遊動線を確保しています。
- You: 案Aで進めたい。厨房の位置はどうする？
- AI: 厨房は北側に配置し、提供動線を最短化する案を提案しました。次はプレゼン資料の構成に進めます。`;

const t0 = Date.now();
const res = await fetch('https://us-central1-shapeshare3d.cloudfunctions.net/suggestNextActions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
  body: JSON.stringify({ data: { projectName: 'カフェ新築計画', digest } }),
});
const json = await res.json();
console.log('status:', res.status, 'took:', Date.now() - t0, 'ms');
console.log(JSON.stringify(json, null, 2));

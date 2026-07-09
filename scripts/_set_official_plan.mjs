import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const auth = getAuth(); const db = getFirestore();

const UID = 'qFpjY03XXPdCU49WWKLGWWX4zAz2';
const EMAIL = 'hello@sekkeiya.com';
const NEW_PW = 'sekkeiya1004';
const API_KEY = 'AIzaSyCA__knGwVCSAPN5j5vTYx0iDx0b169Qpk';

// 1) Plan = official + bypass all AI provider quotas (server-side unlimited)
await db.collection('users').doc(UID).set({
  plan: 'official',
  customAiLimits: { tripo3d: true, triposr: true, mock: true, nanobanana: true },
  planUpdatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
const u = (await db.collection('users').doc(UID).get()).data();
console.log('[1] users/'+UID+' => plan:', u.plan, '| customAiLimits:', JSON.stringify(u.customAiLimits));

// 2) Password change
await auth.updateUser(UID, { password: NEW_PW });
console.log('[2] password updated');

// 3) Verify login via REST
const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: NEW_PW, returnSecureToken: true }),
});
const data = await res.json();
console.log(data.idToken ? `[3] ✅ LOGIN VERIFIED (uid ${data.localId})` : `[3] ❌ ${JSON.stringify(data.error||data)}`);
process.exit(0);

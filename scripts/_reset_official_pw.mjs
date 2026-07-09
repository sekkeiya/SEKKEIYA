import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const auth = getAuth();

const UID = 'qFpjY03XXPdCU49WWKLGWWX4zAz2';
const EMAIL = 'hello@sekkeiya.com';
const API_KEY = 'AIzaSyCA__knGwVCSAPN5j5vTYx0iDx0b169Qpk';
const NEW_PW = 'Sekkeiya#Hello2026';   // 紛らわしい文字なし

// 1) set clean password + ensure enabled/verified/password-provider
await auth.updateUser(UID, { password: NEW_PW, emailVerified: true, disabled: false });
const u = await auth.getUser(UID);
console.log('updated:', u.email, '| providers:', u.providerData.map(p=>p.providerId).join(',')||'password', '| disabled:', u.disabled);

// 2) verify by actually signing in via Identity Toolkit REST
const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: NEW_PW, returnSecureToken: true }),
});
const data = await res.json();
if (data.idToken) {
  console.log('\n✅ LOGIN VERIFIED via REST. email:', data.email, '| localId:', data.localId);
  console.log('   uid matches:', data.localId === UID);
} else {
  console.log('\n❌ LOGIN FAILED:', JSON.stringify(data.error || data));
}
console.log('\nNEW PASSWORD =>', NEW_PW);
process.exit(0);

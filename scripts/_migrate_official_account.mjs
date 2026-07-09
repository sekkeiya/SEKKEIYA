import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import fs from 'fs';

const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();

const UID = 'qFpjY03XXPdCU49WWKLGWWX4zAz2';
const NEW_EMAIL = 'hello@sekkeiya.com';
const OLD_AUTHOR_UID = 'dZLeURsXfIctrwkOBWUf7kiTJYV2';
const APPLY = process.argv.includes('apply');

// 0) Backup current auth user
const before = await auth.getUser(UID);
const backup = {
  uid: before.uid, email: before.email, emailVerified: before.emailVerified,
  displayName: before.displayName,
  providers: before.providerData.map(p => ({ providerId: p.providerId, uid: p.uid, email: p.email })),
  capturedAt: new Date().toISOString(),
};
fs.writeFileSync('./scripts/auth_official.backup.json', JSON.stringify(backup, null, 2));
console.log('BACKUP auth user =>', JSON.stringify(backup));

if (!APPLY) { console.log('\n=== DRY RUN (add "apply") ==='); process.exit(0); }

// 1) Migrate: email -> hello@, set temp password, unlink google.com
const tempPass = 'Sk!' + crypto.randomBytes(12).toString('base64url');
await auth.updateUser(UID, {
  email: NEW_EMAIL,
  emailVerified: true,
  password: tempPass,
  providersToUnlink: ['google.com'],
});
const after = await auth.getUser(UID);
console.log('\n[1] AUTH updated:');
console.log('    email     :', after.email);
console.log('    providers :', after.providerData.map(p=>p.providerId).join(', ') || '(none = password only)');

// 2) Register official account config
await db.doc('config/official').set({
  uid: UID, email: NEW_EMAIL, displayName: 'SEKKEIYA', updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
console.log('[2] config/official set:', UID, NEW_EMAIL);

// 3) Reassign published articles' author -> official (no timestamp change to keep order)
const snap = await db.collection('officialArticles').where('status','==','published').get();
let n = 0;
for (const d of snap.docs) {
  await d.ref.update({ author: { uid: UID, displayName: 'SEKKEIYA' } });
  n++;
}
console.log(`[3] reassigned author on ${n} published articles -> ${UID} (SEKKEIYA)`);

// 4) Password reset link (user sets their own long-term password)
const link = await auth.generatePasswordResetLink(NEW_EMAIL);
console.log('\n[4] PASSWORD RESET LINK (share w/ owner, expires):');
console.log(link);
console.log('\n(fallback temp password, change immediately):', tempPass);
console.log('\n=== DONE ===');
process.exit(0);

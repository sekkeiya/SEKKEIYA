import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const auth = getAuth();

async function show(email){
  try {
    const u = await auth.getUserByEmail(email);
    console.log(`\n[FOUND] ${email}`);
    console.log('  uid       :', u.uid);
    console.log('  providers :', u.providerData.map(p=>p.providerId).join(', ') || '(none)');
    console.log('  emailVerified:', u.emailVerified, ' disabled:', u.disabled);
    console.log('  displayName:', u.displayName || '(none)');
  } catch(e){
    console.log(`\n[NOT FOUND] ${email} -> ${e.code || e.message}`);
  }
}
await show('s.sekkeiya@gmail.com');
await show('hello@sekkeiya.com');
console.log('\n(参考) 記事の author uid は storage パスより dZLeURsXfIctrwkOBWUf7kiTJYV2');
process.exit(0);

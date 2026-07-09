import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const auth = getAuth(); const db = getFirestore();

const u = await auth.getUserByEmail('hello@sekkeiya.com');
console.log('AUTH hello@sekkeiya.com => uid', u.uid, '| providers', u.providerData.map(p=>p.providerId).join(',')||'password', '| verified', u.emailVerified);
try { await auth.getUserByEmail('s.sekkeiya@gmail.com'); console.log('OLD s.sekkeiya still resolvable (unexpected)'); }
catch(e){ console.log('OLD s.sekkeiya@gmail.com =>', e.code, '(expected: no longer a login email)'); }

const cfg = (await db.doc('config/official').get()).data();
console.log('config/official =>', JSON.stringify({uid:cfg.uid,email:cfg.email,displayName:cfg.displayName}));

const snap = await db.collection('officialArticles').where('status','==','published').get();
const authors = new Set(); snap.forEach(d=>authors.add(JSON.stringify(d.data().author)));
console.log('published articles:', snap.size, '| distinct authors:', [...authors].join(' '));
process.exit(0);

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json','utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const id = 'KO3iR4eZor0hippVm79Z';
const a = (await db.collection('officialArticles').doc(id).get()).data();
const body = a?.body || '';
const figs = (body.match(/<figure/g)||[]).length;
const imgs = (body.match(/<img/g)||[]).length;
const svgs = (body.match(/\.svg/g)||[]).length;
console.log('bodyLen', body.length, '| <figure>', figs, '| <img>', imgs, '| .svg refs', svgs);
// show first figure snippet
const m = body.match(/<figure[\s\S]{0,300}/);
console.log('\nfirst figure snippet:\n', m ? m[0] : '(none)');
process.exit(0);

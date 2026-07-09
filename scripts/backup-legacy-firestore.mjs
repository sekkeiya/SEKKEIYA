import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyPath = path.resolve(__dirname, '../../../shapeshare3d-admin.json');

if (!fs.existsSync(keyPath)) {
  console.error("Credentials not found at", keyPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Helper to serialize Firestore types
function serializeFirestoreData(obj) {
  if (!obj) return obj;
  if (typeof obj.toDate === 'function') {
    return { _type: 'timestamp', iso: obj.toDate().toISOString() };
  }
  if (obj.path && typeof obj.isEqual === 'function') {
    return { _type: 'reference', path: obj.path };
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeFirestoreData);
  }
  if (typeof obj === 'object') {
    const res = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        res[key] = serializeFirestoreData(obj[key]);
      }
    }
    return res;
  }
  return obj;
}

async function run() {
  const rootCollections = ['teamBoards', 'teamBoardInvitations', 'layoutShares', 'viewerShares', 'articles', 'boards'];
  const data = {};

  for (const col of rootCollections) {
    console.log(`Fetching root collection: ${col}`);
    const snap = await db.collection(col).get();
    data[col] = {};
    snap.forEach(doc => {
      data[col][doc.id] = serializeFirestoreData(doc.data());
    });
    console.log(` -> Copied ${snap.size} documents.`);
  }

  const subColGroups = ['myBoards', 'teamBoards'];
  for (const group of subColGroups) {
    console.log(`Fetching subcollection group: ${group}`);
    const snap = await db.collectionGroup(group).get();
    data[`group_${group}`] = {};
    snap.forEach(doc => {
      data[`group_${group}`][doc.ref.path] = serializeFirestoreData(doc.data());
    });
    console.log(` -> Copied ${snap.size} documents.`);
  }

  const outPath = path.resolve(__dirname, 'backup_2026_legacy_collections.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\nAll done! Saved to ${outPath}`);
}

run().catch(console.error);

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

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function deleteCollectionGroup(db, collectionId, batchSize) {
  const query = db.collectionGroup(collectionId).limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);
  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function runDeletion() {
  const BATCH_SIZE = 500;
  
  // 1. Delete collectionGroups first
  const collectionGroups = ['myBoards', 'teamBoards'];
  for (const group of collectionGroups) {
    console.log(`Deleting collection group: ${group}...`);
    try {
      await deleteCollectionGroup(db, group, BATCH_SIZE);
      console.log(`✅ successfully deleted subcollections: ${group}`);
    } catch (e) {
      console.error(`💥 Failed to delete ${group}:`, e);
    }
  }

  // 2. Delete root collections
  const rootCollections = ['teamBoards', 'teamBoardInvitations', 'layoutShares', 'viewerShares', 'articles'];
  for (const col of rootCollections) {
    console.log(`Deleting root collection: ${col}...`);
    try {
      await deleteCollection(db, col, BATCH_SIZE);
      console.log(`✅ successfully deleted root collection: ${col}`);
    } catch (e) {
      console.error(`💥 Failed to delete ${col}:`, e);
    }
  }
  
  // Create log
  const logPath = path.resolve(__dirname, `deletion_log_${Date.now()}.txt`);
  fs.writeFileSync(logPath, `Deletion executed on ${new Date().toISOString()}.\nTargets: ${collectionGroups.join(', ')} (groups) and ${rootCollections.join(', ')} (roots).`);
  console.log(`\nAll done. Log saved to ${logPath}`);
}

runDeletion().catch(console.error);

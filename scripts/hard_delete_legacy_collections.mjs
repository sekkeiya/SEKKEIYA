import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_ROOTS = [
  'boards',
  'teamBoards',
  'teamBoardInvitations',
  'layoutShares',
  'viewerShares',
  'articles'
];

async function initFirebase() {
  let serviceAccount;
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    console.log("Using GOOGLE_APPLICATION_CREDENTIALS");
  } else {
    const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
    if(fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      console.log("Using local serviceAccountKey.json");
    }
  }
  
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    console.log("No credentials found. Trying Application Default Credentials...");
    initializeApp({ projectId: 'demo-sekkeiya' });
  }
  
  return getFirestore();
}

async function runHardDelete() {
  console.log("Starting LEGACY HARD DELETE...");
  const db = await initFirebase();
  const reportLog = [];
  reportLog.push(`# Firestore Legacy Purge Report\n`);
  reportLog.push(`**Timestamp**: ${new Date().toISOString()}\n\n`);
  
  // 1. Root collections
  for (const colName of TARGET_ROOTS) {
    console.log(`Starting recursive delete for collection: ${colName}...`);
    try {
      const colRef = db.collection(colName);
      // Verify if collection has anything
      const snapshot = await colRef.limit(1).get();
      if (snapshot.empty) {
         console.log(`  -> Skipped (Empty or not found)`);
         reportLog.push(`- \`${colName}\`: 0 documents (Skipped)`);
         continue;
      }
      
      await db.recursiveDelete(colRef);
      console.log(`  -> ✅ Successfully deleted ${colName}`);
      reportLog.push(`- \`${colName}\`: **Deleted Successfully**`);
    } catch (e) {
      console.error(`  -> 💥 Failed to delete ${colName}:`, e.message);
      reportLog.push(`- \`${colName}\`: **FAILED** (${e.message})`);
    }
  }

  // 2. User subcollections
  console.log(`Starting recursive delete for users/{uid}/myBoards and teamBoards...`);
  reportLog.push(`\n## User Subcollections\n`);
  let userMyBoardsDeletedCount = 0;
  let userTeamBoardsDeletedCount = 0;

  try {
    const usersSnap = await db.collection('users').get();
    for (const doc of usersSnap.docs) {
      const myBoardsRef = doc.ref.collection('myBoards');
      const mbSnap = await myBoardsRef.limit(1).get();
      if (!mbSnap.empty) {
        await db.recursiveDelete(myBoardsRef);
        userMyBoardsDeletedCount++;
      }

      const teamBoardsRef = doc.ref.collection('teamBoards');
      const tbSnap = await teamBoardsRef.limit(1).get();
      if (!tbSnap.empty) {
        await db.recursiveDelete(teamBoardsRef);
        userTeamBoardsDeletedCount++;
      }
    }
    console.log(`  -> ✅ Deleted myBoards under ${userMyBoardsDeletedCount} users`);
    console.log(`  -> ✅ Deleted teamBoards under ${userTeamBoardsDeletedCount} users`);
    reportLog.push(`- \`users/{uid}/myBoards\`: **Deleted Successfully** under ${userMyBoardsDeletedCount} user(s)`);
    reportLog.push(`- \`users/{uid}/teamBoards\`: **Deleted Successfully** under ${userTeamBoardsDeletedCount} user(s)`);
  } catch(e) {
    console.error(`  -> 💥 Failed deleting user subcollections:`, e.message);
    reportLog.push(`- User subcollections delete **FAILED** (${e.message})`);
  }

  // Generate Report
  const reportPath = 'C:\\Users\\yumat\\.gemini\\antigravity\\brain\\cf849ae7-2661-4057-9d95-d7d66735e43c\\firestore_legacy_purge_report.md';
  fs.writeFileSync(reportPath, reportLog.join('\n'));
  console.log(`\nAll done! Purge report saved to: ${reportPath}`);
}

runHardDelete().catch(console.error);

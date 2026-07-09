import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGETS = [
  'boards',
  'teamBoards',
  'teamBoardInvitations',
  'layoutShares',
  'viewerShares',
  'articles'
  // ユーザー配下は別処理
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
    console.log("No credentials found. Trying Application Default Credentials (Emulator might be active if FIRESTORE_EMULATOR_HOST is set)...");
    initializeApp({ projectId: 'demo-sekkeiya' });
  }
  
  return getFirestore();
}

async function fetchAllSubcollections(docRef, backupDb, stats) {
  const subcols = await docRef.listCollections();
  for (const subcol of subcols) {
    const subDocs = await subcol.get();
    if (!subDocs.empty) {
      backupDb[subcol.id] = {};
      for (const subDoc of subDocs.docs) {
        backupDb[subcol.id][subDoc.id] = subDoc.data();
        stats.totalDocs++;
        stats.collections[subcol.id] = (stats.collections[subcol.id] || 0) + 1;
        await fetchAllSubcollections(subDoc.ref, backupDb[subcol.id][subDoc.id], stats);
      }
    }
  }
}

async function exportLegacy() {
  console.log("Starting Legacy Export & Dry Run...");
  const db = await initFirebase();
  const backup = {};
  const stats = { totalDocs: 0, collections: {} };

  // 1. Root collections
  for (const colName of TARGETS) {
    console.log(`Exporting completely: ${colName}...`);
    const snap = await db.collection(colName).get();
    if (snap.empty) {
      console.log(`  -> Empty or not found.`);
      continue;
    }
    backup[colName] = {};
    for (const doc of snap.docs) {
      backup[colName][doc.id] = doc.data();
      stats.totalDocs++;
      stats.collections[colName] = (stats.collections[colName] || 0) + 1;
      await fetchAllSubcollections(doc.ref, backup[colName][doc.id], stats);
    }
  }

  // 2. User subcollections (myBoards, teamBoards)
  console.log(`Exporting users/{uid}/myBoards and teamBoards...`);
  const usersSnap = await db.collection('users').get();
  backup['users'] = {};
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    let userHasLegacy = false;
    
    for (const subName of ['myBoards', 'teamBoards']) {
      const subSnap = await userDoc.ref.collection(subName).get();
      if (!subSnap.empty) {
        if (!backup['users'][uid]) backup['users'][uid] = {};
        backup['users'][uid][subName] = {};
        for (const subDoc of subSnap.docs) {
          backup['users'][uid][subName][subDoc.id] = subDoc.data();
          stats.totalDocs++;
          const key = `users/{uid}/${subName}`;
          stats.collections[key] = (stats.collections[key] || 0) + 1;
          
          await fetchAllSubcollections(subDoc.ref, backup['users'][uid][subName][subDoc.id], stats);
        }
      }
    }
  }

  // Save JSON
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(__dirname, `firebase-legacy-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  
  console.log(`\nExport complete! Backed up ${stats.totalDocs} documents to ${backupPath}.`);
  console.dir(stats.collections);

  // Generate Markdown Report
  const reportPath = 'C:\\Users\\yumat\\.gemini\\antigravity\\brain\\cf849ae7-2661-4057-9d95-d7d66735e43c\\firestore_pre_reset_backup_report.md';
  let md = `# Firestore Pre-Reset Backup & Deletion Dry Run Report\n\n`;
  md += `**Timestamp**: ${new Date().toISOString()}\n`;
  md += `**Total Documents Backed Up (and targeting for deletion)**: ${stats.totalDocs}\n\n`;
  md += `## Collection Breakdown\n\n`;
  md += `| Collection Path | Document Count |\n`;
  md += `|---|---|\n`;
  for (const [col, count] of Object.entries(stats.collections)) {
    md += `| \`${col}\` | ${count} |\n`;
  }
  md += `\n## Backup Location\n`;
  md += `Saved locally to: \`${backupPath}\`\n`;
  fs.writeFileSync(reportPath, md);
  console.log(`Report generated at: ${reportPath}`);
}

exportLegacy().catch(console.error);

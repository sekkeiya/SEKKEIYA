import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKSPACE_DEFAULTS = [
  { id: 'main', data: { name: 'Main', appScope: 'sekkeiya', workspaceType: 'main', order: 0 } },
  { id: 'layout', data: { name: 'Layout', appScope: '3dsl', workspaceType: 'layout', order: 1 } },
  { id: 'presents', data: { name: 'Presents', appScope: '3dsp', workspaceType: 'presents', order: 2 } },
  { id: 'create', data: { name: 'Create', appScope: '3dsc', workspaceType: 'create', order: 3 } }
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

async function runBootstrap() {
  console.log("Starting Workspace Bootstrap...");
  const db = await initFirebase();
  
  const stats = { projectsScanned: 0, workspacesCreated: 0 };
  const projectsSnap = await db.collection('projects').get();
  
  stats.projectsScanned = projectsSnap.size;

  for (const projectDoc of projectsSnap.docs) {
    const defaultBatch = db.batch();
    let hasWrites = false;
    
    // Check existing workspaces
    const wsSnap = await projectDoc.ref.collection('workspaces').get();
    const existingIds = new Set(wsSnap.docs.map(d => d.id));
    
    for (const wsDef of WORKSPACE_DEFAULTS) {
      if (!existingIds.has(wsDef.id)) {
        const wsRef = projectDoc.ref.collection('workspaces').doc(wsDef.id);
        const payload = {
          ...wsDef.data,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        };
        defaultBatch.set(wsRef, payload);
        hasWrites = true;
        stats.workspacesCreated++;
      }
    }
    
    if (hasWrites) {
      await defaultBatch.commit();
      console.log(`✅ Bootstrapped workspaces for Project ${projectDoc.id}`);
    }
  }

  // Generate Report
  const reportPath = 'C:\\Users\\yumat\\.gemini\\antigravity\\brain\\cf849ae7-2661-4057-9d95-d7d66735e43c\\workspace_bootstrap_report.md';
  const reportLog = `# Workspace Bootstrap Report\n\n**Timestamp**: ${new Date().toISOString()}\n- Projects Scanned: ${stats.projectsScanned}\n- Missing Workspaces Created: ${stats.workspacesCreated}\n`;
  fs.writeFileSync(reportPath, reportLog);
  console.log(`\nBootstrap complete! Report saved to: ${reportPath}`);
}

runBootstrap().catch(console.error);

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initFirebase() {
  let serviceAccount;
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  } else {
    const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
    if(fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    }
  }
  
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
    console.log("Initialized with service account.");
  } else {
    console.log("No GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json found. Trying Application Default Credentials...");
    initializeApp({ projectId: 'sekkeiya-60d77' });
  }
  
  return getFirestore();
}

const standardWorkspaces = [
  { id: 'main', appScope: 'sekkeiya', name: 'Main Workspace', sortOrder: 0 },
  { id: 'models', appScope: '3dss', name: '3D Models (3DSS)', sortOrder: 1 },
  { id: 'layout', appScope: '3dsl', name: 'Layout (3DSL)', sortOrder: 2 },
  { id: 'presents', appScope: '3dsp', name: 'Presentations (3DSP)', sortOrder: 3 },
  { id: 'create', appScope: '3dsc', name: 'Generations (3DSC)', sortOrder: 4 },
];

async function repairWorkspaces() {
  const db = await initFirebase();
  console.log("Starting workspace repair for all projects...");

  const projectsSnap = await db.collection('projects').get();
  console.log(`Found ${projectsSnap.size} projects to check.`);

  let totalMissingAdded = 0;

  for (const projectDoc of projectsSnap.docs) {
    const projectData = projectDoc.data();
    const projectId = projectDoc.id;
    const ownerId = projectData.ownerId || 'unknown_owner';
    const memberIds = projectData.memberIds || [ownerId];
    
    console.log(`\nChecking Project: ${projectId} (${projectData.name})`);

    const workspacesRef = projectDoc.ref.collection('workspaces');
    const existingWorkspacesSnap = await workspacesRef.get();
    
    // Create a set of existing workspace IDs AND appScopes
    const existingIds = new Set();
    const existingScopes = new Set();
    
    existingWorkspacesSnap.docs.forEach(doc => {
      existingIds.add(doc.id);
      if (doc.data().appScope) existingScopes.add(doc.data().appScope);
    });

    const batch = db.batch();
    let missingCount = 0;

    for (const ws of standardWorkspaces) {
      // If a workspace with this ID or this appScope already exists, skip it.
      if (!existingIds.has(ws.id) && !existingScopes.has(ws.appScope)) {
        const newWsRef = workspacesRef.doc(ws.id);
        batch.set(newWsRef, {
          ...ws,
          workspaceType: ws.appScope,
          projectId: projectId,
          ownerId: ownerId,
          memberIds: memberIds,
          visibility: 'public',
          itemCount: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
        missingCount++;
        console.log(`  -> Queued missing workspace: ${ws.id} (Scope: ${ws.appScope})`);
      }
    }

    if (missingCount > 0) {
      await batch.commit();
      totalMissingAdded += missingCount;
      console.log(`  -> Committed ${missingCount} missing workspaces to Project: ${projectId}`);
    } else {
      console.log(`  -> All standard workspaces already exist.`);
    }
  }

  console.log(`\nRepair complete! Added ${totalMissingAdded} missing workspaces in total.`);
  process.exit(0);
}

repairWorkspaces().catch(console.error);

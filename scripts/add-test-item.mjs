import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
  } else {
    console.log("No GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json found. Trying Application Default Credentials...");
    initializeApp({ projectId: 'sekkeiya-60d77' });
  }
  
  return getFirestore();
}

async function run() {
  const db = await initFirebase();
  const projectsSnap = await db.collection('projects').get();
  console.log(`Found ${projectsSnap.size} projects`);

  let desktopProjectId = null;
  let webProjectId = null;
  let desktopWorkspaceId = null;

  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    if (data.name === '0329_desktop') {
      desktopProjectId = doc.id;
      const wsSnap = await db.collection('projects').doc(desktopProjectId).collection('workspaces').where('appScope', '==', '3dss').get();
      if (!wsSnap.empty) {
        desktopWorkspaceId = wsSnap.docs[0].id;
      }
    }
    if (data.name === '0329_web') {
      webProjectId = doc.id;
    }
  }

  console.log(`0329_web ID: ${webProjectId}`);
  console.log(`0329_desktop ID: ${desktopProjectId}`);
  console.log(`desktop 3DSS workspace ID: ${desktopWorkspaceId}`);

  if (desktopProjectId && desktopWorkspaceId) {
    const itemsRef = db.collection('projects').doc(desktopProjectId).collection('workspaces').doc(desktopWorkspaceId).collection('items');
    
    // Check if test item exists
    const existing = await itemsRef.where('name', '==', 'TEST_DISPLAY_ITEM').get();
    if (existing.empty) {
      await itemsRef.add({
        name: 'TEST_DISPLAY_ITEM',
        type: 'model',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('Inserted test item into 0329_desktop 3DSS workspace!');
    } else {
      console.log('Test item already exists in 0329_desktop.');
    }
  }

  process.exit(0);
}

run().catch(console.error);

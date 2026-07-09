const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkLegacyModels() {
  console.log('--- Checking Legacy Models Paths ---');
  try {
    const oldModelsSnap = await db.collectionGroup('models').get();
    console.log(`Remaining legacy models: ${oldModelsSnap.size}`);
    
    const paths = new Set();
    oldModelsSnap.forEach(doc => {
      // Get the parent path (e.g., users/123/models or projects/456/workspaces/models)
      const parentPath = doc.ref.parent.path;
      paths.add(parentPath);
    });
    
    console.log('Paths containing "models" collections:');
    paths.forEach(p => console.log(` - ${p}`));

  } catch (error) {
    console.error('Error:', error);
  }
}

checkLegacyModels();

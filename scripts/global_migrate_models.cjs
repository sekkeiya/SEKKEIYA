// global_migrate_models.js
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'shapeshare3d'
});

const db = admin.firestore();

async function main() {
  console.log('--- Starting Global Migration of Legacy Models ---');

  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} user documents to scan.`);

  let totalMigrated = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const modelsSnap = await userDoc.ref.collection('models').get();

    if (modelsSnap.empty) {
      continue;
    }

    console.log(`\nUser ${uid} has ${modelsSnap.size} legacy models. Migrating...`);

    // Ensure the default project exists for the user
    const defaultProjectId = `${uid}-default-project`;
    const defaultProjectRef = db.collection('projects').doc(defaultProjectId);
    
    // Create it if it doesn't exist (minimal metadata)
    const projectDoc = await defaultProjectRef.get();
    if (!projectDoc.exists) {
      console.log(`Creating default project for user ${uid}`);
      await defaultProjectRef.set({
        name: 'Personal Space',
        type: 'personal',
        ownerId: uid,
        memberIds: [uid],
        visibility: 'private',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Default workspace is 'models'
    const itemsCol = defaultProjectRef.collection('workspaces').doc('models').collection('items');

    const batch = db.batch();
    let batchCount = 0;
    
    for (const modelDoc of modelsSnap.docs) {
      const data = modelDoc.data();
      
      const transformedData = {
        ...data,
        id: modelDoc.id,
        type: 'model',
        ownerId: uid,
        isLegacyMigrated: true,
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const newItemRef = itemsCol.doc(modelDoc.id);
      batch.set(newItemRef, transformedData, { merge: true });
      batchCount++;

      if (batchCount === 490) {
         await batch.commit();
         batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
    
    totalMigrated += modelsSnap.size;
    console.log(`Successfully migrated ${modelsSnap.size} models for user ${uid}.`);
  }

  console.log(`\n--- Migration Complete ---`);
  console.log(`Total models migrated: ${totalMigrated}`);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming default credentials from CLI or environment)
admin.initializeApp({
  projectId: "shapeshare3d"
});

const db = admin.firestore();

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function deleteCollection(db, collectionRef, batchSize) {
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function main() {
  console.log("Starting deletion of legacy models subcollections in users/{uid}...");
  const usersRef = db.collection('users');
  const usersSnap = await usersRef.get();
  
  console.log(`Found ${usersSnap.size} user documents.`);
  let deletedCount = 0;
  
  for (const userDoc of usersSnap.docs) {
    const modelsRef = userDoc.ref.collection('models');
    
    // Check if the subcollection has any documents
    const modelsSnap = await modelsRef.limit(1).get();
    if (!modelsSnap.empty) {
      console.log(`Deleting models subcollection for user: ${userDoc.id}...`);
      await deleteCollection(db, modelsRef, 100);
      deletedCount++;
    }
  }

  console.log(`\nCompleted! Deleted legacy models collections for ${deletedCount} users.`);
}

main().catch(err => {
  console.error("Error occurred:", err);
  process.exit(1);
});

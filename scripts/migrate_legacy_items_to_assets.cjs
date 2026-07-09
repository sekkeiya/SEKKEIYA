const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'shapeshare3d'
  });
} else {
  admin.initializeApp({
    projectId: 'shapeshare3d'
  });
}

const db = admin.firestore();

async function main() {
  console.log('--- Starting Migration of Legacy Items to Assets ---');

  // Search items collectionGroup
  const itemsSnap = await db.collectionGroup('items').get();
  console.log(`[INFO] Found ${itemsSnap.size} total items to scan.`);

  let totalMigrated = 0;
  let skippedNotModel = 0;
  let skippedAlreadyMigrated = 0;
  let batchCount = 0;
  let batch = db.batch();

  for (const itemDoc of itemsSnap.docs) {
    const data = itemDoc.data();
    
    // Check if it's a 3D model that hasn't been migrated
    const isModel = data.type === 'model' || data.itemType === '3DSS';
    const hasAssetRef = !!data.assetRef;
    
    if (!isModel) {
      skippedNotModel++;
      continue;
    }
    
    if (hasAssetRef) {
      skippedAlreadyMigrated++;
      continue;
    }
    
    const itemId = itemDoc.id;
    
    // 1. Create the new asset in /assets
    const assetRef = db.collection('assets').doc(itemId);
    const newAssetData = {
      id: itemId,
      name: data.title || data.name || data.originalFilename || 'Untitled Model',
      type: '3d-model',
      format: data.format || 'unknown',
      sizeBytes: data.originalFileSize || data.sizeBytes || 0,
      storagePath: data.storagePath || data.path || '',
      downloadUrl: data.downloadUrl || data.url || '',
      thumbnailUrl: data.thumbnailUrl || '',
      thumbnailStoragePath: data.thumbnailStoragePath || '',
      ownerId: data.ownerId || 'unknown',
      visibility: data.visibility || 'public',
      category: data.category || data.mainCategory || 'Uncategorized',
      tags: data.tags || [],
      extendedMetadata: data.extendedMetadata || {
        dimensions: data.dimensions || null,
        dimensionSource: data.dimensionSource || null,
        ai: data.ai || null
      },
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedToAssetAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.set(assetRef, newAssetData, { merge: true });

    // 2. Update the legacy item to point to the new asset
    const updatedItemData = {
      assetRef: itemId,
      type: 'model', // Normalize type
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    batch.update(itemDoc.ref, updatedItemData);
    
    totalMigrated++;
    batchCount += 2; // Two operations per legacy item
    
    // Firestore batch size limit is 500 operations
    if (batchCount >= 490) {
      process.stdout.write('.');
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\n\n--- Migration Complete ---`);
  console.log(`[INFO] Skipped ${skippedNotModel} non-model items.`);
  console.log(`[INFO] Skipped ${skippedAlreadyMigrated} items already having assetRef.`);
  console.log(`[OK] Successfully migrated ${totalMigrated} items to /assets structure.`);
}

main().catch(err => {
  console.error("\n[ERROR] Migration failed:", err);
  process.exit(1);
});

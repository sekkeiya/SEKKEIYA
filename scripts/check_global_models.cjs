const admin = require('firebase-admin');

// Ensure you have set GOOGLE_APPLICATION_CREDENTIALS before running this
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkGlobalModels() {
  console.log('--- Checking Global Models ---');
  try {
    const itemsSnapshot = await db.collectionGroup('items')
      .where('type', '==', 'model')
      .where('visibility', '==', 'public')
      .get();
    
    console.log(`Found ${itemsSnapshot.size} public models across all projects.`);
    
    const ownerCounts = {};
    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      const ownerId = data.ownerId || 'unknown';
      ownerCounts[ownerId] = (ownerCounts[ownerId] || 0) + 1;
    });
    
    console.log('Models per ownerId:', ownerCounts);
    
    const allItemsSnapshot = await db.collectionGroup('items')
      .where('type', '==', 'model')
      .get();
      
    let totalPublic = 0;
    let totalPrivate = 0;
    const allOwnerCounts = {};
    allItemsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.visibility === 'public') totalPublic++;
      else totalPrivate++;
      
      const ownerId = data.ownerId || 'unknown';
      allOwnerCounts[ownerId] = (allOwnerCounts[ownerId] || 0) + 1;
    });
    
    console.log(`Total models (regardless of visibility): ${allItemsSnapshot.size} (Public: ${totalPublic}, Private: ${totalPrivate})`);
    console.log('All Models per ownerId:', allOwnerCounts);

  } catch (error) {
    console.error('Error querying models:', error);
  }
}

checkGlobalModels();

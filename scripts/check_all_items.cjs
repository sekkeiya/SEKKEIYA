const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkAllItems() {
  console.log('--- Checking All Items ---');
  try {
    const itemsSnapshot = await db.collectionGroup('items').get();
    
    let modelCount = 0;
    const ownerCounts = {};
    
    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === 'model') {
        modelCount++;
        const ownerId = data.ownerId || 'unknown';
        ownerCounts[ownerId] = (ownerCounts[ownerId] || 0) + 1;
      }
    });
    
    console.log(`Total models (any visibility): ${modelCount}`);
    console.log('Models per ownerId:', ownerCounts);

    const usersSnap = await db.collection('users').get();
    console.log(`Total users in DB: ${usersSnap.size}`);

    const oldModelsSnap = await db.collectionGroup('models').get();
    console.log(`Remaining legacy models in 'models' subcollections: ${oldModelsSnap.size}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllItems();

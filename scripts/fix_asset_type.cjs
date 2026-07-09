const admin = require('firebase-admin');

try {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.log('Failed to load serviceAccountKey.json', e.message);
  admin.initializeApp({ projectId: 'shapeshare3d' });
}

const db = admin.firestore();

async function run() {
  console.log('--- STARTING ASSET RESCUE ---');
  let count = 0;
  try {
    for (const t of ['Furniture', 'Architecture']) {
      const q = db.collection('assets').where('type', '==', t);
      const snaps = await q.get();
      if (!snaps.empty) {
        for (const doc of snaps.docs) {
          const id = doc.id;
          await doc.ref.update({
            type: '3d-model',
            modelType: t
          });
          console.log(`[Fixed] Asset ${id} restored to 3d-model (was ${t})`);
          count++;
        }
      }
    }
    console.log(`--- RESCUE COMPLETE (${count} fixed) ---`);
  } catch (error) {
    console.error('Error during rescue:', error);
  }
}

run().finally(() => process.exit(0));

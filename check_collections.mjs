import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Check if credentials exist and init
try {
  let serviceAccount;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else {
    // Assuming local dev key is at root
    const keyPath = './serviceAccountKey.json';
    if(fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    }
  }
  
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp(); // Might work if ADC is set up
  }
} catch(e) {
  console.log('Firebase Init Warning: ', e.message);
}

const db = getFirestore();

async function checkCollections() {
  const collections = [
    'teamBoards', 
    'teamBoardInvitations', 
    'layoutShares', 
    'publicModelIndex', 
    'viewerShares', 
    'articles'
  ];

  console.log('--- Checking Deleted Collections ---');
  for(const colName of collections) {
    try {
      const snap = await db.collection(colName).limit(1).get();
      if(snap.empty) {
        console.log(`[OK]   Collection ${colName} is empty.`);
      } else {
        console.log(`[WARN] Collection ${colName} still has documents! Count: >=1`);
      }
    } catch(err) {
      console.log(`[ERR]  Failed to check ${colName}:`, err.message);
    }
  }
  console.log('--- Done ---');
  process.exit(0);
}

checkCollections();

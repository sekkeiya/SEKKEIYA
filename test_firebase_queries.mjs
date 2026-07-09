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

async function checkTeamProjects() {
  console.log('--- Checking Team Projects Example ---');
  try {
    // Query a bit differently without a specific UID, just look for ANY board where memberIds exists and is non-empty
    const boardsQuery = await db.collection('boards').get();
    let hasTeamBoards = false;
    let anyBoardWithMembers = null;

    boardsQuery.forEach(doc => {
      const data = doc.data();
      if (Array.isArray(data.memberIds) && data.memberIds.length > 0) {
        hasTeamBoards = true;
        
        // Ensure we don't just find a myProject where the only member is the owner
        if (data.memberIds.some(uid => uid !== data.ownerId)) {
           anyBoardWithMembers = { id: doc.id, ownerId: data.ownerId, memberIds: data.memberIds, title: data.title };
        }
      }
    });

    if (anyBoardWithMembers) {
      console.log('Found a valid Team Board scenario:');
      console.log(anyBoardWithMembers);
    } else if (hasTeamBoards) {
      console.log('Found boards with memberIds, but all memberIds just seem to match the ownerId (no real "team").');
    } else {
      console.log('No boards with populated memberIds found in the entire collection.');
    }

  } catch(err) {
    console.log(`[ERR] Failed to check boards:`, err.message);
  }
  
  console.log('--- Checking publicModelIndex ---');
  try {
    const pubQuery = await db.collection('publicModelIndex').limit(5).get();
    console.log(`Found ${pubQuery.size} documents in publicModelIndex.`);
  } catch(err) {
    console.log(`[ERR] Failed to check publicModelIndex:`, err.message);
  }
  process.exit(0);
}

checkTeamProjects();

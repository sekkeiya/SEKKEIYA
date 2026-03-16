const admin = require("firebase-admin");
const fs = require("fs");

admin.initializeApp();
const db = admin.firestore();

function log(msg) {
  console.log(msg);
  fs.appendFileSync("scripts/backfill_log.txt", msg + "\n");
}

async function backfillVisibility() {
  log("Starting backfill for driveAssets visibility...");
  let count = 0;
  
  try {
    const usersSnap = await db.collection("users").get();
    log(`Found ${usersSnap.size} users. Scanning their driveAssets...`);
    
    let updatedCount = 0;
    
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const assetsSnap = await db.collection("users").doc(uid).collection("driveAssets")
        .where("sourceApp", "==", "3DSS")
        .get();
        
      for (const assetDoc of assetsSnap.docs) {
        count++;
        const assetData = assetDoc.data();
        
        const sourceAssetId = assetData.sourceAssetId;
        if (!sourceAssetId) continue;
        
        // Fetch original model to get visibility from unified schema path: users/{uid}/models/{modelId}
        const modelDoc = await db.collection("users").doc(uid).collection("models").doc(sourceAssetId).get();
        let visibility = "private";
        
        if (modelDoc.exists) {
           visibility = modelDoc.data().visibility || "private";
        }
        
        // Update driveAsset
        await assetDoc.ref.update({
           visibility: visibility
        });
        
        updatedCount++;
        if (updatedCount % 50 === 0) {
           log(`Updated ${updatedCount} assets so far...`);
        }
      }
    }
    
    log(`\nBackfill complete! Scanned ${count} 3DSS assets, updated ${updatedCount} assets with visibility.`);
    
  } catch (error) {
    log("Backfill failed: " + error);
  }
}

backfillVisibility().then(() => process.exit(0)).catch(() => process.exit(1));

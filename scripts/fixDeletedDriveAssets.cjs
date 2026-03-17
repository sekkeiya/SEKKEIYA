const admin = require("firebase-admin");
const fs = require("fs");

process.env.GOOGLE_APPLICATION_CREDENTIALS = "C:\\Users\\sekkeiya\\keys\\shapeshare3d-admin.json";

// Avoid initializing twice if running directly
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "shapeshare3d"
  });
}
const db = admin.firestore();

function log(msg) {
  console.log(msg);
  fs.appendFileSync("scripts/repair_log.txt", msg + "\n");
}

async function repairDeletedDriveAssets() {
  log("Starting repair of incorrectly deleted driveAssets...");
  let countScanned = 0;
  let countRepaired = 0;
  
  try {
    const usersSnap = await db.collection("users").get();
    log(`Found ${usersSnap.size} users. Scanning their driveAssets...`);
    
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      // Get all driveAssets that are currently marked as deleted and are from 3DSS
      const assetsSnap = await db.collection("users").doc(uid).collection("driveAssets")
        .where("isDeleted", "==", true)
        .where("sourceApp", "==", "3DSS")
        .get();
        
      for (const assetDoc of assetsSnap.docs) {
        countScanned++;
        const assetData = assetDoc.data();
        
        const sourceAssetId = assetData.sourceAssetId;
        if (!sourceAssetId) continue;
        
        // Fetch the linked canonical model
        const modelDoc = await db.collection("users").doc(uid).collection("models").doc(sourceAssetId).get();
        
        // If the model exists AND is not deleted itself, this driveAsset should not be deleted
        if (modelDoc.exists) {
           const modelData = modelDoc.data();
           if (modelData.isDeleted !== true) {
             // Repair the driveAsset
             await assetDoc.ref.update({
               isDeleted: false,
               updatedAt: admin.firestore.FieldValue.serverTimestamp()
             });
             
             log(`[REPAIRED] driveAsset ${assetDoc.id} for user ${uid}`);
             countRepaired++;
           } else {
             log(`[SKIP] Canonical model ${sourceAssetId} is also marked soft-deleted for user ${uid}. Ignoring.`);
           }
        } else {
           log(`[SKIP] Canonical model ${sourceAssetId} does not exist for user ${uid}. Ignoring.`);
        }
      }
    }
    
    log(`\nRepair complete! Scanned ${countScanned} deleted 3DSS assets, repaired ${countRepaired} assets.`);
    
  } catch (error) {
    log("Repair failed: " + error);
  }
}

repairDeletedDriveAssets().then(() => process.exit(0)).catch(() => process.exit(1));

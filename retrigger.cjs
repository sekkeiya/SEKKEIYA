require("dotenv").config({ path: "./.env.local" });
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "shapeshare3d" });
}

const db = admin.firestore();

async function retriggerAnalysis() {
  const usersRef = db.collection("users");
  const usersSnap = await usersRef.limit(10).get();
  
  for (const userDoc of usersSnap.docs) {
    const assetsSnap = await db.collection("users").doc(userDoc.id).collection("driveAssets")
        .where("embeddingStatus", "==", "error")
        .get();
    
    if (assetsSnap.size > 0) {
        console.log(`Found ${assetsSnap.size} assets for user ${userDoc.id}. Retriggering...`);
        for (const doc of assetsSnap.docs) {
            await doc.ref.update({
                aiAnalyzed: false,
                analysisStatus: "pending",
                embeddingStatus: "none"
            });
            console.log(`Retriggered asset: ${doc.id}`);
        }
    }
  }
}

retriggerAnalysis().then(() => {
    console.log("Done.");
    process.exit(0);
});

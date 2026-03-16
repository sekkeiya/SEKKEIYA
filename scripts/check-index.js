const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function checkIndex() {
  try {
    const snap = await db.collectionGroup("driveAssets")
      .where("embeddingStatus", "==", "ready")
      .limit(1)
      .get();
    console.log("Success! Found " + snap.size + " docs.");
  } catch (error) {
    console.error("Index Error:", error.message);
  }
}

checkIndex();

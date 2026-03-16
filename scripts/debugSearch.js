const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

async function checkKame() {
  console.log("Checking '亀' semantic search backend...");
  
  console.log("Checking '亀' models directly...");

  const usersSnap = await db.collection("users").get();
  for (const user of usersSnap.docs) {
    const assetsSnap = await db.collection("users").doc(user.id).collection("driveAssets")
      .where("name", ">=", "亀")
      .where("name", "<=", "亀\uf8ff")
      .get();
      
    assetsSnap.forEach(doc => {
      const data = doc.data();
      console.log(`FOUND Turtle: id=${doc.id}, name=${data.name}, visibility=${data.visibility}, embeddingStatus=${data.embeddingStatus}, sourceApp=${data.sourceApp}, sourceAssetId=${data.sourceAssetId}`);
    });
  }
  
  process.exit(0);
}

checkKame().catch(e => { console.error(e); process.exit(1); });

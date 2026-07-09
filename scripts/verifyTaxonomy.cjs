const admin = require("firebase-admin");

if (!admin.apps.length) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("No credentials");
    process.exit(1);
  }
  admin.initializeApp();
}
const db = admin.firestore();

async function run() {
  // Test query 1: No filters
  const snap1 = await db.collectionGroup("models").get();
  console.log(`[RAW] collectionGroup("models") size: ${snap1.size}`);

  // Test query 2: isCanonical == true
  const snap2 = await db.collectionGroup("models").where("isCanonical", "==", true).get();
  console.log(`[FILTER 1] where isCanonical == true size: ${snap2.size}`);

  // Test query 3: visibility == "public"
  const snap3 = await db.collectionGroup("models").where("visibility", "==", "public").get();
  console.log(`[FILTER 2] where visibility == "public" size: ${snap3.size}`);

  // Test query 4: Both
  try {
    const snap4 = await db.collectionGroup("models")
      .where("isCanonical", "==", true)
      .where("visibility", "==", "public")
      .get();
    console.log(`[FILTER BOTH] size: ${snap4.size}`);
  } catch(e) {
    console.log(`[FILTER BOTH] Failed! Requires composite index? Error: ${e.message}`);
  }
}

run().then(()=>process.exit(0)).catch(e=>console.error(e));

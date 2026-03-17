const admin = require("firebase-admin");

process.env.GOOGLE_APPLICATION_CREDENTIALS = "C:\\Users\\sekkeiya\\keys\\shapeshare3d-admin.json";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "shapeshare3d"
  });
}
const db = admin.firestore();

async function testQuery() {
  try {
    const q = db.collectionGroup("models").where("visibility", "==", "public").limit(5);
    const snap = await q.get();
    console.log(`Query successful! Retrieved ${snap.size} public models via collectionGroup.`);
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`- ${doc.id}: ${data.name || data.title} (visibility: ${data.visibility})`);
    });
  } catch (err) {
    console.error("Query failed:", err);
  }
}

testQuery().then(() => process.exit(0)).catch(() => process.exit(1));

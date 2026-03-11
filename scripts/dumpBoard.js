const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

async function run() {
  const boardsRef = db.collection("boards");
  const snap = await boardsRef.where("name", "==", "01_TeamBoard").get();
  
  if (snap.empty) {
    console.log("No board found with name '01_TeamBoard'");
    return;
  }
  
  snap.forEach((doc) => {
    console.log("Board ID:", doc.id);
    console.log(JSON.stringify(doc.data(), null, 2));
  });
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

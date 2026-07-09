import { initializeApp } from "firebase/app";
import { getFirestore, collectionGroup, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  projectId: "shapeshare3d",
  // mock credentials, enough for index errors since it connects to the prod DB
  apiKey: "AIza-fake-key",
  appId: "1:1234567:web:abcdef",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const q = query(
      collectionGroup(db, "models"),
      where("isCanonical", "==", true),
      where("visibility", "==", "public")
    );
    await getDocs(q);
    console.log("Success! No index error.");
  } catch(e) {
    console.error("Caught error:", e.message);
  }
}

run().then(() => process.exit(0));

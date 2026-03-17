const admin = require("firebase-admin");

process.env.GOOGLE_APPLICATION_CREDENTIALS = "C:\\Users\\sekkeiya\\keys\\shapeshare3d-admin.json";

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "shapeshare3d"
  });
}
const db = admin.firestore();

async function inspectModels() {
  try {
    const q = db.collectionGroup("models")
      .where("isCanonical", "==", true)
      .where("visibility", "==", "public")
      .limit(10);
    const snap = await q.get();
    
    snap.forEach(doc => {
      const data = doc.data();
      const searchableStr = [
        data.title, data.name, data.description, 
        ...(data.tags || []),
        data.category?.group, data.category?.sub, data.category?.type,
        data.mainCategory, data.subCategory, data.detailCategory,
        data.createdBy, data.ownerHandle, data.ownerHandleLower,
        data.slug, data.tagSlugs?.join(" "), data.tagsList?.join(" ")
      ].filter(Boolean).join(" ");
      
      console.log(`\n--- Model ID: ${doc.id} ---`);
      console.log(`Name/Title: ${data.name || data.title}`);
      console.log(`Tags:`, data.tags);
      console.log(`Category:`, data.category);
      console.log(`Description:`, typeof data.description === 'string' ? data.description.substring(0, 50) + "..." : data.description);
      console.log(`Combined Search String:`, searchableStr);
    });
  } catch (err) {
    console.error("Query failed:", err);
  }
}

inspectModels().then(() => process.exit(0)).catch(() => process.exit(1));

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// 建築カテゴリに含まれる特徴的な語句
const ARCH_KEYWORDS = ["床", "天", "壁", "部位", "外構", "階層", "屋根", "ファサード", "玄関", "リビング", "キッチン"];

async function runAudit() {
  console.log("=== publicModelIndex Taxonomy Audit ===");
  try {
    const snapshot = await db.collection("publicModelIndex").get();
    let total = snapshot.size;
    console.log(`Auditing ${total} public models...`);

    let furnitureWithArch = [];
    let archWithFurniture = [];
    let missingOrNull = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const type = data.type;
      const mainCat = [].concat(data.mainCategory || []);
      const subCat = [].concat(data.subCategory || []);
      const detailCat = data.detailCategory;

      const cats = [...mainCat, ...subCat].filter(c => typeof c === 'string');
      const hasArchKeyword = cats.some(c => ARCH_KEYWORDS.some(k => c.includes(k)));
      const hasFurnitureKeyword = cats.some(c => ["ソファ", "チェア", "テーブル", "ベッド", "収納"].some(k => c.includes(k)));

      // 1. type = furniture なのに建築カテゴリを持つ
      if (type === "furniture" && hasArchKeyword) {
        furnitureWithArch.push({ id: doc.id, title: data.title, main: data.mainCategory, sub: data.subCategory });
      }

      // 2. type = architecture なのに家具カテゴリを持つ
      if (type === "architecture" && hasFurnitureKeyword) {
        archWithFurniture.push({ id: doc.id, title: data.title, main: data.mainCategory, sub: data.subCategory });
      }

      // 3. mainCategory / subCategory / detailCategory の空・不正値
      if (
        !data.mainCategory || mainCat.length === 0 ||
        !data.subCategory || subCat.length === 0 ||
        data.mainCategory === null || data.subCategory === null ||
        typeof data.mainCategory === 'string' || typeof data.subCategory === 'string'
      ) {
        missingOrNull.push({ id: doc.id, title: data.title, type: data.type, main: data.mainCategory, sub: data.subCategory, detail: data.detailCategory });
      }
    });

    console.log(`\n--- [1] Furniture with Architecture Categories (${furnitureWithArch.length}) ---`);
    furnitureWithArch.forEach(m => console.log(`[${m.id}] ${m.title} | Main: ${JSON.stringify(m.main)} | Sub: ${JSON.stringify(m.sub)}`));

    console.log(`\n--- [2] Architecture with Furniture Categories (${archWithFurniture.length}) ---`);
    archWithFurniture.forEach(m => console.log(`[${m.id}] ${m.title} | Main: ${JSON.stringify(m.main)} | Sub: ${JSON.stringify(m.sub)}`));

    console.log(`\n--- [3] Missing/Null/Invalid Structure Categories (${missingOrNull.length}) ---`);
    missingOrNull.forEach(m => console.log(`[${m.id}] ${m.title} | Type: ${m.type} | Main: ${JSON.stringify(m.main)} | Sub: ${JSON.stringify(m.sub)}`));

    console.log("\n=== Audit Complete ===");
  } catch (err) {
    console.error("Audit failed:", err);
  } finally {
    process.exit(0);
  }
}

runAudit();

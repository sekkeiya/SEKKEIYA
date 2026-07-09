const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}
const db = admin.firestore();

async function checkSofaPrices() {
  console.log("Fetching all sofas from publicModelIndex...");
  
  // Try to find any model where subCategory or mainCategory contains Sofa
  const snapshot = await db.collection("publicModelIndex").get();
  
  let sofaCount = 0;
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const isSofa = 
      (Array.isArray(data.subCategory) && data.subCategory.includes("ソファ")) ||
      data.subCategory === "ソファ" ||
      (Array.isArray(data.mainCategory) && data.mainCategory.includes("ソファ・ロビーチェア")) ||
      data.mainCategory === "ソファ・ロビーチェア";
      
    if (isSofa) {
      sofaCount++;
      console.log(`\n[Sofa ID: ${doc.id}] Title: ${data.title}`);
      console.log(`   Price Field: ${data.price} (${typeof data.price})`);
      console.log(`   SalesPrice Field: ${data.salesPrice} (${typeof data.salesPrice})`);
      
      const basePrice = data.price !== undefined ? data.price : data.salesPrice;
      const validPriceNumber = typeof basePrice === "number" || (basePrice != null && basePrice !== "" && !isNaN(Number(basePrice)));
      console.log(`   Valid Number?: ${validPriceNumber}`);
      console.log(`   Compared Value: ${Number(basePrice || 0)}`);
    }
  });
  
  console.log(`\nTotal sofas found in publicModelIndex: ${sofaCount}`);
}

checkSofaPrices().catch(console.error);

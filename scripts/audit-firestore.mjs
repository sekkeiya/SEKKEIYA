import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initFirebase() {
  let serviceAccount;
  
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    serviceAccount = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  } else {
    const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
    if(fs.existsSync(keyPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    }
  }
  
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    console.log("No GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json found. Trying Application Default Credentials...");
    initializeApp({ projectId: 'sekkeiya-60d77' });
  }
  
  return getFirestore();
}

async function auditFirestore() {
  console.log("Starting Firestore Audit...");
  let db;
  try {
    db = await initFirebase();
  } catch (err) {
    console.error("Failed to initialize Firebase Admin:", err);
    process.exit(1);
  }

  const report = {
    timestamp: new Date().toISOString(),
    collections: {}
  };

  try {
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} root collections.`);

    for (const collection of collections) {
      console.log(`Auditing collection: ${collection.id}...`);
      
      let count = 'unknown';
      try {
          const countQuery = await collection.count().get();
          count = countQuery.data().count;
      } catch (e) {
          console.warn(`Could not get exact count for ${collection.id}:`, e.message);
      }

      const sampleDocsSnap = await collection.limit(5).get();
      const samples = [];
      const subcollectionsSet = new Set();
      const allFields = new Set();

      for (const doc of sampleDocsSnap.docs) {
          const data = doc.data();
          const cleanData = {};
          
          Object.keys(data).forEach(k => {
              allFields.add(k);
              if (Array.isArray(data[k]) && data[k].length > 10) {
                  cleanData[k] = `[Array length: ${data[k].length}]`;
              } else if (typeof data[k] === 'string' && data[k].length > 100) {
                  cleanData[k] = data[k].substring(0, 100) + '...';
              } else {
                  cleanData[k] = data[k];
              }
          });
          
          samples.push({ id: doc.id, fieldsPresent: Object.keys(data), sampleData: cleanData });
          
          const subcols = await doc.ref.listCollections();
          subcols.forEach(sub => subcollectionsSet.add(sub.id));
      }

      report.collections[collection.id] = {
        documentCount: count,
        subcollectionsFoundInSamples: Array.from(subcollectionsSet),
        allFieldsEncountered: Array.from(allFields),
        samples: samples
      }
    }

    const outputPath = path.resolve(__dirname, 'report-firestore-structure.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nAudit complete! Report saved to: ${outputPath}`);

  } catch (err) {
    console.error("Audit failed:", err);
    console.error("\n--- Make sure your ADC is set via 'gcloud auth application-default login' or set GOOGLE_APPLICATION_CREDENTIALS env var. ---");
  }
}

auditFirestore();

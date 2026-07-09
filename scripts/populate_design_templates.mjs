import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Initialize Firebase Admin
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

// We use the existing credentials in the workspace
if (!fs.existsSync(serviceAccountPath)) {
  console.error("Please ensure serviceAccountKey.json is perfectly placed at", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "r3dm-dev.appspot.com" // Update this if your project ID differs
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const TEMPLATES = [
  {
    docId: 'rhino_standard_m',
    data: {
      name: 'Standard Architecture (Meters)',
      creatorName: 'SEKKEIYA Official',
      category: 'official',
      appType: 'rhino',
      description: 'メートル単位の建築用標準テンプレート。標準レイヤー構造セットアップ済み。',
      thumbnailUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400&auto=format&fit=crop',
      storageFullPath: 'templates/rhino/standard_m.3dm',
      order: 1
    }
  },
  {
    docId: 'rhino_product_mm',
    data: {
      name: 'Product Design (mm)',
      creatorName: 'SEKKEIYA Official',
      category: 'official',
      appType: 'rhino',
      description: 'プロダクトデザイン向けのミリメートルテンプレート。',
      thumbnailUrl: 'https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=400&auto=format&fit=crop',
      storageFullPath: 'templates/rhino/product_mm.3dm',
      order: 2
    }
  },
  {
    docId: 'blender_default',
    data: {
      name: 'Blender Default Setup',
      creatorName: 'SEKKEIYA Official',
      category: 'official',
      appType: 'blender',
      description: 'Cyclesレンダリング設定済みの初期シーン',
      thumbnailUrl: 'https://images.unsplash.com/photo-1616423640778-28d1b53229bd?q=80&w=400&auto=format&fit=crop',
      storageFullPath: 'templates/blender/default.blend',
      order: 1
    }
  }
];

async function run() {
  console.log("Starting template population...");

  for (const t of TEMPLATES) {
    // 1. Upload dummy file to Storage
    const fileContent = `Dummy content for ${t.data.name}`;
    const file = bucket.file(t.data.storageFullPath);
    await file.save(fileContent, {
      metadata: { contentType: 'application/octet-stream' }
    });
    console.log(`Uploaded dummy file to ${t.data.storageFullPath}`);

    // 2. Add document to Firestore
    await db.collection('templates').doc(t.docId).set(t.data);
    console.log(`Created Firestore doc templates/${t.docId}`);
  }

  console.log("Template population complete!");
}

run().catch(console.error);

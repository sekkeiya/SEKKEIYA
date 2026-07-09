// v0.1.11 インストーラーを Firebase Storage にアップロードして公開URLを出力する
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';

const VERSION = '0.1.11';
const LOCAL = `C:\\Users\\sekkeiya\\02-WebApp\\040-sekkeiya\\sekkeiya-desktop\\src-tauri\\target\\release\\bundle\\nsis\\SEKKEIYA Desktop_${VERSION}_x64-setup.exe`;
const DEST = `installers/SEKKEIYA Desktop_${VERSION}_x64-setup.exe`;
const BUCKET = 'shapeshare3d.firebasestorage.app';

const sa = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(sa), storageBucket: BUCKET });

const st = fs.statSync(LOCAL);
console.log(`local: ${LOCAL} (${(st.size / 1024 / 1024).toFixed(1)} MB)`);

const bucket = getStorage().bucket();
await bucket.upload(LOCAL, {
  destination: DEST,
  metadata: { contentType: 'application/x-msdownload', cacheControl: 'public,max-age=3600' },
  public: true,
});
const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(DEST)}?alt=media`;
console.log('UPLOADED');
console.log('URL=' + url);
process.exit(0);

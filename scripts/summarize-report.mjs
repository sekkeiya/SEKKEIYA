import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportPath = path.resolve(__dirname, 'report-firestore-structure.json');
const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const summary = [];

for (const [col, info] of Object.entries(data.collections)) {
  summary.push(`Collection: ${col}`);
  summary.push(`  Count: ${info.documentCount}`);
  summary.push(`  Subcollections: ${info.subcollectionsFoundInSamples.join(', ')}`);
  summary.push(`  Fields: ${info.allFieldsEncountered.join(', ')}`);
  summary.push('');
}

fs.writeFileSync(path.resolve(__dirname, 'summary.txt'), summary.join('\n'));

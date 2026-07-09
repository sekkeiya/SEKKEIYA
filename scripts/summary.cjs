const fs = require('fs');
const data = require('./report-firestore-structure.json');
const summary = [];
for (const [col, info] of Object.entries(data.collections)) {
  summary.push(`Collection: ${col}`);
  summary.push(`  Count: ${info.documentCount}`);
  summary.push(`  Fields: ${info.allFieldsEncountered.slice(0, 15).join(', ')}${info.allFieldsEncountered.length > 15 ? ', ...' : ''}`);
  summary.push(`  Subcols: ${info.subcollectionsFoundInSamples.join(', ')}`);
}
fs.writeFileSync(__dirname + '/summary.txt', summary.join('\n'));

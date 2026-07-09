const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, 'firebase-legacy-backup-2026-03-29T10-19-12-955Z.json');

if (fs.existsSync(backupPath)) {
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  let modelCount = 0;
  let ownerCounts = {};

  const users = data.__collections__?.users || {};
  for (const uid in users) {
    const user = users[uid];
    const models = user.__collections__?.models || {};
    const count = Object.keys(models).length;
    if (count > 0) {
      modelCount += count;
      ownerCounts[uid] = count;
    }
  }

  console.log(`Total models in backup: ${modelCount}`);
  console.log('Models per user in backup:', ownerCounts);
} else {
  console.log('Backup file not found at', backupPath);
}

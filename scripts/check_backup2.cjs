const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, 'backup_2026_legacy_collections.json');

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

  console.log(`Total legacy models in backup: ${modelCount}`);
  console.log('Legacy models per user in backup:', ownerCounts);
} else {
  console.log('Backup file not found at', backupPath);
}

const fs = require('fs');
const path = require('path');
const targetFile = path.join('C:\\', 'Users', 'sekkeiya', '02-WebApp', '028-R3DM-ver2', 'r3dm-share', 'src', 'features', 'Dashboard', 'Main', 'ModelsList', 'ModelCardPreview', 'ModelDetailContent.jsx');
const lines = fs.readFileSync(targetFile, 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('fetchModelDetail') || l.includes('uploadModelImage')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});

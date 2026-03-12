const fs = require('fs');
const path = require('path');

const srcDir = 'src/features/drive';
const destDir = 'packages/global-panel/src/panels/drive';

function readAndWrite(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  const files = fs.readdirSync(from);
  for (const file of files) {
    const fromPath = path.join(from, file);
    const toPath = path.join(to, file);
    if (fs.statSync(fromPath).isDirectory()) {
      readAndWrite(fromPath, toPath);
    } else {
      const data = fs.readFileSync(fromPath);
      fs.writeFileSync(toPath, data);
      console.log('Copied ->', toPath);
    }
  }
}

try {
  readAndWrite(srcDir, destDir);
  console.log('Done!');
} catch (e) {
  console.error("Error:", e);
}

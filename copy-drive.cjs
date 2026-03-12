const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src/features/drive');
const destDir = path.join(__dirname, 'packages/global-panel/src/panels/drive');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    const fileFrom = path.join(from, element);
    const fileTo = path.join(to, element);
    if (fs.lstatSync(fileFrom).isFile()) {
      fs.copyFileSync(fileFrom, fileTo);
    } else {
      copyFolderSync(fileFrom, fileTo);
    }
  });
}

copyFolderSync(srcDir, destDir);
console.log('Copy complete');

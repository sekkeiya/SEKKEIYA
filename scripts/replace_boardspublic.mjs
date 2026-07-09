import fs from 'fs';
import path from 'path';

const searchRegex = /boardsPublic/g;
const replaceWith = 'projectShares';

function walk(dir) {
  try {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') continue;
      
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        walk(filePath);
      } else {
        if (!filePath.match(/\.(js|jsx|ts|tsx)$/i)) continue;
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (searchRegex.test(content)) {
            const newContent = content.replace(searchRegex, replaceWith);
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`Updated: ${filePath}`);
          }
        } catch(e) { /* ignore read errors */ }
      }
    }
  } catch(e) {
    console.error('Error walking', dir, e.message);
  }
}

console.log("Starting replacement in sekkeiya...");
walk(path.resolve('./src'));
walk(path.resolve('./functions'));
walk(path.resolve('./packages'));

console.log("Starting replacement in r3dm-share...");
const r3dmShareSrc = path.resolve('../028-R3DM-ver2/r3dm-share/src');
walk(r3dmShareSrc);

console.log("Starting replacement in 3d-shape-layout...");
const layoutSrc = path.resolve('../028-R3DM-ver2/3d-shape-layout/src');
walk(layoutSrc);

console.log("Starting replacement in sekkeiya-desktop...");
const desktopSrc = path.resolve('./sekkeiya-desktop/src');
walk(desktopSrc);

console.log("Done!");

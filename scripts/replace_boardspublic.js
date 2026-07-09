const fs = require('fs');
const path = require('path');

const replaceStr = 'projectShares';

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
          if (content.includes('boardsPublic')) {
            const newContent = content.split('boardsPublic').join(replaceStr);
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`Updated: ${filePath}`);
          }
        } catch(e) { }
      }
    }
  } catch(e) {
    console.error('Error walking', dir, e.message);
  }
}

try {
  console.log("Starting replacement...");
  walk(path.resolve('./src'));
  walk(path.resolve('./functions'));
  walk(path.resolve('./packages'));

  const r3dmShareSrc = path.resolve('../028-R3DM-ver2/r3dm-share/src');
  walk(r3dmShareSrc);

  const sekkeiyaDesktopSrc = path.resolve('../040-sekkeiya/sekkeiya-desktop/src');
  walk(sekkeiyaDesktopSrc);

  console.log("Done!");
} catch (err) {
  console.error(err);
}

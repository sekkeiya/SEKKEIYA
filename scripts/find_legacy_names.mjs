import fs from 'fs';
import path from 'path';

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, fileList);
    } else if (fullPath.match(/\.(js|jsx|ts|tsx)$/)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const dirs = [
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src',
  'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src'
];

let totalReplaced = 0;

dirs.forEach(d => {
  const files = getFiles(d);
  files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    const orig = content;

    content = content.replace(/\bpublicId\b/g, 'shareId');
    content = content.replace(/\bpublicBoard\b/g, 'sharedProject');
    content = content.replace(/\bPublicBoard\b/g, 'SharedProject');
    content = content.replace(/\bboardsPublic\b/g, 'projectShares');
    content = content.replace(/\bBoardsPublic\b/g, 'ProjectShares');

    if (content !== orig) {
      fs.writeFileSync(f, content, 'utf8');
      console.log('Modified:', f.replace(/\\\\/g, '/'));
      totalReplaced++;
    }
  });
});

console.log('Total files to replace:', totalReplaced);

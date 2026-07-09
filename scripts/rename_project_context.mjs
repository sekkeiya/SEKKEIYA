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

let r = 0;
dirs.forEach(d => {
  const files = getFiles(d);
  files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    const orig = content;

    content = content.replace(/useSelectedBoardContext/g, "useSelectedProjectContext");
    content = content.replace(/SelectedBoardContext/g, "SelectedProjectContext");
    content = content.replace(/SelectedBoardProvider/g, "SelectedProjectProvider");

    content = content.replace(/\bselectedBoard\b/g, "selectedProject");
    content = content.replace(/\bsetSelectedBoard\b/g, "setSelectedProject");
    
    // Also "boardId" contextually ? The user said "boardId and dbBoardType Contextual Cleanup"
    // So modifying `boardId` everywhere mechanically is dangerous, BUT inside useSelectedProjectContext destructuring, we should be fine.
    
    // Also rename isBoardEditMode -> isProjectEditMode
    content = content.replace(/\bisBoardEditMode\b/g, "isProjectEditMode");
    content = content.replace(/\bsetIsBoardEditMode\b/g, "setIsProjectEditMode");

    if (content !== orig) {
      fs.writeFileSync(f, content, 'utf8');
      console.log('Modified:', f.replace(/\\\\/g, '/'));
      r++;
    }
  });
});

console.log('Total context files updated:', r);

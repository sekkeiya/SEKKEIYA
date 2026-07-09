import fs from 'fs';

const filepath = 'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/BoardPageContent.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// Regex to capture the exact broken chunk
const brokenRegex = /\/\* ---------- Tabs のスタイル ---------- \*\/\r?\nconst tabItemSx = \{\r?\n  textTransform: "none",\r?\n  fonmsColRef\(db, projectId\);\r?\n\};\r?\n\r?\n/g;

content = content.replace(brokenRegex, '');

fs.writeFileSync(filepath, content, 'utf8');
console.log('Fixed successfully');

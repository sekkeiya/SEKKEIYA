import fs from 'fs';

const filePath = 'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/firestore.indexes.json';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/"collectionGroup": "boardsPublic"/g, '"collectionGroup": "projectShares"');
content = content.replace(/"collectionGroup": "boards"/g, '"collectionGroup": "projects"');

fs.writeFileSync(filePath, content, 'utf8');
console.log('firestore.indexes.json updated successfully.');

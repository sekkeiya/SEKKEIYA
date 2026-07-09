import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

// ONLY sekkeiya and r3dm-share! NOT 3d-shape-layout!
const r3dmFiles = globSync('c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/**/*.@(js|jsx|ts|tsx)', { ignore: ['**/node_modules/**', '**/dist/**'] });
const sekkeiyaFiles = globSync('c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/**/*.@(js|jsx|ts|tsx)', { ignore: ['**/node_modules/**', '**/dist/**'] });

const files = [...r3dmFiles, ...sekkeiyaFiles];

let changedCount = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  const initial = content;

  // Pattern 1: doc(db, "users", userId, "myBoards", boardId, "models", modelId) -> doc(db, "boards", boardId, "items", modelId)
  content = content.replace(/doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,]+)\s*,\s*["']models(?:_public)?["']\s*,\s*([^)]+)\)/g, 'doc(db, "boards", $2, "items", $3)');
  content = content.replace(/doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,]+)\s*,\s*["']models_private["']\s*,\s*([^)]+)\)/g, 'doc(db, "boards", $2, "items", $3)');

  // Pattern 2: doc(db, "teamBoards", boardId, "models", modelId) -> doc(db, "boards", $1, "items", $2)
  content = content.replace(/doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^,]+)\s*,\s*["']models(?:_public)?["']\s*,\s*([^)]+)\)/g, 'doc(db, "boards", $1, "items", $2)');
  content = content.replace(/doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^,]+)\s*,\s*["']models_private["']\s*,\s*([^)]+)\)/g, 'doc(db, "boards", $1, "items", $2)');

  // Pattern 3: doc(db, "users", uid, "myBoards", boardId, ...rest) -> doc(db, "boards", boardId, ...rest)
  content = content.replace(/doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,)]+)(.*?)\)/g, 'doc(db, "boards", $2$3)');

  // Pattern 4: doc(db, "users", uid, "teamBoards", boardId, ...rest) -> doc(db, "boards", boardId, ...rest)
  content = content.replace(/doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']teamBoards["']\s*,\s*([^,)]+)(.*?)\)/g, 'doc(db, "boards", $2$3)');

  // Pattern 5: doc(db, "teamBoards", boardId, ...rest) -> doc(db, "boards", boardId, ...rest)
  content = content.replace(/doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^,)]+)(.*?)\)/g, 'doc(db, "boards", $1$2)');

  // collection subcollections
  // users/uid/myBoards/boardId/models -> boards/boardId/items
  content = content.replace(/collection\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,]+)\s*,\s*["']models(?:_public|_private)?["']\s*\)/g, 'collection(db, "boards", $2, "items")');
  content = content.replace(/collection\(\s*doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^)]+)\)\s*,\s*["']models(?:_public|_private)?["']\s*\)/g, 'collection(doc(db, "boards", $2), "items")');
  
  content = content.replace(/collection\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^,]+)\s*,\s*["']models(?:_public|_private)?["']\s*\)/g, 'collection(db, "boards", $1, "items")');
  content = content.replace(/collection\(\s*doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^)]+)\)\s*,\s*["']models(?:_public|_private)?["']\s*\)/g, 'collection(doc(db, "boards", $1), "items")');

  // subcollections generic
  content = content.replace(/collection\(\s*doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^)]+)\)\s*(.*?)\)/g, 'collection(doc(db, "boards", $2)$3)');
  content = content.replace(/collection\(\s*doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']teamBoards["']\s*,\s*([^)]+)\)\s*(.*?)\)/g, 'collection(doc(db, "boards", $2)$3)');
  content = content.replace(/collection\(\s*doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^)]+)\)\s*(.*?)\)/g, 'collection(doc(db, "boards", $1)$2)');

  // Top level col
  content = content.replace(/collection\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*\)/g, 'collection(db, "boards")');
  content = content.replace(/collection\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']teamBoards["']\s*\)/g, 'collection(db, "boards")');
  content = content.replace(/collection\(\s*db\s*,\s*["']teamBoards["']\s*\)/g, 'collection(db, "boards")');

  // Collection Groups
  content = content.replace(/collectionGroup\(\s*db\s*,\s*["']myBoards["']\s*\)/g, 'collectionGroup(db, "boards")');
  content = content.replace(/collectionGroup\(\s*db\s*,\s*["']teamBoards["']\s*\)/g, 'collectionGroup(db, "boards")');

  // Any raw reference to "myBoards" as Collection string without arguments
  // This is too broad, I'll restrict to doc/collection.

  if (content !== initial) {
    writeFileSync(file, content);
    console.log('Updated:', file);
    changedCount++;
  }
}
console.log('Total files changed:', changedCount);

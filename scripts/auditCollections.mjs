import fs from 'fs';
import path from 'path';

const collections = [
  "articles",
  "boards",
  "boardsPublic",
  "chats",
  "layoutShares",
  "officialArticles",
  "plans",
  "projects",
  "publicModelIndex",
  "tags",
  "teamBoardInvitations",
  "teamBoards",
  "usernames",
  "users",
  "viewerShares"
];

const results = {};
collections.forEach(c => results[c] = []);

const EXCLUDES = ['node_modules', '.git', 'dist', 'build', '.firebase', 'tmp', '.gemini'];
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.rules', '.md', '.json', '.html'];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDES.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else {
      const ext = path.extname(fullPath);
      if (EXTENSIONS.includes(ext)) {
        scanFile(fullPath);
      }
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  collections.forEach(c => {
    // Check if the collection name appears as a whole word, or within quotes, etc.
    // e.g., "users" or 'users' or `users` or \/users\/
    const regex = new RegExp(`\\b${c}\\b`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Find line number
      const lineStr = content.substring(0, match.index);
      const lineNum = lineStr.split('\n').length;
      results[c].push(`${filePath}:${lineNum}`);
    }
  });
}

const rootDir = process.cwd();
console.log(`Scanning from root: ${rootDir}...`);
scanDir(rootDir);

Object.keys(results).forEach(c => {
  console.log(`\n=== Collection: ${c} (${results[c].length} references) ===`);
  // Print unique files to reduce noise
  const uniqueFiles = [...new Set(results[c].map(r => {
    const lastColon = r.lastIndexOf(':');
    return r.substring(0, lastColon);
  }))];
  uniqueFiles.forEach(f => {
    // Print file path and count within that file
    const count = results[c].filter(r => r.startsWith(f)).length;
    console.log(`  ${f.replace(rootDir, '')} (${count} matches)`);
  });
});

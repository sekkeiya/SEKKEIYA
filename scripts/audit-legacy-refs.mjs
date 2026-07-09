import fs from 'fs';
import path from 'path';

const SEARCH_TERMS = [
  'boards', 'myBoards', 'teamBoards', 'boardId', 'selectedBoard', 'useSelectedBoard',
  '/boards/', '/myBoards/', '/teamBoards/'
];

const REPOS = [
  { name: 'SEKKEIYA', path: 'c:\\Users\\sekkeiya\\02-WebApp\\040-sekkeiya\\sekkeiya\\src' },
  { name: '3DSS', path: 'c:\\Users\\sekkeiya\\02-WebApp\\038-r3dm-share\\r3dm-share\\src' },
  { name: '3DSL', path: 'c:\\Users\\sekkeiya\\02-WebApp\\039-3dshapelayout-web\\3d-shape-layout\\src' },
  { name: '3DSP', path: 'c:\\Users\\sekkeiya\\02-WebApp\\042-3dshapepresents\\3dshapepresents-web\\src' },
  { name: 'Desktop', path: 'c:\\Users\\sekkeiya\\02-WebApp\\040-sekkeiya\\sekkeiya-desktop\\src' }
];

const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'public', 'assets'];
const VALID_EXTS = ['.js', '.jsx', '.ts', '.tsx'];

const results = {};

function scanDir(dir, repoName) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        scanDir(fullPath, repoName);
      }
    } else if (entry.isFile()) {
      if (VALID_EXTS.includes(path.extname(entry.name))) {
        searchFile(fullPath, repoName);
      }
    }
  }
}

function searchFile(filePath, repoName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileMatches = [];

  lines.forEach((line, i) => {
    for (const term of SEARCH_TERMS) {
      if (line.includes(term)) {
        // Exclude common safe terms or comments if we want to be strict,
        // but for now, capture all.
        // Also skip dashboards or keyboards occasionally matching, but JavaScript boundary \b helps.
        // Let's do a simple includes for robust identification.
        fileMatches.push({ lineNum: i + 1, term, lineText: line.trim() });
      }
    }
  });

  if (fileMatches.length > 0) {
    if (!results[repoName]) results[repoName] = [];
    results[repoName].push({ file: filePath, matches: fileMatches });
  }
}

console.log('Starting legacy reference audit...\n');

REPOS.forEach(repo => {
  console.log(`Scanning ${repo.name}...`);
  scanDir(repo.path, repo.name);
});

console.log('\n--- Audit Results ---\n');

let totalMatches = 0;
for (const repoName of Object.keys(results)) {
  console.log(`\n================ ${repoName} ================`);
  const files = results[repoName];
  files.forEach(f => {
    console.log(`\nFile: ${f.file}`);
    f.matches.forEach(m => {
      console.log(`  Line ${m.lineNum} [${m.term}]: ${m.lineText}`);
      totalMatches++;
    });
  });
}

console.log(`\nTotal Legacy References Found: ${totalMatches}`);

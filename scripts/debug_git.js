const { execSync } = require('child_process');
const fs = require('fs');

const repoPath = 'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share';

try {
  const result = execSync('git status', { cwd: repoPath, encoding: 'utf8' });
  fs.writeFileSync('git_status_output.txt', result);
  
  const result2 = execSync('git restore src/features/Dashboard/Main/ModelsList/ModelCardPreview/ModelDetailContent.jsx', { cwd: repoPath, encoding: 'utf8' });
  fs.writeFileSync('git_restore_output.txt', result2 || 'No output from restore');
} catch(e) {
  fs.writeFileSync('git_error.txt', e.stderr || e.toString());
}

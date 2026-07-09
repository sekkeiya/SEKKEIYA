const { execSync } = require('child_process');
const fs = require('fs');
try {
  const content = execSync('git show HEAD:src/features/Dashboard/Main/ModelsList/ModelCardPreview/ModelDetailContent.jsx', { 
    cwd: 'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share',
    encoding: 'utf8', 
    maxBuffer: 1024*1024*10 
  });
  fs.writeFileSync('ModelDetailContent_Rescue.jsx', content);
  console.log("RESCUE SUCCESS");
} catch(e) {
  fs.writeFileSync('rescue_error.txt', e.toString() + '\n' + (e.stderr ? e.stderr.toString() : ''));
  console.log("RESCUE FAILED", e);
}

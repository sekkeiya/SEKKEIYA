const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) {
      replaceInDir(fp);
    } else if (fp.endsWith('.js') || fp.endsWith('.jsx')) {
      let content = fs.readFileSync(fp, 'utf8');
      if (content.includes('@/config/firebase/config')) {
        content = content.replace(/@\/config\/firebase\/config/g, '@/shared/config/firebase');
        fs.writeFileSync(fp, content);
        console.log('Fixed', fp);
      }
    }
  }
}

replaceInDir('./src/shared/api');
replaceInDir('./src/shared/contexts');
replaceInDir('./src/shared/hooks');
if (fs.existsSync('./src/shared/utils')) {
  replaceInDir('./src/shared/utils');
}

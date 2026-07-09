const fs = require('fs');
const file = 'c:/Users/sekkeiya/02-WebApp/042-3dshapepresents/3dshapepresents-web/src/pages/PresentsEditorPage.jsx';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/<\/Box>\s*<\/Box>\s*<\/Box>\s*}\)/, '</Box>\n                 </Box>\n              )}');
fs.writeFileSync(file, code);
console.log('Fixed with regex');

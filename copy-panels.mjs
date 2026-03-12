import fs from 'fs';
fs.mkdirSync('packages/global-panel/src/panels', {recursive: true});
fs.cpSync('src/features/drive', 'packages/global-panel/src/panels/drive', {recursive: true});
fs.cpSync('src/features/chat', 'packages/global-panel/src/panels/chat', {recursive: true});

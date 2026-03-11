const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
    if (!fs.existsSync(from)) return;
    const stats = fs.statSync(from);

    if (stats.isDirectory()) {
        if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });

        fs.readdirSync(from).forEach(childItemName => {
            copyFolderSync(path.join(from, childItemName), path.join(to, childItemName));
        });
    } else {
        fs.copyFileSync(from, to);
    }
}

const targetBase = 'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share';

copyFolderSync('./src/shared/layout/sidebar', path.join(targetBase, 'src/shared/layout/sidebar'));
copyFolderSync('./src/shared/ui', path.join(targetBase, 'src/shared/ui'));
copyFolderSync('./src/assets/icons', path.join(targetBase, 'src/assets/icons'));

console.log("Files copied successfully!");

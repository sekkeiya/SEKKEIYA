const fs = require('fs');
const filepath = 'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/BoardPageContent.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// The regex matches everything from the first "Tabs のスタイル" until the closing brace of the broken object.
// We use \s* to match any kind of whitespace (cr, lf, space).
const regex = /\/\*\s*-+\s*Tabs のスタイル\s*-+\s*\*\/\s*const tabItemSx = \{\s*textTransform:\s*"none",\s*fonmsColRef\(db,\s*projectId\);\s*\};\s*/;

if(regex.test(content)) {
    content = content.replace(regex, '');
    fs.writeFileSync(filepath, content, 'utf8');
    console.log("SUCCESS REPLACE");
} else {
    console.log("NOT FOUND VIA REGEX");
}

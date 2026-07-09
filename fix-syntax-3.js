const fs = require('fs');

const filepath = 'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/BoardPageContent.jsx';
let c = fs.readFileSync(filepath, 'utf8');

const s1 = "/* ---------- Tabs のスタイル ---------- */";
const p1 = c.indexOf(s1);
const p2 = c.indexOf(s1, p1 + 10); // Find the second occurrence

if (p1 !== -1 && p2 !== -1) {
    // Remove everything from the first occurrence to RIGHT BEFORE the second occurrence.
    const newContent = c.substring(0, p1) + c.substring(p2);
    fs.writeFileSync(filepath, newContent, 'utf8');
    console.log("Fixed via substring!");
} else {
    console.log("Could not find two occurrences of Tabs styling marker");
}

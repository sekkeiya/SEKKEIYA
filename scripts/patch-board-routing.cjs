const fs = require('fs');
const path = require('path');

const targetFiles = [
  'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share\\src\\features\\Dashboard\\MyPage\\MyPageBoardModels.jsx',
  'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share\\src\\features\\Dashboard\\Main\\AllBoardsPage\\PublicBoardModelsPage.jsx'
];

targetFiles.forEach(filepath => {
  let content = fs.readFileSync(filepath, 'utf-8');
  
  // Replace the exact function block using a more robust regex that accounts for varying whitespace
  const functionRegex = /const buildModelRouteFromRefPath = \(refPath\) => \{[\s\S]*?return null;\n\};/;
  
  const updatedFunction = `const buildModelRouteFromRefPath = (refPath) => {
  if (!refPath) return null;
  const seg = refPath.split("/");
  if (seg[0] === "models" && seg[1]) return \`/dashboard/models/\${seg[1]}\`;
  if (seg[0] === "projects" && seg[2] === "assets" && seg[3]) return \`/dashboard/models/\${seg[3]}\`;
  if (seg[0] === "users" && seg[1] && seg[2] === "models" && seg[3]) {
    return \`/dashboard/users/\${seg[1]}/models/\${seg[3]}\`;
  }
  return null;
};`;

  if (functionRegex.test(content)) {
    content = content.replace(functionRegex, updatedFunction);
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log('Successfully updated:', path.basename(filepath));
  } else {
    // maybe it's already updated
    if (content.includes('projects" && seg[2] === "assets"')) {
       console.log('Already updated:', path.basename(filepath));
    } else {
       console.warn('Could not find target pattern in:', path.basename(filepath));
    }
  }
});

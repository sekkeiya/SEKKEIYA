const fs = require('fs');
try {
  const path = 'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/BoardPageContent.jsx';
  const content = fs.readFileSync(path, 'utf8');
  let lines = content.split('\n');
  
  // Array splice: remove 6 lines starting from index 212 (which is line 213)
  lines.splice(212, 6);
  
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log("SUCCESS");
} catch(e) {
  console.error("ERROR", e);
}

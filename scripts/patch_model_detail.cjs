const fs = require('fs');
const path = require('path');
const targetFile = path.join('C:\\', 'Users', 'sekkeiya', '02-WebApp', '028-R3DM-ver2', 'r3dm-share', 'src', 'features', 'Dashboard', 'Main', 'ModelsList', 'ModelCardPreview', 'ModelDetailContent.jsx');

let c = fs.readFileSync(targetFile, 'utf8');

c = c.replaceAll('await fetchModelDetail(id);', 'await fetchModelDetail(id, selectedProject?.id);');
c = c.replaceAll('await fetchModelDetail(model.id);', 'await fetchModelDetail(model.id, selectedProject?.id);');
c = c.replaceAll('await fetchModelDetail(targetId);', 'await fetchModelDetail(targetId, selectedProject?.id);');
c = c.replaceAll('await uploadModelImage({ file, userId: userData.uid, modelId: model.id });', 'await uploadModelImage({ file, userId: userData.uid, modelId: model.id, projectId: selectedProject?.id });');

fs.writeFileSync(targetFile, c);
console.log("FINAL PATCH SUCCESSFUL");

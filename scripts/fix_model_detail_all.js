const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoPath = 'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share';
const filePathRelative = 'src/features/Dashboard/Main/ModelsList/ModelCardPreview/ModelDetailContent.jsx';
const targetFile = path.join(repoPath, filePathRelative.replace(/\//g, '\\'));

try {
  // 1. Force checkout the file
  console.log('Checking out file...');
  execSync(`git checkout HEAD -- ${filePathRelative}`, { cwd: repoPath, stdio: 'inherit' });
  
  // 2. Read restored file
  let c = fs.readFileSync(targetFile, 'utf8');

  // 3. Apply exact replacements
  c = c.replace(
      'import { useSelectedCardContext } from "@/shared/contexts/SelectedCardContext";',
      'import { useSelectedCardContext } from "@/shared/contexts/SelectedCardContext";\nimport { useSelectedProjectContext } from "@/shared/contexts/SelectedProjectContext";'
  );

  c = c.replace(
      '  const { selectedCard, setSelectedCard } = useSelectedCardContext();',
      '  const { selectedCard, setSelectedCard } = useSelectedCardContext();\n  const { selectedProject } = useSelectedProjectContext();'
  );

  c = c.replace(
      'const next = await fetchModelDetail(model.id);',
      'const next = await fetchModelDetail(model.id, null, selectedProject?.id);'
  );

  c = c.replace(
      'await uploadModelImage({ file, userId: userData.uid, modelId: model.id });',
      'await uploadModelImage({ file, userId: userData.uid, modelId: model.id, projectId: selectedProject?.id });'
  );

  c = c.replace(
      'const updatedModel = await fetchModelDetail(model.id);',
      'const updatedModel = await fetchModelDetail(model.id, null, selectedProject?.id);'
  );

  c = c.replace(
      'const next = await fetchModelDetail(targetId);',
      'const next = await fetchModelDetail(targetId, null, selectedProject?.id);'
  );

  c = c.replace(
      'const full = await fetchModelDetail(id);',
      'const full = await fetchModelDetail(id, null, selectedProject?.id);'
  );

  // 4. Write back
  fs.writeFileSync(targetFile, c, 'utf8');
  console.log('Restoration and replacements done successfully!');
} catch (e) {
  console.error("Error:", e);
}

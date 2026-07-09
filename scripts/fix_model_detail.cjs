const fs = require('fs');
const path = require('path');

const targetFile = path.join('C:\\', 'Users', 'sekkeiya', '02-WebApp', '028-R3DM-ver2', 'r3dm-share', 'src', 'features', 'Dashboard', 'Main', 'ModelsList', 'ModelCardPreview', 'ModelDetailContent.jsx');

let c = fs.readFileSync(targetFile, 'utf8');

c = c.replace(
    'import { useSelectedCardContext } from "@/shared/contexts/SelectedCardContext";',
    'import { useSelectedCardContext } from "@/shared/contexts/SelectedCardContext";\nimport { useSelectedProjectContext } from "@/shared/contexts/SelectedProjectContext";'
);

c = c.replace(
    '  const { selectedCard, setSelectedCard } = useSelectedCardContext();',
    '  const { selectedCard, setSelectedCard } = useSelectedCardContext();\n  const { selectedProject } = useSelectedProjectContext();'
);

c = c.replace(
    '        const updatedModel = await fetchModelDetail(selectedCard.id);',
    '        const updatedModel = await fetchModelDetail(selectedCard.id, selectedProject?.id);'
);

c = c.replace(
    '      const url = await uploadModelImage(blob, "models", selectedCard.id);',
    '      const url = await uploadModelImage(blob, "models", selectedCard.id, selectedProject?.id);'
);

// One more place for fetchModelDetail inside snapshot loop or similar
c = c.replace(
    '          const updatedModel = await fetchModelDetail(selectedCard.id);',
    '          const updatedModel = await fetchModelDetail(selectedCard.id, selectedProject?.id);'
);

// Add another generic replace globally just in case
c = c.replaceAll('fetchModelDetail(selectedCard.id)', 'fetchModelDetail(selectedCard.id, selectedProject?.id)');
c = c.replaceAll('uploadModelImage(blob, "models", selectedCard.id)', 'uploadModelImage(blob, "models", selectedCard.id, selectedProject?.id)');

fs.writeFileSync(targetFile, c);
console.log("SUCCESSFULLY UPDATED ModelDetailContent.jsx");

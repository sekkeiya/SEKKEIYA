import os
path = r'C:\Users\sekkeiya\02-WebApp\028-R3DM-ver2\r3dm-share\src\features\Dashboard\Main\ModelsList\ModelCardPreview\ModelDetailContent.jsx'

with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    'import { useSelectedCardContext } from "@/shared/contexts/SelectedCardContext";',
    'import { useSelectedCardContext } from "@/shared/contexts/SelectedCardContext";\nimport { useSelectedProjectContext } from "@/shared/contexts/SelectedProjectContext";'
)

c = c.replace(
    '  const { selectedCard, setSelectedCard } = useSelectedCardContext();',
    '  const { selectedCard, setSelectedCard } = useSelectedCardContext();\n  const { selectedProject } = useSelectedProjectContext();'
)

c = c.replace(
    'const next = await fetchModelDetail(model.id);',
    'const next = await fetchModelDetail(model.id, null, selectedProject?.id);'
)

c = c.replace(
    'await uploadModelImage({ file, userId: userData.uid, modelId: model.id });',
    'await uploadModelImage({ file, userId: userData.uid, modelId: model.id, projectId: selectedProject?.id });'
)

c = c.replace(
    'const updatedModel = await fetchModelDetail(model.id);',
    'const updatedModel = await fetchModelDetail(model.id, null, selectedProject?.id);'
)

c = c.replace(
    'const next = await fetchModelDetail(targetId);',
    'const next = await fetchModelDetail(targetId, null, selectedProject?.id);'
)

c = c.replace(
    'const full = await fetchModelDetail(id);',
    'const full = await fetchModelDetail(id, null, selectedProject?.id);'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Replacements done.')

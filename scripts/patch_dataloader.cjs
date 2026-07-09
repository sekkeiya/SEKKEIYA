const fs = require('fs');

const fileReadJs = 'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share\\src\\shared\\api\\models\\read.js';
let codeRead = fs.readFileSync(fileReadJs, 'utf-8');

// Patch 1: Add projectId to destructured args
codeRead = codeRead.replace(
    '    ownerId, // Added ownerId\n}) {',
    '    ownerId, // Added ownerId\n    projectId,\n}) {'
);

// Patch 2: Pass projectId to fetchModelDetail
codeRead = codeRead.replace(
    '            const targetOwnerId = ownerId || userId;\n            const canonicalData = await fetchModelDetail(modelId, targetOwnerId);\n            if (!canonicalData) return null;',
    '            const targetOwnerId = ownerId || userId;\n            const canonicalData = await fetchModelDetail(modelId, targetOwnerId, projectId);\n            if (!canonicalData) return null;'
);

fs.writeFileSync(fileReadJs, codeRead, 'utf-8');
console.log('read.js patched successfully.');

const fileLoader = 'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share\\src\\shared\\layout\\DashboardLayout\\RightSidebar\\EditModelRightSidebar\\hooks\\useModelDataLoader.js';
let codeLoader = fs.readFileSync(fileLoader, 'utf-8');

// Patch 3: Pass projectId in public board fetch
codeLoader = codeLoader.replace(
    '                if (isPublicBoardSource && refPath) {\n                    const data = await fetchModelDetail(modelId, extractedOwnerId);\n                    if (!cancelled && data) {',
    '                if (isPublicBoardSource && refPath) {\n                    const data = await fetchModelDetail(modelId, extractedOwnerId, selectedProject?.id);\n                    if (!cancelled && data) {'
);

// Patch 4: Pass projectId to getModelDataFromFirestore
codeLoader = codeLoader.replace(
    '                    boardType,\n                    ownerId: extractedOwnerId, // IMPORTANT: Pass ownerId to avoid fallback to collectionGroup\n                });',
    '                    boardType,\n                    ownerId: extractedOwnerId, // IMPORTANT: Pass ownerId to avoid fallback to collectionGroup\n                    projectId: selectedProject?.id,\n                });'
);

fs.writeFileSync(fileLoader, codeLoader, 'utf-8');
console.log('useModelDataLoader.js patched successfully.');

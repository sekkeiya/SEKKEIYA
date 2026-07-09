const fs = require('fs');
const path = require('path');
const targetFile = path.join('C:\\', 'Users', 'sekkeiya', '02-WebApp', '028-R3DM-ver2', 'r3dm-share', 'src', 'shared', 'api', 'models', 'crud', 'update.js');

let c = fs.readFileSync(targetFile, 'utf8');

c = c.replace(
    'async function _applyUpdate(args) {\n    const {\n        userId,\n        modelId,\n        field,\n        value,\n        selectedPage,\n        boardId = null,\n        boardType = null,\n    } = args || {};',
    'async function _applyUpdate(args) {\n    const {\n        userId,\n        modelId,\n        projectId,\n        field,\n        value,\n        selectedPage,\n        boardId = null,\n        boardType = null,\n    } = args || {};'
);

c = c.replace(
    '    // 1) users/{uid}/models/{id}\n    const userModelRef = doc(db, "users", userId, "models", modelId);\n    await _safeUpdate(\n        userModelRef,\n        { ...payload, isCanonical: true },\n        { where: "users/<uid>/models/<id>", field, payload }\n    );',
    '    // 1) users/{uid}/models/{id} or projects/{projectId}/assets/{id}\n    const userModelRef = projectId \n        ? doc(db, "projects", projectId, "assets", modelId)\n        : doc(db, "users", userId, "models", modelId);\n    await _safeUpdate(\n        userModelRef,\n        { ...payload, isCanonical: true },\n        { where: projectId ? "projects/<pid>/assets/<id>" : "users/<uid>/models/<id>", field, payload }\n    );'
);

c = c.replace(
    'export async function updateModelDataForOverwrite(userId, modelId, overwriteData) {\n    if (!userId || !modelId || !overwriteData) {\n        throw new Error("[updateModelDataForOverwrite] Missing required arguments");\n    }\n    \n    const userModelRef = doc(db, "users", userId, "models", modelId);',
    'export async function updateModelDataForOverwrite(userId, modelId, overwriteData, projectId) {\n    if (!userId || !modelId || !overwriteData) {\n        throw new Error("[updateModelDataForOverwrite] Missing required arguments");\n    }\n    \n    const userModelRef = projectId \n        ? doc(db, "projects", projectId, "assets", modelId)\n        : doc(db, "users", userId, "models", modelId);'
);

fs.writeFileSync(targetFile, c);
console.log("update.js patched successfully.");

// Let's also patch images.js, delete.js, visibility.js
const patchSimpleRef = (fileName, exportLinePattern, newExportLine, oldRefLine, newRefLine) => {
    const f = path.join('C:\\', 'Users', 'sekkeiya', '02-WebApp', '028-R3DM-ver2', 'r3dm-share', 'src', 'shared', 'api', 'models', 'crud', fileName);
    let fc = fs.readFileSync(f, 'utf8');
    if (exportLinePattern) fc = fc.replace(exportLinePattern, newExportLine);
    fc = fc.replace(oldRefLine, newRefLine);
    fs.writeFileSync(f, fc);
    console.log(fileName + " patched successfully.");
};

// images.js
patchSimpleRef(
    'images.js',
    'export const deleteImageFromUserModel = async (userId, modelId, imageUrl) => {',
    'export const deleteImageFromUserModel = async (userId, modelId, imageUrl, projectId) => {',
    '    const ref = doc(db, "users", userId, "models", modelId);',
    '    const ref = projectId ? doc(db, "projects", projectId, "assets", modelId) : doc(db, "users", userId, "models", modelId);'
);

// delete.js
patchSimpleRef(
    'delete.js',
    'export const deleteModelEntirely = async (userId, modelId) => {',
    'export const deleteModelEntirely = async (userId, modelId, projectId) => {',
    '    const userModelRef = doc(db, "users", userId, "models", modelId);',
    '    const userModelRef = projectId ? doc(db, "projects", projectId, "assets", modelId) : doc(db, "users", userId, "models", modelId);'
);

// visibility.js
patchSimpleRef(
    'visibility.js',
    'export const applyVisibilityToModel = async (userId, modelId, visibility) => {',
    'export const applyVisibilityToModel = async (userId, modelId, visibility, projectId) => {',
    '    const userModelRef = doc(db, "users", userId, "models", modelId);',
    '    const userModelRef = projectId ? doc(db, "projects", projectId, "assets", modelId) : doc(db, "users", userId, "models", modelId);'
);

console.log("ALL DONE.");

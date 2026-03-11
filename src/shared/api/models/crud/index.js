// src/utils/services/models/crud/index.js
// 3D Shape Share - models CRUD barrel (single entry point)

// ---- Named re-exports (tree-shakeable) ----
export * from "./save";
export * from "./update";
export * from "./delete";
export * from "./fetch";
export * from "./visibility";
export * from "./images";
export * from "./utils";

// read.js は crud/ の外にあるため明示ブリッジ
export { getModelDataFromFirestore } from "../read";

// ---- Default namespace (optional/backward-friendly) ----
import * as save from "./save";
import * as update from "./update";
import * as del from "./delete";
import * as fetchMod from "./fetch";
import * as visibility from "./visibility";
import * as images from "./images";
import * as utils from "./utils";
import { getModelDataFromFirestore as _getModelDataFromFirestore } from "../read";

const crud = {
    ...save,
    ...update,
    ...del,
    ...fetchMod,
    ...visibility,
    ...images,
    ...utils,
    getModelDataFromFirestore: _getModelDataFromFirestore,
};

export default crud;

import { normalizeFilterPayload } from "./normalizeFilterPayload";

export function executeAIAction(actionInput, context, storeActions) {
  const actions = Array.isArray(actionInput) ? actionInput : [actionInput];

  actions.forEach(action => {
    if (!action) return;
    const { id, type, payload } = action;

    console.log(`[AI Action] ${type}`, payload, context, `(ActionID: ${id})`);

    switch (type) {
      case "applyFilters":
        if (storeActions?.applyFilters) {
          const rawPayload = payload || {};
          
          // Safety layer: if AI omitted specific category words but user explicitly searched them, inject query for normalization
          if (context?.userQuery && !rawPayload.query) {
             rawPayload.query = context.userQuery;
          }
          console.log("[AI Raw Actions] applyFilters payload:", rawPayload);

          const normalized = normalizeFilterPayload(rawPayload);
          
          // Convert normalized payload (type, mainCategory, subCategory) into Dashboard filter format
          const dashboardFilters = {};
          if (normalized.type) dashboardFilters.type = normalized.type;
          
          // Map taxonomy grouping to Dashboard UI expectations (mainCategory / subCategory arrays)
          if (normalized.mainCategory) {
            dashboardFilters.mainCategory = Array.isArray(normalized.mainCategory) ? normalized.mainCategory : [normalized.mainCategory];
          }
          if (normalized.subCategory) {
            dashboardFilters.subCategory = Array.isArray(normalized.subCategory) ? normalized.subCategory : [normalized.subCategory];
          }
          if (normalized.maxPrice !== undefined) dashboardFilters.maxPrice = normalized.maxPrice;

          // Preserve any other safe filters
          Object.assign(dashboardFilters, {
            ...normalized,
            mainCategory: dashboardFilters.mainCategory, // overwrite string with the array properly
            subCategory: dashboardFilters.subCategory,
            groupLabel: undefined,
            subLabel: undefined,
          });

          // Clean up undefined properties
          Object.keys(dashboardFilters).forEach(key => {
            if (dashboardFilters[key] === undefined) {
              delete dashboardFilters[key];
            }
          });

          console.log(`[AI Action] applyFilters normalized:`, dashboardFilters);
          storeActions.applyFilters(dashboardFilters);
        } else {
          console.warn("[AI Action] applyFilters not available in dashboardActions.");
        }
        break;

      case "searchModels":
        if (storeActions?.searchModels) {
          storeActions.searchModels(payload);
        } else {
          console.warn("[AI Action] searchModels not available in dashboardActions.");
        }
        break;

      case "addModelToBoard":
        if (storeActions?.addModelToBoard) {
          storeActions.addModelToBoard({
            ...payload,
            boardId: payload.boardId || context?.boardId
          });
        } else {
          console.warn("[AI Action] addModelToBoard not available in dashboardActions.");
        }
        break;

      case "openBoard":
        if (storeActions?.openBoard) {
          storeActions.openBoard(payload.boardId || context?.boardId);
        } else {
          console.warn("[AI Action] openBoard not available in dashboardActions.");
        }
        break;

      case "clearSimilarTo":
        if (storeActions?.applyFilters) {
          storeActions.applyFilters({ similarTo: null });
        }
        break;
        
      case "resetFilters":
        if (storeActions?.resetFilters) {
          storeActions.resetFilters();
        }
        break;

      default:
        console.warn("[AI Action] Unknown AI action:", type);
    }
  });
}

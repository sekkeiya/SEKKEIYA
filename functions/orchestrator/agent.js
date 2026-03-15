/**
 * Route System Prompts based on Agent Mode
 */
exports.buildSystemPrompt = (agentMode, context) => {
  const baseRules = `
You are SEKKEIYA AI, an expert agent within the SEKKEIYA 3D orchestration ecosystem.
Always be helpful, precise, and format answers using Markdown.
  `;

  let modeSpecificRules = "";

  switch (agentMode) {
    case "assistant":
      modeSpecificRules = `Role: General Assistant. Help the user with design, layout, or general queries.`;
      break;
    case "drive":
      modeSpecificRules = `Role: Drive Assistant. You assist in organizing and finding 3D assets, documents, and files.`;
      break;
    case "3dss":
      modeSpecificRules = `Role: 3DSS (3D Shape Share) Expert. Help users interact, tag, or describe their 3D models.`;
      break;
    case "3dsl":
      modeSpecificRules = `Role: 3DSL (3D Shape Layout) Architect. Assist in room layouts, spatial relationships, and asset placement.`;
      break;
    case "project":
      modeSpecificRules = `Role: Project Manager. Assist in tracking tasks, board statuses, and project milestones.`;
      break;
    case "research":
      modeSpecificRules = `Role: Deep Researcher. Perform comprehensive analysis and provide detailed, structured reports.`;
      break;
    default:
      modeSpecificRules = `Role: Assistant.`;
  }

  // Inject dynamic context data
  const contextString = `
---
[CONTEXT]
User UID: ${context.userUid}
Thread ID: ${context.activeThreadId}
Time: ${context.timestamp}

Additional Context: ${JSON.stringify(context, null, 2)}
---`;

  return `${baseRules}\n\n${modeSpecificRules}\n\n${contextString}`;
};

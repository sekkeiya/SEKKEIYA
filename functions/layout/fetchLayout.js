const { HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const admin = require("firebase-admin");

// 定数ファイルと同等の定義をハードコード
const ALLOWED_MODELS = ['gemini-2.5-flash', 'gemini-pro-latest', 'gemini-2.5-pro'];
const PLAN_ALLOWED_MODELS = {
  free: ['gemini-2.5-flash'],
  pro: ['gemini-2.5-flash', 'gemini-pro-latest'],
  enterprise: ['gemini-2.5-flash', 'gemini-pro-latest', 'gemini-2.5-pro'],
};

/**
 * Helper to initialize GenAI client inside a function
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

exports.fetchLayout = async (data, context) => {
  if (!context || !context.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const { zoneDimensions, selectedAssets, obstacles } = data;
  let requestedModel = data.model;

  if (!zoneDimensions || !selectedAssets || !Array.isArray(selectedAssets)) {
    throw new HttpsError("invalid-argument", "Missing required fields: zoneDimensions, selectedAssets");
  }

  if (!ALLOWED_MODELS.includes(requestedModel)) {
    requestedModel = 'gemini-2.5-flash';
  }

  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  try {
    const userSnap = await db.collection('users').doc(context.auth.uid).get();
    let plan = 'free';
    if (userSnap.exists && userSnap.data().plan) {
      plan = userSnap.data().plan;
    }

    const permitted = PLAN_ALLOWED_MODELS[plan] || PLAN_ALLOWED_MODELS.free;
    if (!permitted.includes(requestedModel)) {
      throw new HttpsError("permission-denied", `Model ${requestedModel} is not allowed for plan ${plan}.`);
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.warn("Failed to check plan:", err);
    if (!PLAN_ALLOWED_MODELS.free.includes(requestedModel)) {
      throw new HttpsError("permission-denied", "Model not allowed for default plan.");
    }
  }

  try {
    const genAI = getGeminiClient();

    const schema = {
        type: SchemaType.ARRAY,
        description: "List of layout placement rules for the given assets in the room.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            targetId: {
                type: SchemaType.STRING,
                description: "The unique ID of the asset being placed (must exist in selectedAssets).",
            },
            position: {
                type: SchemaType.STRING,
                description: "The semantic spatial position. E.g., 'center', 'wall', 'corner', 'custom'.",
            },
            relation: {
                type: SchemaType.STRING,
                description: "If placing relative to another object, define relation string. E.g. 'around [assetId]', 'next-to [assetId]'. Otherwise omit.",
                nullable: true,
            },
            count: {
                type: SchemaType.INTEGER,
                description: "The number of instances to apply this specific rule to. Must not exceed the total quantity allocated in selectedAssets.",
            },
            facing: {
                type: SchemaType.STRING,
                description: "Semantic direction. E.g., 'inward', 'outward', 'wall', 'entrance'.",
                nullable: true,
            }
          },
          required: ["targetId", "position", "count"],
        },
    };

    const model = genAI.getGenerativeModel({
      model: requestedModel,
      systemInstruction: `You are an expert interior space planner.
You will be given a room's dimensions and a pre-selected list of furniture assets with their quantities.
Your task is to assign each furniture item a semantic layout rule describing WHERE and HOW to place it within the room.
DO NOT OUTPUT X/Z COORDINATES. Output strictly semantic locations (e.g. 'center', 'wall') and relationships (e.g. 'around table_A').
Ensure the rules logically match the type of furniture (e.g., chairs should usually be 'around' a table, a shelf should be on a 'wall').
Output must exactly match the required JSON schema array.`,
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema
      }
    });

    const assetsSummary = selectedAssets.map(a => 
        `- Asset ID: ${a.assetId}, Quantity to place: ${a.quantity}`
    ).join("\n");

    const obstaclesSummary = obstacles && obstacles.length > 0 
        ? JSON.stringify(obstacles)
        : "None";

    const promptText = `
Room Dimensions:
Width (X): ${zoneDimensions.width} mm
Depth (Z): ${zoneDimensions.depth} mm

Assets to place:
${assetsSummary}

Existing Obstacles:
${obstaclesSummary}

Based on these constraints, generate layout instructions for ALL items in 'Assets to place'. Ensure the sum of 'count' across rules for a given targetId equals its target quantity.
`;

    const result = await model.generateContent(promptText);
    const responseText = result.response.text();
    const layoutRules = JSON.parse(responseText);

    return { success: true, layoutRules };

  } catch (error) {
    console.error("Failed to generate layout rules:", error);
    throw new HttpsError("internal", error.message || "Failed to generate layout rules");
  }
};

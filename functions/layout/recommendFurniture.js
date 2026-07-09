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

exports.recommendFurniture = async (data, context) => {
  // context.auth check if required (usually it is for internal tools)
  if (!context || !context.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const { zonePurpose, areaSqm, targetSeats, availableAssets } = data;
  let requestedModel = data.model;

  if (!zonePurpose || !availableAssets || !Array.isArray(availableAssets)) {
    throw new HttpsError("invalid-argument", "Missing required fields: zonePurpose, availableAssets");
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
        description: "List of recommended furniture to fulfill the zone purpose.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            assetId: {
              type: SchemaType.STRING,
              description: "The unique ID of the asset from the provided availableAssets list.",
            },
            quantity: {
              type: SchemaType.INTEGER,
              description: "The number of items of this asset to place in the zone.",
            },
          },
          required: ["assetId", "quantity"],
        },
    };

    const model = genAI.getGenerativeModel({
      model: requestedModel,
      systemInstruction: `You are an expert interior designer and space planner. 
Your task is to recommend a list of furniture items from a specific catalog to fulfill a defined zone purpose.
You must adhere strictly to the target capacity (targetSeats) and ensure the selected items fit within the given area (areaSqm) gracefully without overcrowding.
Select ONLY from the provided array of available assets. Do not hallucinate asset IDs. Output exactly according to the required JSON schema.`,
      generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema
      }
    });

    // We only provide a summary of the assets to reduce token length.
    const assetSummary = availableAssets.map(a => 
      `ID: ${a.id}, Title: ${a.title}, Category: ${a.category}, Size: ${a.width}x${a.depth}x${a.height}mm`
    ).join("\n");

    const promptText = `
Zone Purpose: ${zonePurpose}
Area (sq meters): ${areaSqm}
Target Seats: ${targetSeats || "Not specified"}

Available Assets:
${assetSummary}

Based on these requirements, which assets from the 'Available Assets' list should be used, and how many of each?
Return the results in the required JSON array format.
`;

    const result = await model.generateContent(promptText);
    const responseText = result.response.text();
    const recommendations = JSON.parse(responseText);

    return { success: true, recommendations };

  } catch (error) {
    console.error("Failed to recommend furniture:", error);
    throw new HttpsError("internal", error.message || "Failed to recommend furniture");
  }
};

const { GoogleGenAI } = require("@google/genai");
const { SHOPIEE_SYSTEM_PROMPT } = require("./ai.prompts");
const { functionDeclarations, toolExecutors, cleanSearchQuery } = require("./ai.tools");

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

function getModelName() {
  return process.env.GEMINI_MODEL || "gemini-1.5-flash";
}

/**
 * Fast keyword fallback search when Gemini API Key is unconfigured
 */
async function fallbackSearch(userMessage) {
  let cleanMsg = userMessage.toLowerCase().trim();

  // Strip common conversational filler prefixes
  const fillerRegex = /^(can you\s+)?(show me|find|looking for|i want|search for|display|get me|do you have)\s+/i;
  cleanMsg = cleanMsg.replace(fillerRegex, "").trim();
  
  // Extract potential category keywords
  const categories = ["audio", "electronics", "gaming", "cameras", "wearables", "accessories"];
  const matchedCategory = categories.find((cat) => cleanMsg.includes(cat));

  // If search query is still multi-word, try individual key terms if full query yields 0
  let searchResult = await toolExecutors.searchProducts({
    query: cleanMsg,
    category: matchedCategory ? matchedCategory.charAt(0).toUpperCase() + matchedCategory.slice(1) : undefined
  });

  if ((!searchResult.products || searchResult.products.length === 0) && cleanMsg.includes(" ")) {
    const words = cleanMsg.split(/\s+/).filter((w) => w.length > 3);
    for (const word of words) {
      const retryResult = await toolExecutors.searchProducts({ query: word });
      if (retryResult.products && retryResult.products.length > 0) {
        searchResult = retryResult;
        break;
      }
    }
  }

  const products = searchResult.products || [];
  let reply = "";

  if (products.length > 0) {
    reply = `I found ${products.length} product(s) matching your request in our catalog! Take a look below:`;
  } else {
    reply = "I couldn't find any products matching that specific term. Would you like to browse our popular categories like Audio, Electronics, or Gaming?";
  }

  return {
    reply,
    products,
    source: "local-fallback"
  };
}

/**
 * Main AI Chat Orchestration Engine
 */
async function processChatMessage({ message, history = [], user = null }) {
  if (!message || typeof message !== "string") {
    throw new Error("Message is required.");
  }

  const client = getGenAIClient();

  // 1. Fallback if no Gemini API Key is configured
  if (!client) {
    console.log("[AI Service] GEMINI_API_KEY not configured. Running fallback local search.");
    return fallbackSearch(message);
  }

  const modelName = getModelName();
  let collectedProducts = [];

  try {
    // 2. Prepare conversation contents
    const contents = [];

    // Add previous history turns if provided (max 4 turns to conserve tokens)
    if (Array.isArray(history) && history.length > 0) {
      const recentHistory = history.slice(-4);
      for (const turn of recentHistory) {
        if (turn.role && turn.text) {
          contents.push({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{ text: turn.text }]
          });
        }
      }
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // 3. Initial generation request with function declarations
    const response = await client.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: SHOPIEE_SYSTEM_PROMPT,
        temperature: 0.3,
        tools: [{ functionDeclarations }]
      }
    });

    // 4. Check if Gemini requested a function call
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCallPart = parts.find((p) => p.functionCall);

    if (functionCallPart && functionCallPart.functionCall) {
      const { name, args } = functionCallPart.functionCall;
      console.log(`[AI Service] Executing tool: ${name} with args:`, JSON.stringify(args));

      let functionResult = { error: `Function ${name} not found` };
      if (typeof toolExecutors[name] === "function") {
        functionResult = await toolExecutors[name](args);
        if (functionResult && Array.isArray(functionResult.products)) {
          collectedProducts = functionResult.products;
        } else if (functionResult && functionResult.id) {
          collectedProducts = [functionResult];
        }
      }

      // 5. Send function execution output back to Gemini for conversational summarization
      contents.push(candidate.content); // Model's tool call turn
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name,
              response: functionResult
            }
          }
        ]
      });

      const followUpResponse = await client.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: SHOPIEE_SYSTEM_PROMPT,
          temperature: 0.3
        }
      });

      const finalReply =
        followUpResponse.text ||
        followUpResponse.candidates?.[0]?.content?.parts?.[0]?.text ||
        (collectedProducts.length > 0 ? "Here are the top products I found for you in our catalog:" : "I searched our store but couldn't find items matching that exact criteria. Here are our popular picks:");

      // Safety check: If tool executed with 0 results, run fallback search to ensure user gets relevant cards
      if (collectedProducts.length === 0) {
        const autoAttached = await toolExecutors.searchProducts({ query: message });
        if (autoAttached && Array.isArray(autoAttached.products)) {
          collectedProducts = autoAttached.products;
        }
      }

      return {
        reply: finalReply,
        products: collectedProducts,
        source: "gemini-function-calling"
      };
    }

    // 6. Direct conversational response (no tool was called by model)
    const directReply =
      response.text ||
      parts.find((p) => p.text)?.text ||
      "How can I assist you with Shopiee products today?";

    // If direct reply hints at finding products, or message is clearly shopping intent, attach matching products
    const cleanedTerms = cleanSearchQuery(message);
    if (cleanedTerms && cleanedTerms.length >= 3) {
      const autoAttached = await toolExecutors.searchProducts({ query: message });
      if (autoAttached && Array.isArray(autoAttached.products) && autoAttached.products.length > 0) {
        collectedProducts = autoAttached.products;
      }
    }

    return {
      reply: directReply,
      products: collectedProducts,
      source: "gemini-direct"
    };
  } catch (err) {
    console.error("[AI Service Error]:", err.message);
    // Graceful fallback to catalog search on API error
    return fallbackSearch(message);
  }
}

module.exports = {
  processChatMessage,
  fallbackSearch,
  getGenAIClient,
  getModelName
};

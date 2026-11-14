const { GoogleGenAI } = require("@google/genai");
const { buildSystemPrompt } = require("./ai.prompts");
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
 * Fast keyword fallback search when Gemini API Key is unconfigured or encounters an error
 */
async function fallbackSearch(userMessage, user = null) {
  const lowerMsg = (userMessage || "").toLowerCase().trim();

  // 1. Personal Order Tracking Intent
  if (
    lowerMsg.includes("order") ||
    lowerMsg.includes("track") ||
    lowerMsg.includes("package") ||
    lowerMsg.includes("delivery") ||
    lowerMsg.includes("shipment")
  ) {
    if (!user || !(user.id || user._id)) {
      return {
        reply: "To check and track your personal orders, please log in to your Shopiee account first!",
        products: [],
        source: "local-auth-guard"
      };
    }

    const orderRes = await toolExecutors.getMyOrders({}, user);
    if (orderRes.orders && orderRes.orders.length > 0) {
      const topOrder = orderRes.orders[0];
      const itemsList = topOrder.items.join(", ");
      return {
        reply: `Hi ${user.name || "there"}! Your recent order (#${topOrder.orderId}) is currently marked as "${topOrder.status}". Items: ${itemsList}. Total: ₹${topOrder.totalAmount?.toLocaleString("en-IN")}.`,
        products: [],
        source: "local-order-lookup"
      };
    } else {
      return {
        reply: `Hi ${user.name || "there"}! You don't have any active orders right now. Would you like to check out our latest arrivals?`,
        products: [],
        source: "local-order-lookup"
      };
    }
  }

  // 2. Product Search Intent
  const searchResult = await toolExecutors.searchProducts({ query: userMessage });
  const products = searchResult.products || [];

  let reply = "";
  if (products.length > 0) {
    const greeting = user?.name ? `Hi ${user.name}! ` : "";
    reply = `${greeting}Here are the top products I found for you in our catalog. Tap any card below to view specifications and add to your bag:`;
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
    return fallbackSearch(message, user);
  }

  const modelName = getModelName();
  const systemInstruction = buildSystemPrompt(user);
  let collectedProducts = [];

  try {
    // 2. Prepare conversation contents
    const contents = [];

    // Add recent history turns if provided (max 4 turns to conserve tokens)
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
        systemInstruction,
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
        functionResult = await toolExecutors[name](args, user);
        if (functionResult && Array.isArray(functionResult.products)) {
          collectedProducts = functionResult.products;
        } else if (functionResult && functionResult.id) {
          collectedProducts = [functionResult];
        }
      }

      // 5. Send function execution output back to Gemini for conversational summarization
      contents.push(candidate.content);
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
          systemInstruction,
          temperature: 0.3
        }
      });

      const finalReply =
        followUpResponse.text ||
        followUpResponse.candidates?.[0]?.content?.parts?.[0]?.text ||
        (collectedProducts.length > 0
          ? "Here are the top products I found for you in our catalog:"
          : "I searched our store but couldn't find items matching that exact criteria.");

      // Safety check: If tool executed with 0 results or query was shopping related, attach relevant products
      if (collectedProducts.length === 0 && name === "searchProducts") {
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
      "How can I assist your shopping today?";

    // If direct reply hints at finding products, or message is shopping intent, attach matching products
    const lowerDirect = directReply.toLowerCase();
    const isShoppingQuery =
      lowerDirect.includes("found") ||
      lowerDirect.includes("product") ||
      lowerDirect.includes("recommend") ||
      lowerDirect.includes("here are") ||
      lowerDirect.includes("check out") ||
      cleanSearchQuery(message).length >= 2;

    if (isShoppingQuery) {
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
    // Graceful fallback to local catalog search on API error
    return fallbackSearch(message, user);
  }
}

module.exports = {
  processChatMessage,
  fallbackSearch,
  getGenAIClient,
  getModelName
};

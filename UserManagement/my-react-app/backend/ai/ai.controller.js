const { processChatMessage } = require("./ai.service");

/**
 * Handle AI Shopping Assistant Chat Requests
 * POST /api/ai/chat
 */
async function handleChat(req, res) {
  const { message, history } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      success: false,
      message: "A non-empty message string is required."
    });
  }

  // Prevent denial of service with excessively long prompts
  if (message.length > 500) {
    return res.status(400).json({
      success: false,
      message: "Message exceeds maximum allowed length of 500 characters."
    });
  }

  try {
    const result = await processChatMessage({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      user: req.user || null
    });

    return res.status(200).json({
      success: true,
      reply: result.reply,
      products: result.products || [],
      source: result.source,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[AI Controller] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while communicating with the shopping assistant."
    });
  }
}

module.exports = {
  handleChat
};


import { API_URL } from "../config/api";

/**
 * Send message to Shopiee AI Shopping Assistant
 * @param {string} message - User question or query
 * @param {Array} history - Previous turns [{ role: "user"|"assistant", text: string }]
 */
export async function sendChatMessage(message, history = []) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      history: history.slice(-4)
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to get response from AI assistant");
  }

  return data;
}


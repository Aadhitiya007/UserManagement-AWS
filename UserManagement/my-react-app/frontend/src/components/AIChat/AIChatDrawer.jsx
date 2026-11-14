import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Bot, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProductCardMini from "./ProductCardMini";
import OrderCardMini from "./OrderCardMini";
import { sendChatMessage } from "../../services/aiService";

let messageSeq = 0;
function nextMessageId(prefix) {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

const QUICK_PROMPTS = [
  "🎧 Wireless headphones under ₹3,000",
  "⚡ Best mechanical keyboards",
  "📦 What is the status of my order?",
  "🔥 Show top discounts today"
];

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getChatKey(user) {
  const uid = user?.id || user?._id || user?.userId;
  return uid ? `shopiee_ai_chat_${uid}` : "shopiee_ai_chat_guest";
}

function getInitialMessage(user) {
  const name = user?.name ? user.name.split(" ")[0] : null;
  return {
    id: "welcome",
    role: "assistant",
    text: name
      ? `👋 Hi ${name}! I'm your personal Shopiee assistant. Ask me anything about our products, recommendations, deals, or your orders!`
      : "👋 Hi! I'm Shopiee Concierge, your AI shopping assistant. Ask me anything about our products, deals, specs, or your orders!",
    products: [],
    orders: []
  };
}

function cleanAssistantText(rawText, hasCards = false) {
  if (!rawText) return "";
  let text = rawText;

  // If structured cards are already rendered, strip raw listed order lines from the prose
  if (hasCards) {
    text = text.replace(/^\d+\.\s*\*\*Order\s*#[^*]+\*\*[^\n]*/gim, "");
    text = text.replace(/Here is the complete list of your recent orders[^\n]*:/i, "Here are your recent orders from your account:");
  }

  // Remove raw pipes, bold asterisks, and markdown hashes
  text = text.replace(/\|\s*\*\*Status:\*\*\s*/gi, " • Status: ");
  text = text.replace(/\|\s*\*\*Total:\*\*\s*/gi, " • Total: ");
  text = text.replace(/\|\s*/g, " • ");
  text = text.replace(/\*\*/g, "");
  text = text.replace(/^#+\s*/gm, "");

  // Clean extra blank lines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function loadUserMessages(user) {
  const key = getChatKey(user);
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore parse error
  }
  return [getInitialMessage(user)];
}

export default function AIChatDrawer() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(getStoredUser);
  const [messages, setMessages] = useState(() => loadUserMessages(getStoredUser()));

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Synchronize when active user changes (Login, Logout, Account Switch across tabs or windows)
  useEffect(() => {
    const syncUser = () => {
      const latestUser = getStoredUser();
      const currentUid = currentUser?.id || currentUser?._id;
      const latestUid = latestUser?.id || latestUser?._id;

      if (currentUid !== latestUid) {
        setCurrentUser(latestUser);
        setMessages(loadUserMessages(latestUser));
      }
    };

    window.addEventListener("storage", syncUser);
    window.addEventListener("auth:logout", syncUser);
    window.addEventListener("focus", syncUser);

    const interval = setInterval(syncUser, 1200);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("auth:logout", syncUser);
      window.removeEventListener("focus", syncUser);
      clearInterval(interval);
    };
  }, [currentUser]);

  // Persist messages in isolated user-specific storage key
  useEffect(() => {
    const key = getChatKey(currentUser);
    try {
      localStorage.setItem(key, JSON.stringify(messages));
    } catch {
      // ignore storage errors
    }
  }, [messages, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage = {
      id: nextMessageId("user"),
      role: "user",
      text: query
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Extract recent turns for conversational context
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, text: m.text }));

    try {
      const data = await sendChatMessage(query, history);

      const assistantMessage = {
        id: nextMessageId("ai"),
        role: "assistant",
        text: data.reply || "Here is what I found for you:",
        products: data.products || [],
        orders: data.orders || []
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId("err"),
          role: "assistant",
          text: "⚠️ Sorry, I ran into an issue connecting to the assistant. Please try asking again in a moment.",
          products: [],
          orders: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    const key = getChatKey(currentUser);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    setMessages([getInitialMessage(currentUser)]);
  };

  const handleProductSelect = (product) => {
    const id = product.id || product.productId || product._id;
    if (id) {
      setIsOpen(false);
      navigate(`/products/${id}`);
    }
  };

  const handleOrderSelect = () => {
    setIsOpen(false);
    navigate("/orders");
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Shopping Assistant"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            background: "linear-gradient(135deg, #FF7043 0%, #E64A19 100%)",
            color: "#ffffff",
            border: "none",
            borderRadius: "50px",
            boxShadow: "0 8px 24px rgba(230, 74, 25, 0.4)",
            cursor: "pointer",
            fontWeight: "700",
            fontSize: "0.9rem",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            fontFamily: "var(--font-sans, system-ui, sans-serif)"
          }}
          className="ai-floating-btn"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px) scale(1.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
          }}
        >
          <Sparkles size={18} />
          <span>Ask AI</span>
        </button>
      )}

      {/* Floating Chat Drawer / Panel */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            width: "380px",
            maxWidth: "calc(100vw - 32px)",
            height: "580px",
            maxHeight: "calc(100vh - 48px)",
            background: "var(--color-bg-base, #0f172a)",
            border: "1px solid var(--color-border, #334155)",
            borderRadius: "18px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "var(--font-sans, system-ui, sans-serif)"
          }}
          className="ai-chat-drawer"
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: "var(--color-bg-surface, #1e293b)",
              borderBottom: "1px solid var(--color-border, #334155)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #FF7043, #E64A19)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff"
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--color-text-primary, #f8fafc)" }}>
                  Shopiee Concierge
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.72rem", color: "#10b981" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                  <span>
                    {currentUser?.name
                      ? `Personal Assistant for ${currentUser.name.split(" ")[0]} • Private Chat`
                      : "Online • Private & Secure"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={handleClear}
                title="Clear My Chat"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-secondary, #94a3b8)",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px"
                }}
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text-secondary, #94a3b8)",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px"
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
          >
            {messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    maxWidth: "100%"
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "10px 14px",
                      borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      background: isUser
                        ? "linear-gradient(135deg, #FF7043, #E64A19)"
                        : "var(--color-bg-surface, #1e293b)",
                      color: isUser ? "#ffffff" : "var(--color-text-primary, #f8fafc)",
                      fontSize: "0.88rem",
                      lineHeight: "1.45",
                      border: isUser ? "none" : "1px solid var(--color-border, #334155)",
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {isUser
                      ? m.text
                      : cleanAssistantText(
                          m.text,
                          (Array.isArray(m.orders) && m.orders.length > 0) ||
                            (Array.isArray(m.products) && m.products.length > 0)
                        )}
                  </div>

                  {/* Render Interactive Order Cards when attached */}
                  {Array.isArray(m.orders) && m.orders.length > 0 && (
                    <div style={{ width: "100%", marginTop: "8px" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          color: "var(--color-text-secondary, #94a3b8)",
                          marginBottom: "4px"
                        }}
                      >
                        Your Orders ({m.orders.length}) - Tap to track:
                      </div>
                      {m.orders.map((ord) => (
                        <OrderCardMini
                          key={ord.orderId || ord._id}
                          order={ord}
                          onSelect={handleOrderSelect}
                        />
                      ))}
                    </div>
                  )}

                  {/* Render Interactive Product Cards when attached */}
                  {Array.isArray(m.products) && m.products.length > 0 && (
                    <div style={{ width: "100%", marginTop: "8px" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          color: "var(--color-text-secondary, #94a3b8)",
                          marginBottom: "4px"
                        }}
                      >
                        Recommended from catalog ({m.products.length}) - Tap to view:
                      </div>
                      {m.products.map((prod) => (
                        <ProductCardMini
                          key={prod.id || prod.productId}
                          product={prod}
                          onSelect={handleProductSelect}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 14px",
                  background: "var(--color-bg-surface, #1e293b)",
                  border: "1px solid var(--color-border, #334155)",
                  borderRadius: "16px 16px 16px 4px"
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#FF7043",
                    animation: "dotPulse 1.2s infinite ease-in-out"
                  }}
                />
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#FF7043",
                    animation: "dotPulse 1.2s infinite ease-in-out 0.2s"
                  }}
                />
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#FF7043",
                    animation: "dotPulse 1.2s infinite ease-in-out 0.4s"
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #94a3b8)", marginLeft: "4px" }}>
                  Searching catalog...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts (visible when few messages) */}
          {messages.length <= 2 && !loading && (
            <div
              style={{
                padding: "8px 14px",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                borderTop: "1px solid var(--color-border, #334155)",
                background: "var(--color-bg-surface, #1e293b)"
              }}
            >
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "5px 10px",
                    borderRadius: "20px",
                    background: "var(--color-bg-base, #0f172a)",
                    border: "1px solid var(--color-border, #334155)",
                    color: "var(--color-text-primary, #f8fafc)",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#FF7043";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--color-border, #334155)";
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--color-bg-surface, #1e293b)",
              borderTop: "1px solid var(--color-border, #334155)",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about products, orders, deals..."
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--color-border, #334155)",
                background: "var(--color-bg-base, #0f172a)",
                color: "var(--color-text-primary, #f8fafc)",
                fontSize: "0.85rem",
                outline: "none"
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                border: "none",
                background: !input.trim() || loading ? "var(--color-border, #334155)" : "linear-gradient(135deg, #FF7043, #E64A19)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                flexShrink: 0
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Global pulse animation keyframes */}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </>
  );
}

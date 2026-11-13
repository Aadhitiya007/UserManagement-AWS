import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { API_URL, WEBSOCKET_URL } from "../config/api";

/**
 * Universal Real-Time Hook supporting:
 * 1. AWS API Gateway WebSocket API (wss://...)
 * 2. Local Socket.io (http://localhost:5000)
 * 3. Quiet Background Interval Polling (Serverless Fallback)
 *
 * @param {Object} handlers - Map of event names to callbacks, e.g. { newOrder: fn, orderStatusUpdated: fn }
 * @param {Function} fallbackPollFn - Optional function to call on quiet fallback interval
 */
export function useRealtime(handlers = {}, fallbackPollFn = null) {
  const wsRef = useRef(null);
  const socketRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let isCleanedUp = false;

    // 1. Check if AWS API Gateway WebSocket URL is configured
    if (WEBSOCKET_URL && WEBSOCKET_URL.startsWith("wss://")) {
      let reconnectTimer = null;

      function connectAwsWebSocket() {
        if (isCleanedUp) return;
        try {
          const wsUrl = `${WEBSOCKET_URL}?token=${encodeURIComponent(token)}`;
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            console.log("[AWS WebSocket] Connected to real-time gateway");
          };

          ws.onmessage = (event) => {
            try {
              const payload = JSON.parse(event.data);
              const eventType = payload.type || payload.action;
              const data = payload.data || payload;

              if (handlersRef.current && typeof handlersRef.current[eventType] === "function") {
                handlersRef.current[eventType](data);
              }
            } catch (err) {
              console.warn("[AWS WebSocket] Failed to parse message:", err);
            }
          };

          ws.onclose = () => {
            if (!isCleanedUp) {
              // Reconnect after 5 seconds if connection drops
              reconnectTimer = setTimeout(connectAwsWebSocket, 5000);
            }
          };

          ws.onerror = (err) => {
            console.warn("[AWS WebSocket] Connection warning:", err);
            ws.close();
          };
        } catch (err) {
          console.warn("[AWS WebSocket] Failed to initialize:", err);
        }
      }

      connectAwsWebSocket();

      // Keepalive ping every 5 minutes to prevent AWS idle disconnects (AWS idle timeout is 10 min)
      const pingInterval = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: "ping" }));
        }
      }, 300000);

      return () => {
        isCleanedUp = true;
        clearInterval(pingInterval);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (wsRef.current) wsRef.current.close();
      };
    }

    // 2. If running locally with Node/Express (not serverless API Gateway), use Socket.io
    const isServerless = API_URL && API_URL.includes("execute-api");
    if (!isServerless) {
      try {
        const socket = io(API_URL, {
          auth: { token }
        });
        socketRef.current = socket;

        socket.emit("joinAdminRoom");

        Object.keys(handlersRef.current).forEach((eventName) => {
          socket.on(eventName, (data) => {
            if (handlersRef.current[eventName]) {
              handlersRef.current[eventName](data);
            }
          });
        });

        return () => {
          socket.disconnect();
        };
      } catch (err) {
        console.warn("[Socket.io] Local connection skipped:", err);
      }
    }

    // 3. Fallback: Quiet interval sync when on serverless without active WebSocket URL
    if (fallbackPollFn && typeof fallbackPollFn === "function") {
      pollIntervalRef.current = setInterval(() => {
        fallbackPollFn();
      }, 20000);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }
  }, []);
}

const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const WebSocketRepository = require("../repositories/websocketRepository");

let activeWsRepo = new WebSocketRepository();
let apiClient = null;

function getApiClient() {
  const rawEndpoint = process.env.WEBSOCKET_ENDPOINT || process.env.API_GATEWAY_WS_ENDPOINT;
  if (!rawEndpoint) return null;

  if (!apiClient) {
    // AWS API Gateway Management API requires the https:// format:
    // e.g. https://<api-id>.execute-api.<region>.amazonaws.com/<stage>
    const endpoint = rawEndpoint.replace(/^wss:\/\//, "https://");
    apiClient = new ApiGatewayManagementApiClient({
      endpoint,
      region: process.env.AWS_REGION || "ap-south-2"
    });
  }
  return apiClient;
}

const websocketService = {
  setRepository: (repo) => {
    activeWsRepo = repo;
  },

  /**
   * Broadcast an event to all connected admin/manager dashboards.
   * Handles both local Socket.io and AWS API Gateway WebSockets simultaneously.
   */
  broadcastToAdmins: async (eventType, payload, io = null) => {
    // 1. Emit to local Socket.io if running
    if (io) {
      try {
        io.to("admins").emit(eventType, payload);
      } catch (err) {
        console.warn("[WebSocketService] Socket.io emit to admins failed:", err.message);
      }
    }

    // 2. Broadcast via AWS API Gateway WebSocket Management API
    const client = getApiClient();
    if (!client) return;

    try {
      const adminConnections = await activeWsRepo.getAdminConnections();
      if (!adminConnections || adminConnections.length === 0) return;

      const messageData = Buffer.from(
        JSON.stringify({
          type: eventType,
          data: payload,
          timestamp: new Date().toISOString()
        })
      );

      await Promise.allSettled(
        adminConnections.map(async (connectionId) => {
          try {
            await client.send(
              new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: messageData
              })
            );
          } catch (postErr) {
            // HTTP 410 Gone means the client has disconnected; purge stale connection
            if (postErr.name === "GoneException" || postErr.statusCode === 410 || postErr.$metadata?.httpStatusCode === 410) {
              await activeWsRepo.deleteConnection(connectionId);
            } else {
              console.warn(`[WebSocketService] Failed to post to connection ${connectionId}:`, postErr.message);
            }
          }
        })
      );
    } catch (err) {
      console.warn("[WebSocketService] AWS WebSocket broadcast to admins error:", err.message);
    }
  },

  /**
   * Broadcast an event to a specific customer/user.
   */
  broadcastToUser: async (userId, eventType, payload, io = null) => {
    if (!userId) return;

    // 1. Local Socket.io emit
    if (io) {
      try {
        io.to(`user_${userId}`).emit(eventType, payload);
      } catch (err) {
        console.warn(`[WebSocketService] Socket.io emit to user_${userId} failed:`, err.message);
      }
    }

    // 2. AWS WebSocket emit
    const client = getApiClient();
    if (!client) return;

    try {
      const userConnections = await activeWsRepo.getUserConnections(userId);
      if (!userConnections || userConnections.length === 0) return;

      const messageData = Buffer.from(
        JSON.stringify({
          type: eventType,
          data: payload,
          timestamp: new Date().toISOString()
        })
      );

      await Promise.allSettled(
        userConnections.map(async (connectionId) => {
          try {
            await client.send(
              new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: messageData
              })
            );
          } catch (postErr) {
            if (postErr.name === "GoneException" || postErr.statusCode === 410 || postErr.$metadata?.httpStatusCode === 410) {
              await activeWsRepo.deleteConnection(connectionId);
            }
          }
        })
      );
    } catch (err) {
      console.warn(`[WebSocketService] AWS WebSocket broadcast to user ${userId} error:`, err.message);
    }
  }
};

module.exports = websocketService;


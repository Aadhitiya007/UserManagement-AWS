const jwt = require("jsonwebtoken");
const WebSocketRepository = require("./repositories/websocketRepository");

const wsRepo = new WebSocketRepository();

function getJwtSecret() {
  return process.env.JWT_SECRET || "fallback_jwt_secret_key_change_in_production";
}

exports.handler = async (event) => {
  const routeKey = event.requestContext?.routeKey;
  const connectionId = event.requestContext?.connectionId;
  const clientIp = event.requestContext?.identity?.sourceIp || "";

  console.log(`[WebSocket] Route: ${routeKey}, Connection: ${connectionId}`);

  if (!connectionId) {
    return { statusCode: 400, body: "Missing connectionId" };
  }

  switch (routeKey) {
    case "$connect": {
      const queryToken = event.queryStringParameters?.token;
      const headerAuth = event.headers?.Authorization || event.headers?.authorization;
      const token = queryToken || (headerAuth && headerAuth.startsWith("Bearer ") ? headerAuth.split(" ")[1] : null);

      let userId = "guest";
      let role = "visitor";

      if (token) {
        try {
          const decoded = jwt.verify(token, getJwtSecret());
          userId = decoded.id || decoded.userId || decoded._id || "guest";
          role = decoded.role || "user";
        } catch (jwtErr) {
          console.warn("[WebSocket] Token decode on $connect skipped:", jwtErr.message);
        }
      }

      await wsRepo.saveConnection(connectionId, { userId, role, clientIp });
      return { statusCode: 200, body: "Connected" };
    }

    case "$disconnect": {
      await wsRepo.deleteConnection(connectionId);
      return { statusCode: 200, body: "Disconnected" };
    }

    case "$default":
    default: {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        if (body.action === "ping") {
          return { statusCode: 200, body: JSON.stringify({ action: "pong" }) };
        }
      } catch {
        // Non-JSON ping or custom message
      }
      return { statusCode: 200, body: "OK" };
    }
  }
};


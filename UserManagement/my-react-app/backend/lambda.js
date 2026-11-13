const serverlessExpress = require("@codegenie/serverless-express");
const { app } = require("./server");
const websocketHandler = require("./websocketHandler");

// Configure binary MIME types to support image uploads via multipart/form-data through API Gateway
const binaryMimeTypes = [
  "application/octet-stream",
  "image/*",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "multipart/form-data"
];

const serverlessExpressInstance = serverlessExpress({
  app,
  binaryMimeTypes
});

/**
 * AWS Lambda unified handler entrypoint for Node.js 20.x.
 * Seamlessly routes:
 * 1. API Gateway WebSocket events ($connect, $disconnect, $default) -> websocketHandler
 * 2. API Gateway HTTP/REST events -> serverlessExpress
 */
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // 1. Detect WebSocket event from AWS API Gateway WebSocket API (always carries connectionId)
  if (event?.requestContext?.connectionId) {
    return websocketHandler.handler(event, context);
  }

  // 2. Intercept EventBridge / CloudWatch Scheduled events & keep-warm pings
  if (
    event?.source === "aws.events" ||
    event?.["detail-type"] === "Scheduled Event" ||
    event?.action === "ping" ||
    event?.type === "warmup" ||
    event?.source === "serverless-plugin-warmup"
  ) {
    return { statusCode: 200, body: "Warm" };
  }

  // 3. Guard against non-HTTP events passing to serverlessExpress
  // If an event is not an HTTP request (no httpMethod, routeKey !== HTTP, or no requestContext.http),
  // express will fail with "ee.on is not a function". Return 200 OK cleanly instead.
  const isHttpRequest = Boolean(
    event?.requestContext?.http ||
    event?.httpMethod ||
    event?.rawPath ||
    (event?.path && event?.headers)
  );

  if (!isHttpRequest) {
    console.log("[Lambda] Non-HTTP / Ping event safely handled:", JSON.stringify(event));
    return { statusCode: 200, body: "OK" };
  }

  // 4. Standard HTTP/REST API Gateway request
  return serverlessExpressInstance(event, context);
};


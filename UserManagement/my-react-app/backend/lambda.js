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

  // 1. Intercept EventBridge keep-warm cron events (prevents serverless-express crash on non-HTTP events)
  if (
    event?.source === "aws.events" ||
    event?.["detail-type"] === "Scheduled Event" ||
    event?.action === "ping" ||
    event?.type === "warmup"
  ) {
    return { statusCode: 200, body: "Warm" };
  }

  // 2. Detect WebSocket event from AWS API Gateway WebSocket API (always carries connectionId)
  if (event?.requestContext?.connectionId) {
    return websocketHandler.handler(event, context);
  }

  // 3. Standard HTTP/REST API Gateway request
  return serverlessExpressInstance(event, context);
};


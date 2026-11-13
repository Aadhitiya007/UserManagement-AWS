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

  // Detect WebSocket event from AWS API Gateway WebSocket API
  if (event?.requestContext?.routeKey || event?.requestContext?.connectionId) {
    return websocketHandler.handler(event, context);
  }

  // Standard HTTP/REST API Gateway request
  return serverlessExpressInstance(event, context);
};


const serverlessExpress = require("@codegenie/serverless-express");
const { app } = require("./server");

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
 * AWS Lambda handler entrypoint for Node.js 20.x.
 * Pure Promise / async handler (without legacy callback) to satisfy Node 20 runtime requirements.
 */
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return serverlessExpressInstance(event, context);
};


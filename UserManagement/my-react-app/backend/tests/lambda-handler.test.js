require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.USE_DYNAMODB = "true";

const assert = require("assert");
const { handler } = require("../lambda");

async function testLambdaHandler() {
  console.log("=== Testing Serverless Lambda Handler Offline ===\n");

  const event = {
    version: "2.0",
    routeKey: "GET /api/health",
    rawPath: "/api/health",
    rawQueryString: "",
    headers: {
      host: "api.example.com",
      "user-agent": "LambdaTest/1.0"
    },
    requestContext: {
      http: {
        method: "GET",
        path: "/api/health",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "LambdaTest/1.0"
      }
    },
    isBase64Encoded: false
  };

  const context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: "UserManagementAWS-Backend",
    memoryLimitInMB: "1024"
  };

  const response = await handler(event, context);

  assert.strictEqual(response.statusCode, 200, `Expected status 200, got ${response.statusCode}`);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.status, "healthy");
  assert.strictEqual(body.services.database.status, "connected");
  assert.strictEqual(body.services.database.engine, "dynamodb");
  assert.strictEqual(context.callbackWaitsForEmptyEventLoop, false);

  console.log("✓ PASS: Lambda handler successfully routes API Gateway requests to Express.");
  console.log("  Status Code:", response.statusCode);
  console.log("  Engine:     ", body.services.database.engine);
  console.log("  DB Status:  ", body.services.database.status);
  process.exit(0);
}

testLambdaHandler().catch((err) => {
  console.error("Lambda handler test failed:", err);
  process.exit(1);
});


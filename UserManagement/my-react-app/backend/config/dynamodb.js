const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const clientConfig = {
  region: process.env.AWS_REGION || "ap-south-2"
};

// In AWS Lambda, credentials are automatically resolved by the AWS SDK
// from the Lambda execution role. In local dev, if real non-placeholder credentials
// are set, use them.
const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const hasExplicitKeys =
  !isLambda &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  !process.env.AWS_ACCESS_KEY_ID.startsWith("your_") &&
  !process.env.AWS_ACCESS_KEY_ID.startsWith("mock-");

if (hasExplicitKeys) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {})
  };
}

const rawClient = new DynamoDBClient(clientConfig);

const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false
  },
  unmarshallOptions: {
    wrapNumbers: false
  }
});

const TABLE_NAMES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || "UserManagementAWS-Users",
  PRODUCTS: process.env.DYNAMODB_PRODUCTS_TABLE || "UserManagementAWS-Products",
  ORDERS: process.env.DYNAMODB_ORDERS_TABLE || "UserManagementAWS-Orders"
};

module.exports = {
  rawClient,
  docClient,
  TABLE_NAMES
};

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { rawClient, TABLE_NAMES } = require("../config/dynamodb");

async function createOrdersTable() {
  const tableName = TABLE_NAMES.ORDERS || "UserManagementAWS-Orders";
  const region = process.env.AWS_REGION || "ap-south-2";

  console.log("=== DynamoDB Orders Table Provisioning Tool ===");
  console.log(`Region:     ${region}`);
  console.log(`Table Name: ${tableName}`);
  console.log("Partition Key: orderId (String)");
  console.log("GSI:           userId-createdAt-index (PK: userId, SK: createdAt)\n");

  try {
    console.log(`Checking if table "${tableName}" already exists...`);
    const desc = await rawClient.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`✓ Table "${tableName}" already exists (Status: ${desc.Table?.TableStatus}).`);
    return;
  } catch (err) {
    if (err.name !== "ResourceNotFoundException") {
      console.warn("Table describe check returned:", err.message);
    }
  }

  console.log(`Creating table "${tableName}"...`);
  const createCmd = new CreateTableCommand({
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "orderId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" }
    ],
    KeySchema: [
      { AttributeName: "orderId", KeyType: "HASH" }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-createdAt-index",
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" }
        ],
        Projection: {
          ProjectionType: "ALL"
        }
      }
    ]
  });

  try {
    await rawClient.send(createCmd);
    console.log(`✓ Table "${tableName}" creation initiated successfully!`);
    console.log("  Pay-per-request billing and Global Secondary Index configured.");
  } catch (err) {
    if (err.name === "ResourceInUseException") {
      console.log(`✓ Table "${tableName}" already exists.`);
    } else {
      console.error(`❌ Failed to create table "${tableName}":`, err.message);
      console.error("  Ensure AWS credentials with dynamodb:CreateTable permissions are configured in .env.");
      process.exit(1);
    }
  }
}

createOrdersTable().catch((err) => {
  console.error("Orders table script failed:", err);
  process.exit(1);
});


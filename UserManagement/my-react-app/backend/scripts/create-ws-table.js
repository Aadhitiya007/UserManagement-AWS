require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { CreateTableCommand, DescribeTableCommand, UpdateTimeToLiveCommand } = require("@aws-sdk/client-dynamodb");
const { rawClient, TABLE_NAMES } = require("../config/dynamodb");

async function createWebSocketConnectionsTable() {
  const tableName = TABLE_NAMES.WS_CONNECTIONS || "UserManagementAWS-WebSocketConnections";
  const region = process.env.AWS_REGION || "ap-south-2";

  console.log("=== DynamoDB WebSocket Connections Table Provisioning Tool ===");
  console.log(`Region:        ${region}`);
  console.log(`Table Name:    ${tableName}`);
  console.log("Partition Key: connectionId (String)");
  console.log("GSI:           role-index (PK: role)");
  console.log("TTL:           ttl (epoch timestamp)\n");

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
      { AttributeName: "connectionId", AttributeType: "S" },
      { AttributeName: "role", AttributeType: "S" }
    ],
    KeySchema: [
      { AttributeName: "connectionId", KeyType: "HASH" }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "role-index",
        KeySchema: [
          { AttributeName: "role", KeyType: "HASH" }
        ],
        Projection: {
          ProjectionType: "ALL"
        }
      }
    ]
  });

  try {
    const result = await rawClient.send(createCmd);
    console.log(`✓ Table creation initiated. ARN: ${result.TableDescription?.TableArn}`);

    // Enable TTL
    try {
      await rawClient.send(
        new UpdateTimeToLiveCommand({
          TableName: tableName,
          TimeToLiveSpecification: {
            AttributeName: "ttl",
            Enabled: true
          }
        })
      );
      console.log("✓ Native DynamoDB TTL configured on attribute 'ttl'.");
    } catch (ttlErr) {
      console.log("TTL setup will activate once table is ACTIVE:", ttlErr.message);
    }
  } catch (err) {
    console.error("Failed to create table:", err.message);
  }
}

if (require.main === module) {
  createWebSocketConnectionsTable();
}

module.exports = { createWebSocketConnectionsTable };


require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { rawClient, TABLE_NAMES } = require("../config/dynamodb");
const ProductRepository = require("../repositories/productRepository");

async function inspectDynamoDB() {
  console.log("=== AWS DynamoDB Live Inspection ===\n");
  console.log(`Region: ${process.env.AWS_REGION || "ap-south-2"}\n`);

  const tables = [
    { name: TABLE_NAMES.USERS, label: "Users Table" },
    { name: TABLE_NAMES.PRODUCTS, label: "Products Table" },
    { name: TABLE_NAMES.ORDERS, label: "Orders Table" }
  ];

  for (const table of tables) {
    try {
      const res = await rawClient.send(new DescribeTableCommand({ TableName: table.name }));
      const desc = res.Table;
      console.log(`✓ Table [${table.name}] (${table.label}):`);
      console.log(`   Status:        ${desc.TableStatus}`);
      console.log(`   Partition Key: ${desc.KeySchema.map((k) => `${k.AttributeName} (${k.KeyType})`).join(", ")}`);
      if (desc.GlobalSecondaryIndexes && desc.GlobalSecondaryIndexes.length > 0) {
        console.log(`   GSIs:          ${desc.GlobalSecondaryIndexes.map(g => `${g.IndexName} (${g.IndexStatus})`).join(", ")}`);
      }
      console.log(`   Billing Mode:  ${desc.BillingModeSummary?.BillingMode || "PAY_PER_REQUEST"}`);
    } catch (err) {
      if (err.name === "ResourceNotFoundException") {
        console.log(`⚠️  Table [${table.name}] does not exist yet.`);
      } else {
        console.log(`❌ Error checking table [${table.name}]:`, err.message);
      }
    }
    console.log("");
  }

  console.log("--- Fetching Live Products from DynamoDB ---");
  try {
    const productRepo = new ProductRepository();
    const productList = await productRepo.list({ limit: 5 });

    console.log(`Successfully queried DynamoDB! Found ${productList.products.length} products on first page.`);
    console.log("\nSample Products fetched directly from DynamoDB:");
    productList.products.forEach((p, idx) => {
      console.log(`  ${idx + 1}. [${p.category}] ${p.name} - ₹${p.price.toLocaleString("en-IN")} (Stock: ${p.stock})`);
    });
  } catch (err) {
    console.error("Failed to query products from DynamoDB:", err.message);
  }

  console.log("\n=== Inspection Complete ===");
}

inspectDynamoDB().catch((err) => {
  console.error("Inspector error:", err);
});


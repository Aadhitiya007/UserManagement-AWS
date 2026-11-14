require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const assert = require("assert");
const ProductRepository = require("../repositories/productRepository");
const OrderRepository = require("../repositories/orderRepository");
const { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");

class MockDocClient {
  constructor() {
    this.sentCommands = [];
    this.handlers = new Map();
  }
  on(cmdClass, fn) {
    this.handlers.set(cmdClass.name, fn);
  }
  async send(cmd) {
    this.sentCommands.push(cmd);
    const handler = this.handlers.get(cmd.constructor.name);
    if (handler) return handler(cmd.input);
    return {};
  }
}

async function runTests() {
  console.log("=== Running Product Variants & Multi-Attribute Tests ===\n");
  let passed = 0;

  // Test 1: ProductRepository creates and indexes variants in search terms
  {
    const mock = new MockDocClient();
    const repo = new ProductRepository(mock, "ProductsTable");
    const sampleVariants = [
      {
        variantId: "v_128_nat",
        name: "128GB - Natural Titanium",
        attributes: { Storage: "128GB", Color: "Natural Titanium" },
        price: 129900,
        stock: 10
      },
      {
        variantId: "v_256_nat",
        name: "256GB - Natural Titanium",
        attributes: { Storage: "256GB", Color: "Natural Titanium" },
        price: 139900,
        stock: 15
      }
    ];
    const sampleAttributes = [
      { name: "Storage", options: ["128GB", "256GB"] },
      { name: "Color", options: ["Natural Titanium"] }
    ];

    const prod = await repo.create({
      name: "Apple iPhone 15 Pro",
      category: "Electronics",
      price: 129900,
      stock: 25,
      variants: sampleVariants,
      variantAttributes: sampleAttributes
    });

    const putCmd = mock.sentCommands.find((c) => c.constructor.name === "PutCommand");
    assert.ok(putCmd, "PutCommand should be called");
    assert.strictEqual(putCmd.input.Item.name, "Apple iPhone 15 Pro");
    assert.strictEqual(putCmd.input.Item.variants.length, 2);
    assert.strictEqual(putCmd.input.Item.variantAttributes.length, 2);
    assert.ok(putCmd.input.Item.searchTerms.includes("128gb"));
    assert.ok(putCmd.input.Item.searchTerms.includes("titanium"));
    assert.strictEqual(prod.variants.length, 2);
    assert.strictEqual(prod.variantAttributes.length, 2);
    console.log("✓ PASS: ProductRepository.create stores variants & indexes attributes in searchTerms");
    passed++;
  }

  // Test 2: ProductRepository.update safely updates variants
  {
    const mock = new MockDocClient();
    let currentItem = {
      productId: "p_var_test",
      name: "Base Phone",
      price: 50000,
      category: "Electronics",
      stock: 20,
      variants: [],
      variantAttributes: [],
      version: 1
    };

    mock.on(GetCommand, () => ({ Item: currentItem }));
    mock.on(UpdateCommand, (input) => {
      currentItem.variants = input.ExpressionAttributeValues[":variants"];
      currentItem.variantAttributes = input.ExpressionAttributeValues[":variantAttributes"];
      return {};
    });

    const repo = new ProductRepository(mock, "ProductsTable");
    const updated = await repo.update("p_var_test", {
      variants: [{ variantId: "v_red", name: "Red Edition", price: 52000, stock: 5 }],
      variantAttributes: [{ name: "Color", options: ["Red"] }]
    });

    assert.strictEqual(updated.variants.length, 1);
    assert.strictEqual(updated.variants[0].variantId, "v_red");
    assert.strictEqual(updated.variantAttributes[0].name, "Color");
    console.log("✓ PASS: ProductRepository.update persists updated variants & variantAttributes");
    passed++;
  }

  // Test 3: OrderRepository creates order preserving variant metadata & variant pricing
  {
    const mock = new MockDocClient();
    const orderRepo = new OrderRepository(mock, {
      ORDERS: "OrdersTable",
      PRODUCTS: "ProductsTable"
    });

    const mockProductRepo = {
      findByIds: async () => [
        {
          productId: "p_iphone",
          name: "iPhone 15 Pro",
          price: 129900,
          stock: 30,
          variants: [
            { variantId: "v_256", name: "256GB", price: 139900, stock: 15 }
          ]
        }
      ]
    };

    const rawProducts = [
      {
        productId: "p_iphone",
        quantity: 1,
        variant: {
          variantId: "v_256",
          name: "256GB - Blue",
          price: 139900,
          attributes: { Storage: "256GB", Color: "Blue" }
        }
      }
    ];

    const order = await orderRepo.createOrderWithStockDeduction({
      userId: "u_shopper_1",
      userName: "Shopper",
      userEmail: "shopper@example.com",
      rawProducts,
      productRepo: mockProductRepo
    });

    const transact = mock.sentCommands.find((c) => c.constructor.name === "TransactWriteCommand");
    assert.ok(transact, "TransactWriteCommand executed");
    const orderPut = transact.input.TransactItems.find((i) => i.Put).Put;
    assert.strictEqual(orderPut.Item.products[0].price, 139900, "Uses variant price");
    assert.strictEqual(orderPut.Item.products[0].variant.variantId, "v_256");
    assert.strictEqual(orderPut.Item.products[0].variant.name, "256GB - Blue");
    assert.strictEqual(order.totalAmount, 139900);
    console.log("✓ PASS: OrderRepository preserves variant details and applies dynamic variant price");
    passed++;
  }

  console.log(`\n=== Product Variants Test Results: All ${passed}/${passed} passed ===\n`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});


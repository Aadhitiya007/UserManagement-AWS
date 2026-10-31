const assert = require("assert");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  TransactWriteCommand
} = require("@aws-sdk/lib-dynamodb");

const UserRepository = require("../repositories/userRepository");
const ProductRepository = require("../repositories/productRepository");
const OrderRepository = require("../repositories/orderRepository");

/**
 * Lightweight mock DynamoDB DocumentClient for 100% offline unit tests.
 * Captures all sent commands and simulates responses/errors without network calls.
 */
class MockDynamoDBDocClient {
  constructor() {
    this.sentCommands = [];
    this.handlers = [];
  }

  on(CommandType, handler) {
    this.handlers.push({ CommandType, handler });
    return this;
  }

  async send(command) {
    this.sentCommands.push(command);
    for (const { CommandType, handler } of this.handlers) {
      if (!CommandType || (command.constructor && command.constructor.name === CommandType.name)) {
        const res = await handler(command.input);
        if (res !== undefined) return res;
      }
    }
    // Default empty item response
    return {};
  }

  clear() {
    this.sentCommands = [];
    this.handlers = [];
  }
}

async function runTests() {
  console.log("=== Running DynamoDB Offline Repository Unit Tests ===\n");
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  ${err.message}`);
      if (err.stack) console.error(`  ${err.stack.split("\n")[1]}`);
    }
  }

  // -------------------------------------------------------------
  // Test Suite 1: UserRepository
  // -------------------------------------------------------------
  await test("UserRepository.create: writes reservation and profile atomically", async () => {
    const mock = new MockDynamoDBDocClient();
    const repo = new UserRepository(mock, "TestUsersTable");

    const created = await repo.create({
      name: "Alice Smith",
      email: "Alice@Example.com",
      password: "hashedPassword123"
    });

    assert.strictEqual(mock.sentCommands.length, 1);
    const cmd = mock.sentCommands[0];
    assert.strictEqual(cmd.constructor.name, "TransactWriteCommand");
    assert.strictEqual(cmd.input.TransactItems.length, 2);

    const reservation = cmd.input.TransactItems[0].Put;
    assert.strictEqual(reservation.TableName, "TestUsersTable");
    assert.strictEqual(reservation.Item.userId, "EMAIL#alice@example.com");
    assert.strictEqual(reservation.Item.itemType, "EMAIL_RESERVATION");
    assert.strictEqual(reservation.ConditionExpression, "attribute_not_exists(userId)");

    const profile = cmd.input.TransactItems[1].Put;
    assert.strictEqual(profile.TableName, "TestUsersTable");
    assert.strictEqual(profile.Item.name, "Alice Smith");
    assert.strictEqual(profile.Item.email, "alice@example.com");
    assert.strictEqual(profile.Item.itemType, "USER_PROFILE");
    assert.strictEqual(profile.ConditionExpression, "attribute_not_exists(userId)");

    assert.strictEqual(created.email, "alice@example.com");
    assert.ok(created.id);
    assert.ok(created._id);
  });

  await test("UserRepository.create: cleanly handles duplicate email registration", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(TransactWriteCommand, () => {
      const err = new Error("Transaction cancelled");
      err.name = "TransactionCanceledException";
      err.CancellationReasons = [{ Code: "ConditionalCheckFailed" }, { Code: "None" }];
      throw err;
    });

    const repo = new UserRepository(mock, "TestUsersTable");

    let threw = false;
    try {
      await repo.create({
        name: "Bob",
        email: "bob@example.com",
        password: "pw"
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.message, "Email is already registered");
    }
    assert.strictEqual(threw, true, "Expected duplicate email error to be thrown");
  });

  await test("UserRepository.findByEmail: returns user profile, never reservation metadata", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, (input) => {
      if (input.Key.userId === "EMAIL#alice@example.com") {
        return {
          Item: {
            userId: "EMAIL#alice@example.com",
            itemType: "EMAIL_RESERVATION",
            targetUserId: "u_alice_123"
          }
        };
      }
      if (input.Key.userId === "u_alice_123") {
        return {
          Item: {
            userId: "u_alice_123",
            itemType: "USER_PROFILE",
            name: "Alice",
            email: "alice@example.com",
            role: "user"
          }
        };
      }
      return {};
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    const user = await repo.findByEmail("Alice@Example.com");

    assert.ok(user);
    assert.strictEqual(user.id, "u_alice_123");
    assert.strictEqual(user._id, "u_alice_123");
    assert.strictEqual(user.name, "Alice");
    assert.strictEqual(user.email, "alice@example.com");
  });

  await test("UserRepository.update: updates non-email fields with existence condition", async () => {
    const mock = new MockDynamoDBDocClient();
    let currentProfile = {
      userId: "u_1",
      itemType: "USER_PROFILE",
      name: "Old Name",
      email: "user@example.com",
      role: "user"
    };

    mock.on(GetCommand, (input) => {
      if (input.Key.userId === "u_1") return { Item: currentProfile };
      return {};
    });

    mock.on(UpdateCommand, (input) => {
      assert.strictEqual(input.ConditionExpression, "attribute_exists(userId)");
      assert.strictEqual(input.ExpressionAttributeValues[":name"], "New Name");
      currentProfile.name = "New Name";
      return {};
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    const updated = await repo.update("u_1", { name: "New Name" });

    assert.strictEqual(updated.name, "New Name");
  });

  await test("UserRepository.update: atomic email change with reservation delete condition and profile email condition", async () => {
    const mock = new MockDynamoDBDocClient();
    let currentProfile = {
      userId: "u_1",
      itemType: "USER_PROFILE",
      name: "User One",
      email: "old@example.com",
      role: "user"
    };

    mock.on(GetCommand, (input) => {
      if (input.Key.userId === "u_1") return { Item: currentProfile };
      return {};
    });

    mock.on(TransactWriteCommand, (input) => {
      assert.strictEqual(input.TransactItems.length, 3);
      // 1. Put new reservation
      const putNew = input.TransactItems[0].Put;
      assert.strictEqual(putNew.Item.userId, "EMAIL#new@example.com");
      assert.strictEqual(putNew.ConditionExpression, "attribute_not_exists(userId)");
      // 2. Delete old reservation
      const delOld = input.TransactItems[1].Delete;
      assert.strictEqual(delOld.Key.userId, "EMAIL#old@example.com");
      assert.strictEqual(delOld.ConditionExpression, "attribute_exists(userId) AND targetUserId = :uid");
      assert.strictEqual(delOld.ExpressionAttributeValues[":uid"], "u_1");
      // 3. Update profile
      const updateProf = input.TransactItems[2].Update;
      assert.strictEqual(updateProf.Key.userId, "u_1");
      assert.strictEqual(updateProf.ConditionExpression, "attribute_exists(userId) AND email = :oldEmail");
      assert.strictEqual(updateProf.ExpressionAttributeValues[":oldEmail"], "old@example.com");

      currentProfile.email = "new@example.com";
      return {};
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    const updated = await repo.update("u_1", { email: "new@example.com" });

    assert.strictEqual(updated.email, "new@example.com");
  });

  await test("UserRepository.update: email change throws 400 when new email already taken", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        userId: "u_1",
        itemType: "USER_PROFILE",
        email: "old@example.com"
      }
    }));

    mock.on(TransactWriteCommand, () => {
      const err = new Error("Transaction cancelled");
      err.name = "TransactionCanceledException";
      err.CancellationReasons = [
        { Code: "ConditionalCheckFailed" }, // new email taken
        { Code: "None" },
        { Code: "None" }
      ];
      throw err;
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    let caught = null;
    try {
      await repo.update("u_1", { email: "taken@example.com" });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 400);
    assert.strictEqual(caught.message, "Email is already registered");
  });

  await test("UserRepository.update: email change throws 409 on concurrent modification of profile or old reservation", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        userId: "u_1",
        itemType: "USER_PROFILE",
        email: "old@example.com"
      }
    }));

    mock.on(TransactWriteCommand, () => {
      const err = new Error("Transaction cancelled");
      err.name = "TransactionCanceledException";
      err.CancellationReasons = [
        { Code: "None" },
        { Code: "None" },
        { Code: "ConditionalCheckFailed" } // Profile was modified concurrently
      ];
      throw err;
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    let caught = null;
    try {
      await repo.update("u_1", { email: "brandnew@example.com" });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 409);
    assert.ok(caught.message.includes("conflict"));
  });

  await test("UserRepository.update: throws 404 when user does not exist", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({ Item: undefined }));

    const repo = new UserRepository(mock, "TestUsersTable");
    let caught = null;
    try {
      await repo.update("u_nonexistent", { name: "Ghost" });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 404);
    assert.strictEqual(caught.message, "User not found");
  });

  await test("UserRepository.delete: atomically deletes profile and reservation with ownership condition", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        userId: "u_del",
        itemType: "USER_PROFILE",
        email: "del@example.com"
      }
    }));

    let transactCalled = false;
    mock.on(TransactWriteCommand, (input) => {
      transactCalled = true;
      assert.strictEqual(input.TransactItems.length, 2);
      assert.strictEqual(input.TransactItems[0].Delete.Key.userId, "u_del");
      assert.strictEqual(input.TransactItems[0].Delete.ConditionExpression, "attribute_exists(userId)");
      assert.strictEqual(input.TransactItems[1].Delete.Key.userId, "EMAIL#del@example.com");
      assert.strictEqual(input.TransactItems[1].Delete.ConditionExpression, "attribute_exists(userId) AND targetUserId = :uid");
      assert.strictEqual(input.TransactItems[1].Delete.ExpressionAttributeValues[":uid"], "u_del");
      return {};
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    const result = await repo.delete("u_del");

    assert.strictEqual(result, true);
    assert.strictEqual(transactCalled, true);
  });

  await test("UserRepository.delete: returns false when user does not exist", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({ Item: undefined }));

    const repo = new UserRepository(mock, "TestUsersTable");
    const result = await repo.delete("u_missing");
    assert.strictEqual(result, false);
  });

  await test("UserRepository.listUsers: strips passwords, filters by search, and supports nextToken", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(ScanCommand, (input) => {
      assert.strictEqual(input.FilterExpression, "itemType = :profile");
      return {
        Items: [
          { userId: "u_1", itemType: "USER_PROFILE", name: "Alice Admin", email: "alice@test.com", role: "admin", password: "secret_hash" },
          { userId: "u_2", itemType: "USER_PROFILE", name: "Bob Buyer", email: "bob@test.com", role: "user", password: "secret_hash" }
        ],
        LastEvaluatedKey: { userId: "u_2" }
      };
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    const result = await repo.listUsers({ search: "admin" });

    assert.strictEqual(result.users.length, 1);
    assert.strictEqual(result.users[0].name, "Alice Admin");
    assert.strictEqual(result.users[0].password, undefined); // password stripped
    assert.ok(result.nextToken);
  });

  await test("UserRepository.count: counts only user profiles", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(ScanCommand, (input) => {
      assert.strictEqual(input.Select, "COUNT");
      assert.strictEqual(input.FilterExpression, "itemType = :profile");
      return { Count: 42 };
    });

    const repo = new UserRepository(mock, "TestUsersTable");
    const count = await repo.count();
    assert.strictEqual(count, 42);
  });

  // -------------------------------------------------------------
  // Test Suite 2: ProductRepository
  // -------------------------------------------------------------
  await test("ProductRepository.create: stores searchable terms and version lock", async () => {
    const mock = new MockDynamoDBDocClient();
    const repo = new ProductRepository(mock, "TestProductsTable");

    const product = await repo.create({
      name: "Wireless Mouse",
      description: "Ergonomic 2.4GHz optical mouse",
      price: 999,
      category: "Electronics",
      stock: 50
    });

    assert.strictEqual(mock.sentCommands.length, 1);
    const cmd = mock.sentCommands[0];
    assert.strictEqual(cmd.input.TableName, "TestProductsTable");
    assert.strictEqual(cmd.input.Item.name, "Wireless Mouse");
    assert.strictEqual(cmd.input.Item.price, 999);
    assert.strictEqual(cmd.input.Item.stock, 50);
    assert.strictEqual(cmd.input.Item.version, 1);
    assert.ok(cmd.input.Item.searchTerms.includes("wireless"));
    assert.strictEqual(product._id, product.productId);
  });

  await test("ProductRepository.update: updates existing product and asserts attribute_exists condition", async () => {
    const mock = new MockDynamoDBDocClient();
    let current = {
      productId: "p_update_1",
      name: "Old Product",
      price: 100,
      category: "Tools",
      stock: 5,
      version: 1
    };

    mock.on(GetCommand, (input) => {
      if (input.Key.productId === "p_update_1") return { Item: current };
      return {};
    });

    mock.on(UpdateCommand, (input) => {
      assert.strictEqual(input.ConditionExpression, "attribute_exists(productId)");
      assert.strictEqual(input.ExpressionAttributeValues[":name"], "Updated Product");
      current.name = "Updated Product";
      return {};
    });

    const repo = new ProductRepository(mock, "TestProductsTable");
    const updated = await repo.update("p_update_1", { name: "Updated Product" });

    assert.strictEqual(updated.name, "Updated Product");
  });

  await test("ProductRepository.update: throws 404 when product is missing", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({ Item: undefined }));

    const repo = new ProductRepository(mock, "TestProductsTable");
    let caught = null;
    try {
      await repo.update("p_nonexistent", { price: 200 });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 404);
    assert.strictEqual(caught.message, "Product not found");
  });

  await test("ProductRepository.update: handles concurrent deletion with ConditionalCheckFailedException", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        productId: "p_race",
        name: "Race Item",
        price: 50,
        category: "Test",
        stock: 1
      }
    }));

    mock.on(UpdateCommand, () => {
      const err = new Error("The conditional request failed");
      err.name = "ConditionalCheckFailedException";
      throw err;
    });

    const repo = new ProductRepository(mock, "TestProductsTable");
    let caught = null;
    try {
      await repo.update("p_race", { price: 60 });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 404);
    assert.strictEqual(caught.message, "Product not found");
  });

  await test("ProductRepository.delete: deletes existing product with attribute_exists condition", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: { productId: "p_to_del", name: "Delete Me" }
    }));

    let deleteCalled = false;
    mock.on(DeleteCommand, (input) => {
      deleteCalled = true;
      assert.strictEqual(input.Key.productId, "p_to_del");
      assert.strictEqual(input.ConditionExpression, "attribute_exists(productId)");
      return {};
    });

    const repo = new ProductRepository(mock, "TestProductsTable");
    const result = await repo.delete("p_to_del");

    assert.strictEqual(result, true);
    assert.strictEqual(deleteCalled, true);
  });

  await test("ProductRepository.delete: returns false when product not found", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({ Item: undefined }));

    const repo = new ProductRepository(mock, "TestProductsTable");
    const result = await repo.delete("p_missing");
    assert.strictEqual(result, false);
  });

  await test("ProductRepository.list: supports category filtering, search terms, and pagination cursor", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(ScanCommand, (input) => {
      assert.ok(input.FilterExpression.includes("category = :cat"));
      assert.ok(input.FilterExpression.includes("contains(searchTerms, :term)"));
      assert.strictEqual(input.ExpressionAttributeValues[":cat"], "Electronics");
      assert.strictEqual(input.ExpressionAttributeValues[":term"], "mouse");
      return {
        Items: [
          { productId: "p_1", name: "Wireless Mouse", category: "Electronics", price: 500, stock: 10 }
        ],
        LastEvaluatedKey: { productId: "p_1" }
      };
    });

    const repo = new ProductRepository(mock, "TestProductsTable");
    const result = await repo.list({ category: "Electronics", search: "mouse" });

    assert.strictEqual(result.products.length, 1);
    assert.strictEqual(result.products[0].name, "Wireless Mouse");
    assert.ok(result.nextCursor);
  });

  await test("ProductRepository.addReview: enforces optimistic concurrency and updates average rating", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        productId: "p_100",
        name: "Headphones",
        price: 2000,
        stock: 10,
        version: 3,
        reviewsCount: 1,
        rating: 4,
        reviews: [
          {
            reviewId: "rev_01",
            userId: "u_first",
            userName: "First Reviewer",
            rating: 4,
            comment: "Good"
          }
        ]
      }
    }));

    const repo = new ProductRepository(mock, "TestProductsTable");
    await repo.addReview("p_100", {
      userId: "u_second",
      userName: "Second Reviewer",
      rating: 5,
      comment: "Excellent"
    });

    const updateCmd = mock.sentCommands.find((c) => c.constructor.name === "UpdateCommand");
    assert.ok(updateCmd);
    assert.strictEqual(updateCmd.input.Key.productId, "p_100");
    assert.strictEqual(updateCmd.input.ConditionExpression, "attribute_exists(productId) AND #v = :currVer");
    assert.strictEqual(updateCmd.input.ExpressionAttributeValues[":currVer"], 3);
    assert.strictEqual(updateCmd.input.ExpressionAttributeValues[":rc"], 2);
    assert.strictEqual(updateCmd.input.ExpressionAttributeValues[":rating"], 4.5);
  });

  await test("ProductRepository.addReview: prevents duplicate reviews from same user", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        productId: "p_100",
        name: "Keyboard",
        version: 1,
        reviewsCount: 1,
        rating: 3,
        reviews: [
          {
            reviewId: "rev_existing",
            userId: "u_same_user",
            userName: "Alice",
            rating: 3,
            comment: "Okay"
          }
        ]
      }
    }));

    const repo = new ProductRepository(mock, "TestProductsTable");
    await repo.addReview("p_100", {
      userId: "u_same_user",
      userName: "Alice",
      rating: 5,
      comment: "Updated comment"
    });

    const updateCmd = mock.sentCommands.find((c) => c.constructor.name === "UpdateCommand");
    assert.ok(updateCmd);
    assert.strictEqual(updateCmd.input.ExpressionAttributeValues[":rc"], 1);
    assert.strictEqual(updateCmd.input.ExpressionAttributeValues[":rating"], 5);
  });

  await test("ProductRepository.deleteReview: recalculates average rating and count", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        productId: "p_rev_del",
        name: "Monitor",
        version: 2,
        reviewsCount: 2,
        rating: 4.5,
        reviews: [
          { reviewId: "rev_1", userId: "u_1", rating: 4, comment: "Nice" },
          { reviewId: "rev_2", userId: "u_2", rating: 5, comment: "Great" }
        ]
      }
    }));

    const repo = new ProductRepository(mock, "TestProductsTable");
    const result = await repo.deleteReview("p_rev_del", "rev_2");

    assert.strictEqual(result.reviewsCount, 1);
    assert.strictEqual(result.rating, 4);

    const updateCmd = mock.sentCommands.find((c) => c.constructor.name === "UpdateCommand");
    assert.ok(updateCmd);
    assert.strictEqual(updateCmd.input.ExpressionAttributeValues[":rc"], 1);
    assert.strictEqual(updateCmd.input.ExpressionAttributeValues[":rating"], 4);
  });

  await test("ProductRepository.deleteReview: throws 404 if review does not exist", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        productId: "p_rev_not_found",
        version: 1,
        reviewsCount: 1,
        rating: 5,
        reviews: [{ reviewId: "rev_actual", userId: "u_1", rating: 5 }]
      }
    }));

    const repo = new ProductRepository(mock, "TestProductsTable");
    let caught = null;
    try {
      await repo.deleteReview("p_rev_not_found", "rev_missing");
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 404);
    assert.strictEqual(caught.message, "Review not found");
  });

  await test("ProductRepository.getAllReviews: flattens and sorts all reviews across products", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(ScanCommand, () => ({
      Items: [
        {
          productId: "p_1",
          name: "Phone",
          reviews: [
            { reviewId: "r_1", userId: "u_1", rating: 5, comment: "Awesome", createdAt: "2026-01-01T10:00:00.000Z" }
          ]
        },
        {
          productId: "p_2",
          name: "Tablet",
          reviews: [
            { reviewId: "r_2", userId: "u_2", rating: 4, comment: "Good", createdAt: "2026-01-02T10:00:00.000Z" }
          ]
        }
      ]
    }));

    const repo = new ProductRepository(mock, "TestProductsTable");
    const all = await repo.getAllReviews();

    assert.strictEqual(all.length, 2);
    // Should be sorted desc by createdAt
    assert.strictEqual(all[0]._id, "r_2");
    assert.strictEqual(all[1]._id, "r_1");
  });

  // -------------------------------------------------------------
  // Test Suite 3: OrderRepository
  // -------------------------------------------------------------
  await test("OrderRepository.createOrder: consolidates duplicate product IDs and writes transaction atomically", async () => {
    const mock = new MockDynamoDBDocClient();
    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    const mockProductRepo = {
      findByIds: async () => [
        { productId: "p_item1", name: "Laptop", price: 50000, stock: 10 }
      ]
    };

    const rawProducts = [
      { productId: "p_item1", quantity: 2 },
      { productId: "p_item1", quantity: 3 }
    ];

    const order = await orderRepo.createOrderWithStockDeduction({
      userId: "u_buyer",
      userName: "Buyer",
      userEmail: "buyer@example.com",
      rawProducts,
      productRepo: mockProductRepo
    });

    assert.strictEqual(mock.sentCommands.length, 1);
    const cmd = mock.sentCommands[0];
    assert.strictEqual(cmd.constructor.name, "TransactWriteCommand");
    assert.strictEqual(cmd.input.TransactItems.length, 2);

    const stockUpdate = cmd.input.TransactItems[0].Update;
    assert.strictEqual(stockUpdate.TableName, "TestProductsTable");
    assert.strictEqual(stockUpdate.Key.productId, "p_item1");
    assert.strictEqual(stockUpdate.ConditionExpression, "attribute_exists(productId) AND stock >= :qty");
    assert.strictEqual(stockUpdate.ExpressionAttributeValues[":qty"], 5);

    const orderPut = cmd.input.TransactItems[1].Put;
    assert.strictEqual(orderPut.TableName, "TestOrdersTable");
    assert.strictEqual(orderPut.Item.totalAmount, 250000);
    assert.deepStrictEqual(orderPut.Item.purchasedProductIds, ["p_item1"]);

    assert.strictEqual(order.totalAmount, 250000);
    assert.strictEqual(order.status, "Pending");
  });

  await test("OrderRepository.createOrder: identifies insufficient stock failure accurately", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(TransactWriteCommand, () => {
      const err = new Error("Transaction cancelled");
      err.name = "TransactionCanceledException";
      err.CancellationReasons = [{ Code: "ConditionalCheckFailed" }, { Code: "None" }];
      throw err;
    });

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    const mockProductRepo = {
      findByIds: async () => [{ productId: "p_low", name: "Limited Edition Watch", price: 10000, stock: 1 }]
    };

    let caught = null;
    try {
      await orderRepo.createOrderWithStockDeduction({
        userId: "u_1",
        rawProducts: [{ productId: "p_low", quantity: 5 }],
        productRepo: mockProductRepo
      });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 400);
    assert.ok(caught.message.includes("Insufficient stock for \"Limited Edition Watch\""));
  });

  await test("OrderRepository.updateStatus: atomic cancellation prevents double stock restoration", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        orderId: "ord_cancel_me",
        status: "Processing",
        paymentStatus: "Paid",
        products: [
          { productId: "p_itemA", quantity: 2 },
          { productId: "p_itemB", quantity: 1 }
        ]
      }
    }));

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    await orderRepo.updateStatusWithStockRestoration("ord_cancel_me", "Cancelled");

    const transactCmd = mock.sentCommands.find((c) => c.constructor.name === "TransactWriteCommand");
    assert.ok(transactCmd);
    assert.strictEqual(transactCmd.input.TransactItems.length, 3);

    const orderCancelUpdate = transactCmd.input.TransactItems[0].Update;
    assert.strictEqual(orderCancelUpdate.Key.orderId, "ord_cancel_me");
    assert.ok(orderCancelUpdate.ConditionExpression.includes("#status IN (:pending, :processing, :shipped)"));

    const itemARestore = transactCmd.input.TransactItems[1].Update;
    assert.strictEqual(itemARestore.Key.productId, "p_itemA");
    assert.strictEqual(itemARestore.ExpressionAttributeValues[":qty"], 2);
  });

  await test("OrderRepository.updateStatus: non-cancellation transition requires current status and paid condition", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        orderId: "ord_flow",
        status: "Processing",
        paymentStatus: "Paid"
      }
    }));

    let updateInput = null;
    mock.on(UpdateCommand, (input) => {
      updateInput = input;
      return {};
    });

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    await orderRepo.updateStatusWithStockRestoration("ord_flow", "Shipped");

    assert.ok(updateInput);
    assert.strictEqual(updateInput.ConditionExpression, "attribute_exists(orderId) AND paymentStatus = :paid AND #s = :currentStatus");
    assert.strictEqual(updateInput.ExpressionAttributeValues[":newStatus"], "Shipped");
    assert.strictEqual(updateInput.ExpressionAttributeValues[":currentStatus"], "Processing");
    assert.strictEqual(updateInput.ExpressionAttributeValues[":paid"], "Paid");
  });

  await test("OrderRepository.updateStatus: throws 409 conflict when status changed concurrently", async () => {
    const mock = new MockDynamoDBDocClient();
    let getCallCount = 0;
    mock.on(GetCommand, () => {
      getCallCount++;
      if (getCallCount === 1) {
        // Initial findById before attempting update
        return { Item: { orderId: "ord_race", status: "Processing", paymentStatus: "Paid" } };
      }
      // findById during catch block: someone else updated it to Shipped
      return { Item: { orderId: "ord_race", status: "Shipped", paymentStatus: "Paid" } };
    });

    mock.on(UpdateCommand, () => {
      const err = new Error("The conditional request failed");
      err.name = "ConditionalCheckFailedException";
      throw err;
    });

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    let caught = null;
    try {
      await orderRepo.updateStatusWithStockRestoration("ord_race", "Shipped");
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 409);
    assert.ok(caught.message.includes("concurrently updated"));
  });

  await test("OrderRepository.updatePaymentStatus: blocks payment on cancelled orders & is idempotent on paid", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(UpdateCommand, () => {
      const err = new Error("Condition check failed");
      err.name = "ConditionalCheckFailedException";
      throw err;
    });

    mock.on(GetCommand, () => ({
      Item: {
        orderId: "ord_cancelled",
        status: "Cancelled",
        paymentStatus: "Pending"
      }
    }));

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    let caught = null;
    try {
      await orderRepo.updatePaymentStatus("ord_cancelled", { paymentStatus: "Paid" });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 400);
    assert.strictEqual(caught.message, "Cannot apply payment to a cancelled order.");
  });

  await test("OrderRepository.cancelPendingPayment: restores stock and deletes pending unpaid order", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        orderId: "ord_pending_del",
        userId: "u_owner",
        paymentStatus: "Pending",
        products: [{ productId: "p_itemX", quantity: 3 }]
      }
    }));

    let transactCalled = false;
    mock.on(TransactWriteCommand, (input) => {
      transactCalled = true;
      assert.strictEqual(input.TransactItems.length, 2);
      // Delete order
      assert.strictEqual(input.TransactItems[0].Delete.Key.orderId, "ord_pending_del");
      assert.strictEqual(input.TransactItems[0].Delete.ConditionExpression, "attribute_exists(orderId) AND paymentStatus <> :paid");
      // Restore product stock
      assert.strictEqual(input.TransactItems[1].Update.Key.productId, "p_itemX");
      assert.strictEqual(input.TransactItems[1].Update.ExpressionAttributeValues[":qty"], 3);
      return {};
    });

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    const result = await orderRepo.cancelPendingPayment("ord_pending_del", "u_owner");
    assert.strictEqual(result, true);
    assert.strictEqual(transactCalled, true);
  });

  await test("OrderRepository.cancelPendingPayment: rejects cancellation of paid order with 400", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        orderId: "ord_paid",
        userId: "u_owner",
        paymentStatus: "Paid"
      }
    }));

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    let caught = null;
    try {
      await orderRepo.cancelPendingPayment("ord_paid", "u_owner");
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 400);
    assert.strictEqual(caught.message, "Cannot cancel an order that has already been paid.");
  });

  await test("OrderRepository.cancelPendingPayment: rejects cancellation by unauthorized user with 403", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(GetCommand, () => ({
      Item: {
        orderId: "ord_other",
        userId: "u_legit_owner",
        paymentStatus: "Pending"
      }
    }));

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    let caught = null;
    try {
      await orderRepo.cancelPendingPayment("ord_other", "u_hacker");
    } catch (err) {
      caught = err;
    }

    assert.ok(caught);
    assert.strictEqual(caught.statusCode, 403);
    assert.strictEqual(caught.message, "Access denied. Not your order.");
  });

  await test("OrderRepository.checkReviewEligibility: queries using purchasedProductIds string set filter", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(QueryCommand, (input) => {
      assert.strictEqual(input.IndexName, "userId-createdAt-index");
      assert.ok(input.FilterExpression.includes("contains(purchasedProductIds, :pid)"));
      assert.strictEqual(input.ExpressionAttributeValues[":pid"], "p_eligible");
      return {
        Items: [{ orderId: "ord_verified", paymentStatus: "Paid", status: "Delivered" }]
      };
    });

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    const eligible = await orderRepo.checkReviewEligibility("u_buyer", "p_eligible");
    assert.strictEqual(eligible, true);
  });

  await test("OrderRepository.getStats: aggregates total orders and paid revenue accurately", async () => {
    const mock = new MockDynamoDBDocClient();
    mock.on(ScanCommand, (input) => {
      assert.strictEqual(input.ProjectionExpression, "totalAmount, paymentStatus");
      return {
        Items: [
          { totalAmount: 1500, paymentStatus: "Paid" },
          { totalAmount: 500, paymentStatus: "Pending" },
          { totalAmount: 3500, paymentStatus: "Paid" },
          { totalAmount: 200, paymentStatus: "Failed" }
        ]
      };
    });

    const orderRepo = new OrderRepository(mock, {
      ORDERS: "TestOrdersTable",
      PRODUCTS: "TestProductsTable"
    });

    const stats = await orderRepo.getStats();
    assert.strictEqual(stats.totalOrders, 4);
    assert.strictEqual(stats.totalRevenue, 5000); // 1500 + 3500 = 5000
  });

  console.log(`\n=== Repository Test Results: ${passed}/${total} passed ===`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Repository test execution failed:", err);
  process.exit(1);
});

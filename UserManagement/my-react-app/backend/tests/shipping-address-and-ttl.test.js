const assert = require("assert");
const UserRepository = require("../repositories/userRepository");
const OrderRepository = require("../repositories/orderRepository");
const ProductRepository = require("../repositories/productRepository");

class MockDocClient {
  constructor() {
    this.storage = new Map();
  }

  async send(command) {
    const cmdName = command.constructor.name;

    if (cmdName === "GetCommand") {
      const key = command.input.Key.orderId || command.input.Key.productId || command.input.Key.userId;
      const item = this.storage.get(key);
      return { Item: item ? JSON.parse(JSON.stringify(item)) : undefined };
    }

    if (cmdName === "PutCommand") {
      const item = command.input.Item;
      const key = item.orderId || item.productId || item.userId;
      this.storage.set(key, JSON.parse(JSON.stringify(item)));
      return {};
    }

    if (cmdName === "UpdateCommand") {
      const key = command.input.Key.orderId || command.input.Key.productId || command.input.Key.userId;
      let item = this.storage.get(key) || { ...command.input.Key };

      if (command.input.ExpressionAttributeValues) {
        const values = command.input.ExpressionAttributeValues;
        if (values[":addrList"] !== undefined) {
          item.addresses = values[":addrList"];
        }
        if (values[":addr"] !== undefined) {
          item.shippingAddress = values[":addr"];
        }
        if (values[":now"]) {
          item.updatedAt = values[":now"];
        }
      }
      this.storage.set(key, item);
      return { Attributes: item };
    }

    if (cmdName === "ScanCommand") {
      const items = Array.from(this.storage.values());
      const filter = command.input.FilterExpression || "";
      const vals = command.input.ExpressionAttributeValues || {};

      let filtered = items;
      if (filter.includes("paymentStatus = :pending") && filter.includes("expiresAt <= :now")) {
        const now = vals[":now"];
        filtered = items.filter(
          (i) => i.paymentStatus === "Pending" && i.expiresAt && i.expiresAt <= now
        );
      }
      return { Items: filtered };
    }

    if (cmdName === "TransactWriteCommand") {
      for (const t of command.input.TransactItems) {
        if (t.Put) {
          const item = t.Put.Item;
          const key = item.orderId || item.productId || item.userId;
          this.storage.set(key, JSON.parse(JSON.stringify(item)));
        }
        if (t.Update) {
          const key = t.Update.Key.orderId || t.Update.Key.productId || t.Update.Key.userId;
          let item = this.storage.get(key) || { ...t.Update.Key };
          const vals = t.Update.ExpressionAttributeValues || {};
          const expr = t.Update.UpdateExpression || "";
          if (vals[":qty"] !== undefined) {
            if (expr.includes("- :qty")) {
              item.stock = (item.stock || 0) - vals[":qty"];
            } else if (expr.includes("+ :qty")) {
              item.stock = (item.stock || 0) + vals[":qty"];
            }
          }
          this.storage.set(key, item);
        }
        if (t.Delete) {
          const key = t.Delete.Key.orderId || t.Delete.Key.productId || t.Delete.Key.userId;
          this.storage.delete(key);
        }
      }
      return {};
    }

    return {};
  }
}

async function runTests() {
  console.log("=== Running Shipping Address Book & 20-min Order TTL Tests ===\n");

  const mockClient = new MockDocClient();
  const userRepo = new UserRepository(mockClient, "Shopiee-Users");
  const productRepo = new ProductRepository(mockClient, "Shopiee-Products");
  const orderRepo = new OrderRepository(mockClient, {
    ORDERS: "Shopiee-Orders",
    PRODUCTS: "Shopiee-Products"
  });

  // 1. Seed user and product
  const user = await userRepo.create({
    name: "Aarav Sharma",
    email: "aarav@example.com",
    password: "hashedPassword123"
  });

  mockClient.storage.set("prod_1", {
    productId: "prod_1",
    name: "MacBook Air M2",
    price: 99900,
    stock: 10
  });

  // TEST 1: Address Book - Add Address
  const addr1 = await userRepo.addAddress(user.id, {
    fullName: "Aarav Sharma",
    phone: "9876543210",
    street: "123 Palm Avenue, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560038",
    type: "Home",
    isDefault: true
  });

  assert.strictEqual(addr1.fullName, "Aarav Sharma");
  assert.strictEqual(addr1.isDefault, true);
  console.log("✓ PASS: userRepo.addAddress adds new address and marks default");

  // TEST 2: Address Book - Add Second Address & Check Default Toggling
  const addr2 = await userRepo.addAddress(user.id, {
    fullName: "Aarav Sharma (Office)",
    phone: "9876543211",
    street: "Prestige Tech Park, Outer Ring Road",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560103",
    type: "Work",
    isDefault: true
  });

  const list = await userRepo.getAddresses(user.id);
  assert.strictEqual(list.length, 2);
  const updatedAddr1 = list.find((a) => a.addressId === addr1.addressId);
  const updatedAddr2 = list.find((a) => a.addressId === addr2.addressId);
  assert.strictEqual(updatedAddr1.isDefault, false);
  assert.strictEqual(updatedAddr2.isDefault, true);
  console.log("✓ PASS: userRepo.addAddress seamlessly toggles default address");

  // TEST 3: Create Order with Shipping Address & 20-Minute TTL
  const order = await orderRepo.createOrderWithStockDeduction({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    rawProducts: [{ productId: "prod_1", quantity: 2 }],
    productRepo,
    shippingAddress: addr2
  });

  assert.strictEqual(order.shippingAddress.city, "Bengaluru");
  assert.strictEqual(order.shippingAddress.pinCode, "560103");
  assert(order.expiresAt > Math.floor(Date.now() / 1000));
  console.log("✓ PASS: orderRepo.createOrderWithStockDeduction stores shippingAddress & expiresAt");

  // Verify stock was reduced from 10 to 8
  const pRecord = mockClient.storage.get("prod_1");
  assert.strictEqual(pRecord.stock, 8);
  console.log("✓ PASS: Product stock atomically deducted during order creation");

  // TEST 4: Update Shipping Address on Pending Order
  const updatedOrder = await orderRepo.updateShippingAddress(order.orderId, user.id, addr1);
  assert.strictEqual(updatedOrder.shippingAddress.type, "Home");
  console.log("✓ PASS: orderRepo.updateShippingAddress updates delivery location on pending order");

  // TEST 5: Reclaim Expired Pending Order & Auto-Restore Stock
  // Manually age the order's expiresAt to the past
  const rawOrder = mockClient.storage.get(order.orderId);
  rawOrder.expiresAt = Math.floor(Date.now() / 1000) - 60; // expired 1 minute ago
  mockClient.storage.set(order.orderId, rawOrder);

  const reclaimResult = await orderRepo.reclaimExpiredPendingOrders();
  assert.strictEqual(reclaimResult.reclaimedCount, 1);

  // Check product stock restored from 8 back to 10
  const restoredProd = mockClient.storage.get("prod_1");
  assert.strictEqual(restoredProd.stock, 10);
  console.log("✓ PASS: orderRepo.reclaimExpiredPendingOrders restores stock for abandoned orders");

  console.log("\n=== All Shipping Address & Stock TTL Tests Passed (5/5) ===\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

const assert = require("assert");
const CouponRepository = require("../repositories/couponRepository");

/**
 * In-memory Mock DynamoDB client for offline CouponRepository testing
 */
class MockCouponDynamoClient {
  constructor() {
    this.store = new Map();
  }

  async send(command) {
    const cmdName = command.constructor.name;

    if (cmdName === "PutItemCommand") {
      const { Item, ConditionExpression } = command.input;
      const { unmarshall } = require("@aws-sdk/util-dynamodb");
      const unmarshalled = unmarshall(Item);
      const code = unmarshalled.code;

      if (ConditionExpression && ConditionExpression.includes("attribute_not_exists") && this.store.has(code)) {
        const err = new Error("The conditional request failed");
        err.name = "ConditionalCheckFailedException";
        throw err;
      }

      this.store.set(code, Item);
      return {};
    }

    if (cmdName === "GetItemCommand") {
      const { Key } = command.input;
      const { unmarshall } = require("@aws-sdk/util-dynamodb");
      const unmarshalledKey = unmarshall(Key);
      const item = this.store.get(unmarshalledKey.code);
      return { Item: item || null };
    }

    if (cmdName === "ScanCommand") {
      return { Items: Array.from(this.store.values()) };
    }

    if (cmdName === "DeleteItemCommand") {
      const { Key, ConditionExpression } = command.input;
      const { unmarshall } = require("@aws-sdk/util-dynamodb");
      const code = unmarshall(Key).code;

      if (ConditionExpression && !this.store.has(code)) {
        const err = new Error("Conditional check failed");
        err.name = "ConditionalCheckFailedException";
        throw err;
      }

      this.store.delete(code);
      return {};
    }

    if (cmdName === "UpdateItemCommand") {
      const { Key } = command.input;
      const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");
      const code = unmarshall(Key).code;
      const raw = this.store.get(code);
      if (!raw) return {};

      const current = unmarshall(raw);
      current.usageCount = (current.usageCount || 0) + 1;
      current.updatedAt = new Date().toISOString();
      this.store.set(code, marshall(current, { removeUndefinedValues: true }));
      return {};
    }

    throw new Error(`Unhandled mock command: ${cmdName}`);
  }
}

async function runCouponTests() {
  console.log("=== Running DynamoDB Coupon Repository Offline Tests ===");
  const mockClient = new MockCouponDynamoClient();
  const repo = new CouponRepository(mockClient, "MockCouponsTable");

  // 1. Create Coupon
  const coupon = await repo.create({
    code: "welcome10",
    description: "10% off for new customers",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 500,
    maxDiscountAmount: 200,
    expirationDate: new Date(Date.now() + 86400000).toISOString(),
    maxTotalUsage: 100,
    maxUsagePerCustomer: 2
  });

  assert.strictEqual(coupon.code, "WELCOME10", "Code must be converted to uppercase");
  assert.strictEqual(coupon.discountValue, 10);
  assert.strictEqual(coupon.minOrderAmount, 500);
  assert.strictEqual(coupon.maxDiscountAmount, 200);
  assert.strictEqual(coupon.usageCount, 0);
  assert.strictEqual(coupon.isActive, true);
  console.log("✓ PASS: CouponRepository.create: stores uppercase code, defaults, and usage metrics");

  // 2. Reject duplicate code
  let duplicateRejected = false;
  try {
    await repo.create({
      code: "WELCOME10",
      discountValue: 20,
      expirationDate: new Date(Date.now() + 86400000).toISOString()
    });
  } catch (err) {
    duplicateRejected = true;
    assert.strictEqual(err.status, 400);
  }
  assert.strictEqual(duplicateRejected, true, "Must reject duplicate coupon code");
  console.log("✓ PASS: CouponRepository.create: rejects duplicate code with 400");

  // 3. Find by Code
  const found = await repo.findByCode("welcome10");
  assert.ok(found);
  assert.strictEqual(found.code, "WELCOME10");
  assert.strictEqual(found.discountValue, 10);
  console.log("✓ PASS: CouponRepository.findByCode: case-insensitive code lookup");

  // 4. Validate Coupon - Below minimum order amount
  const belowMin = await repo.validateCoupon("WELCOME10", 400);
  assert.strictEqual(belowMin.valid, false);
  assert.match(belowMin.message, /Minimum order amount of/);
  console.log("✓ PASS: CouponRepository.validateCoupon: blocks orders below minOrderAmount");

  // 5. Validate Coupon - Valid percentage calculation with cap
  const validSmall = await repo.validateCoupon("WELCOME10", 1000);
  assert.strictEqual(validSmall.valid, true);
  assert.strictEqual(validSmall.discountAmount, 100, "10% of 1000 = 100");

  const validLarge = await repo.validateCoupon("WELCOME10", 5000);
  assert.strictEqual(validLarge.valid, true);
  assert.strictEqual(validLarge.discountAmount, 200, "10% of 5000 = 500, capped at maxDiscountAmount 200");
  console.log("✓ PASS: CouponRepository.validateCoupon: calculates percentage discount and respects cap");

  // 6. Fixed Discount Coupon
  await repo.create({
    code: "FLAT150",
    description: "Flat ₹150 discount",
    discountType: "fixed",
    discountValue: 150,
    minOrderAmount: 300,
    expirationDate: new Date(Date.now() + 86400000).toISOString()
  });

  const fixedValid = await repo.validateCoupon("FLAT150", 1000);
  assert.strictEqual(fixedValid.valid, true);
  assert.strictEqual(fixedValid.discountAmount, 150);
  console.log("✓ PASS: CouponRepository.validateCoupon: calculates flat fixed discount accurately");

  // 7. Expired Coupon
  await repo.create({
    code: "EXPIRED50",
    discountType: "percentage",
    discountValue: 50,
    expirationDate: new Date(Date.now() - 10000).toISOString() // Past
  });

  const expiredRes = await repo.validateCoupon("EXPIRED50", 1000);
  assert.strictEqual(expiredRes.valid, false);
  assert.match(expiredRes.message, /expired/i);
  console.log("✓ PASS: CouponRepository.validateCoupon: rejects expired coupons");

  // 8. Record Usage
  await repo.recordUsage("WELCOME10", "user_123");
  const afterUsage = await repo.findByCode("WELCOME10");
  assert.strictEqual(afterUsage.usageCount, 1);
  console.log("✓ PASS: CouponRepository.recordUsage: atomically increments coupon usageCount");

  // 9. Update Coupon
  const updated = await repo.update("WELCOME10", { isActive: false });
  assert.strictEqual(updated.isActive, false);
  const inactiveCheck = await repo.validateCoupon("WELCOME10", 1000);
  assert.strictEqual(inactiveCheck.valid, false);
  assert.match(inactiveCheck.message, /no longer active/i);
  console.log("✓ PASS: CouponRepository.update: updates active status and blocks inactive coupons");

  // 10. Delete Coupon
  const deleted = await repo.delete("FLAT150");
  assert.strictEqual(deleted, true);
  const deletedFound = await repo.findByCode("FLAT150");
  assert.strictEqual(deletedFound, null);
  console.log("✓ PASS: CouponRepository.delete: cleanly deletes coupon");

  console.log("\n=== Coupon Repository Test Results: 10/10 passed ===\n");
}

if (require.main === module) {
  runCouponTests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
}

module.exports = { runCouponTests };


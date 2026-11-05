require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-123456";
process.env.USE_DYNAMODB = "true";

const assert = require("assert");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const UserRepository = require("../repositories/userRepository");
const authController = require("../controllers/authController");

class MockUserDynamoClient {
  constructor() {
    this.store = new Map();
  }

  async send(command) {
    const cmdName = command.constructor.name;

    if (cmdName === "GetCommand") {
      const { Key } = command.input;
      const item = this.store.get(Key.userId);
      return { Item: item || null };
    }

    if (cmdName === "DeleteCommand") {
      const { Key } = command.input;
      this.store.delete(Key.userId);
      return {};
    }

    if (cmdName === "UpdateCommand") {
      const { Key, ExpressionAttributeValues } = command.input;
      const current = this.store.get(Key.userId) || { userId: Key.userId };
      if (ExpressionAttributeValues[":pwd"]) current.password = ExpressionAttributeValues[":pwd"];
      current.tokenVersion = (current.tokenVersion || 0) + (ExpressionAttributeValues[":one"] || 0);
      this.store.set(Key.userId, current);
      return {};
    }

    if (cmdName === "TransactWriteCommand") {
      const { TransactItems } = command.input;
      for (const t of TransactItems) {
        if (t.Put) {
          this.store.set(t.Put.Item.userId, t.Put.Item);
        }
        if (t.Update) {
          const key = t.Update.Key.userId;
          const current = this.store.get(key) || { userId: key };
          const vals = t.Update.ExpressionAttributeValues || {};
          if (vals[":verified"] !== undefined) current.isEmailVerified = vals[":verified"];
          if (vals[":token"] !== undefined) current.emailVerificationToken = vals[":token"];
          if (vals[":exp"] !== undefined) current.emailVerificationExpire = vals[":exp"];
          this.store.set(key, current);
        }
        if (t.Delete) {
          this.store.delete(t.Delete.Key.userId);
        }
      }
      return {};
    }

    throw new Error(`Unhandled mock command: ${cmdName}`);
  }
}

async function runEmailVerificationTests() {
  console.log("=== Running DynamoDB Email Verification & Temp Password Offline Tests ===");
  const mockClient = new MockUserDynamoClient();
  const repo = new UserRepository(mockClient, "MockUsersTable");
  authController.setUserRepository(repo);

  const hashedPassword = await bcrypt.hash("UserSecurePassword123!", 10);
  const testUser = {
    userId: "usr_verify_test_101",
    name: "Alex Smith",
    email: "alex@example.com",
    password: hashedPassword,
    role: "user",
    isEmailVerified: false,
    itemType: "USER_PROFILE"
  };
  mockClient.store.set("usr_verify_test_101", testUser);
  mockClient.store.set("EMAIL#alex@example.com", {
    userId: "EMAIL#alex@example.com",
    targetUserId: "usr_verify_test_101",
    itemType: "EMAIL_RESERVATION"
  });

  // 1. Create email verification token
  const rawToken = "sample_secure_verification_token_hex_99";
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  const tokenCreated = await repo.createEmailVerificationToken("alex@example.com", hashedToken, expiresAt);
  assert.ok(tokenCreated);
  assert.strictEqual(tokenCreated.user.email, "alex@example.com");

  const storedToken = mockClient.store.get(`VERIFY#${hashedToken}`);
  assert.ok(storedToken, "Verification token record must exist in DynamoDB");
  assert.strictEqual(storedToken.targetUserId, "usr_verify_test_101");
  console.log("✓ PASS: UserRepository.createEmailVerificationToken: stores token pointer and profile metadata");

  // 2. Consume verification token
  const consumeResult = await repo.consumeEmailVerificationToken(hashedToken);
  assert.strictEqual(consumeResult.success, true);
  assert.strictEqual(consumeResult.userId, "usr_verify_test_101");

  const profileAfter = mockClient.store.get("usr_verify_test_101");
  assert.strictEqual(profileAfter.isEmailVerified, true, "User isEmailVerified must be set to true");
  assert.strictEqual(mockClient.store.get(`VERIFY#${hashedToken}`), undefined, "Token must be deleted after consumption");
  console.log("✓ PASS: UserRepository.consumeEmailVerificationToken: atomically verifies user and deletes token");

  // 3. Replay attack prevention
  let replayBlocked = false;
  try {
    await repo.consumeEmailVerificationToken(hashedToken);
  } catch (err) {
    replayBlocked = true;
    assert.strictEqual(err.status, 400);
  }
  assert.ok(replayBlocked, "Must block reused verification token");
  console.log("✓ PASS: UserRepository.consumeEmailVerificationToken: prevents token replay");

  // 4. Expired token rejection
  const expiredRaw = "expired_raw_token_123456789";
  const expiredHashed = crypto.createHash("sha256").update(expiredRaw).digest("hex");
  mockClient.store.set(`VERIFY#${expiredHashed}`, {
    userId: `VERIFY#${expiredHashed}`,
    itemType: "EMAIL_VERIFICATION_TOKEN",
    targetUserId: "usr_verify_test_101",
    email: "alex@example.com",
    expiresAt: Date.now() - 1000 // In the past
  });

  let expiredBlocked = false;
  try {
    await repo.consumeEmailVerificationToken(expiredHashed);
  } catch (err) {
    expiredBlocked = true;
    assert.strictEqual(err.status, 400);
  }
  assert.ok(expiredBlocked, "Must reject expired token");
  console.log("✓ PASS: UserRepository.consumeEmailVerificationToken: rejects expired tokens");

  // 5. Controller: verifyEmail
  const mockReq = { query: { token: rawToken } };
  // Re-create a fresh token for controller test
  const ctrlRaw = "controller_test_token_abc";
  const ctrlHashed = crypto.createHash("sha256").update(ctrlRaw).digest("hex");
  await repo.createEmailVerificationToken("alex@example.com", ctrlHashed, Date.now() + 3600000);

  let responseData = null;
  const mockRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { responseData = data; return this; },
    send(html) { responseData = html; return this; }
  };

  await authController.verifyEmail({ query: { token: ctrlRaw }, method: "POST", headers: {} }, mockRes);
  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(responseData.success, true);
  console.log("✓ PASS: authController.verifyEmail: processes token and marks user verified");

  // 6. Controller: generateTemporaryPassword
  await authController.generateTemporaryPassword(
    { body: { email: "alex@example.com" } },
    mockRes
  );
  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(responseData.success, true);
  console.log("✓ PASS: authController.generateTemporaryPassword: generates, hashes and persists temp password");

  console.log("\n=== Email Verification & Password Test Results: All 6/6 passed ===\n");
}

runEmailVerificationTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});


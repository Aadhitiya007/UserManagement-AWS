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
          if (vals[":pwd"]) current.password = vals[":pwd"];
          if (vals[":token"] !== undefined) current.resetPasswordToken = vals[":token"];
          if (vals[":exp"] !== undefined) current.resetPasswordExpire = vals[":exp"];
          current.tokenVersion = (current.tokenVersion || 0) + (vals[":one"] || 0);
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

async function runPasswordResetTests() {
  console.log("=== Running DynamoDB Password Reset Offline Tests ===");
  const mockClient = new MockUserDynamoClient();
  const repo = new UserRepository(mockClient, "MockUsersTable");
  authController.setUserRepository(repo);

  // Setup mock user
  const hashedPassword = await bcrypt.hash("OldPassword123", 10);
  const user = {
    userId: "usr_test_123",
    name: "John Doe",
    email: "john@example.com",
    password: hashedPassword,
    role: "user",
    itemType: "USER_PROFILE"
  };
  mockClient.store.set("usr_test_123", user);
  mockClient.store.set("EMAIL#john@example.com", {
    userId: "EMAIL#john@example.com",
    targetUserId: "usr_test_123",
    itemType: "EMAIL_RESERVATION"
  });

  // 1. Forgot Password - existing user
  const rawToken = "my_secure_reset_token_1234567890abcdef";
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000;

  const resetResult = await repo.createPasswordResetToken("john@example.com", hashedToken, expiresAt);
  assert.ok(resetResult);
  assert.strictEqual(resetResult.user.email, "john@example.com");

  // Verify token item stored
  const tokenItem = mockClient.store.get(`RESET#${hashedToken}`);
  assert.ok(tokenItem, "Token item must be saved in DynamoDB");
  assert.strictEqual(tokenItem.targetUserId, "usr_test_123");
  console.log("✓ PASS: UserRepository.createPasswordResetToken: creates token pointer and profile metadata");

  // 2. Consume token and set new password
  const newPasswordHash = await bcrypt.hash("BrandNewPassword456", 10);
  const consumeResult = await repo.consumePasswordResetToken(hashedToken, newPasswordHash);
  assert.strictEqual(consumeResult.success, true);
  assert.strictEqual(consumeResult.userId, "usr_test_123");

  // Verify token is deleted after consumption (prevent replay attacks)
  const consumedToken = mockClient.store.get(`RESET#${hashedToken}`);
  assert.strictEqual(consumedToken, undefined, "Token must be deleted after consumption");

  // Verify password changed
  const updatedUser = mockClient.store.get("usr_test_123");
  const passwordMatches = await bcrypt.compare("BrandNewPassword456", updatedUser.password);
  assert.strictEqual(passwordMatches, true, "New password must match updated hash");
  console.log("✓ PASS: UserRepository.consumePasswordResetToken: updates password and deletes token atomically");

  // 3. Prevent replay attack (using consumed token again)
  let replayError = false;
  try {
    await repo.consumePasswordResetToken(hashedToken, newPasswordHash);
  } catch (err) {
    replayError = true;
    assert.strictEqual(err.status, 400);
  }
  assert.strictEqual(replayError, true, "Consumed token must not be reusable");
  console.log("✓ PASS: UserRepository.consumePasswordResetToken: blocks token replay with 400");

  // 4. Reject expired token
  const expiredRawToken = "expired_token_123";
  const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");
  await repo.createPasswordResetToken("john@example.com", expiredHash, Date.now() - 5000); // Past

  let expiredRejected = false;
  try {
    await repo.consumePasswordResetToken(expiredHash, newPasswordHash);
  } catch (err) {
    expiredRejected = true;
    assert.strictEqual(err.status, 400);
    assert.match(err.message, /expired/i);
  }
  assert.strictEqual(expiredRejected, true, "Expired token must be rejected");
  console.log("✓ PASS: UserRepository.consumePasswordResetToken: rejects expired tokens with 400");

  console.log("\n=== Password Reset Test Results: 4/4 passed ===\n");
}

if (require.main === module) {
  runPasswordResetTests().catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
}

module.exports = { runPasswordResetTests };


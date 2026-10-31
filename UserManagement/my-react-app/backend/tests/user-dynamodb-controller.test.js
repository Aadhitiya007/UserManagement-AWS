require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-123456";
process.env.USE_DYNAMODB = "true";

const assert = require("assert");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");

/**
 * In-memory Mock UserRepository for testing controller routing,
 * input validation, status codes, JWT generation, and error mapping offline.
 */
class InMemoryUserRepository {
  constructor() {
    this.users = new Map(); // userId -> user
    this.emails = new Map(); // normalizedEmail -> userId
  }

  async findByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const userId = this.emails.get(normalized);
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async findById(userId) {
    return this.users.get(userId) || null;
  }

  async create(userData) {
    const normalized = userData.email.trim().toLowerCase();
    if (this.emails.has(normalized)) {
      const err = new Error("Email is already registered");
      err.statusCode = 400;
      throw err;
    }

    const userId = `u_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      _id: userId,
      id: userId,
      name: userData.name,
      email: normalized,
      password: userData.password,
      role: userData.role || "user",
      age: userData.age,
      country: userData.country,
      phone: userData.phone,
      createdAt: new Date().toISOString()
    };

    this.emails.set(normalized, userId);
    this.users.set(userId, user);
    return user;
  }

  async update(userId, updateFields) {
    const existing = this.users.get(userId);
    if (!existing) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    if (updateFields.email) {
      const newEmail = updateFields.email.trim().toLowerCase();
      if (newEmail !== existing.email) {
        if (this.emails.has(newEmail)) {
          const err = new Error("Email is already registered");
          err.statusCode = 400;
          throw err;
        }
        this.emails.delete(existing.email);
        this.emails.set(newEmail, userId);
        existing.email = newEmail;
      }
    }

    if (updateFields.name !== undefined) existing.name = updateFields.name;
    if (updateFields.role !== undefined) existing.role = updateFields.role;
    if (updateFields.age !== undefined) existing.age = updateFields.age;
    if (updateFields.country !== undefined) existing.country = updateFields.country;
    if (updateFields.phone !== undefined) existing.phone = updateFields.phone;

    return existing;
  }

  async delete(userId) {
    const existing = this.users.get(userId);
    if (!existing) return false;
    this.emails.delete(existing.email);
    this.users.delete(userId);
    return true;
  }

  async listUsers(options = {}) {
    let list = Array.from(this.users.values()).map((u) => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });

    if (options.search) {
      const term = options.search.toLowerCase();
      list = list.filter((u) =>
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.role && u.role.toLowerCase().includes(term))
      );
    }

    return { users: list };
  }
}

/**
 * Creates mock Express req and res objects to test controller handlers.
 */
function createMockReqRes(options = {}) {
  const req = {
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers: options.headers || {},
    user: options.user || null
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  return { req, res };
}

async function runControllerTests() {
  console.log("=== Running DynamoDB User & Auth Controller Tests ===\n");
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
  // Test Suite: authController with DynamoDB
  // -------------------------------------------------------------
  await test("authController.register: creates user, hashes password, returns 201 and JWT", async () => {
    const mockRepo = new InMemoryUserRepository();
    authController.setUserRepository(mockRepo);

    const { req, res } = createMockReqRes({
      body: {
        name: "Carol White",
        email: "carol@example.com",
        password: "securePassword123"
      }
    });

    await authController.register(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.message, "User registered successfully");
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.name, "Carol White");
    assert.strictEqual(res.body.user.email, "carol@example.com");
    assert.strictEqual(res.body.user.role, "user");
    assert.ok(res.body.user.id);

    // Verify stored password was hashed with bcrypt
    const stored = await mockRepo.findByEmail("carol@example.com");
    assert.notStrictEqual(stored.password, "securePassword123");
    const isBcrypt = await bcrypt.compare("securePassword123", stored.password);
    assert.strictEqual(isBcrypt, true);

    // Verify JWT payload
    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.strictEqual(decoded.email, "carol@example.com");
    assert.strictEqual(decoded.role, "user");
  });

  await test("authController.register: rejects duplicate email with 400", async () => {
    const mockRepo = new InMemoryUserRepository();
    authController.setUserRepository(mockRepo);

    // Pre-populate user
    await mockRepo.create({
      name: "Existing User",
      email: "duplicate@example.com",
      password: "hash"
    });

    const { req, res } = createMockReqRes({
      body: {
        name: "New Attempt",
        email: "DUPLICATE@example.com",
        password: "validPassword123"
      }
    });

    await authController.register(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, "Email is already registered");
  });

  await test("authController.register: validates required fields", async () => {
    const mockRepo = new InMemoryUserRepository();
    authController.setUserRepository(mockRepo);

    const { req, res } = createMockReqRes({
      body: { name: "Missing Password", email: "user@test.com" }
    });

    await authController.register(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.body.message.includes("required"));
  });

  await test("authController.login: authenticates valid password and returns 200 with JWT", async () => {
    const mockRepo = new InMemoryUserRepository();
    authController.setUserRepository(mockRepo);

    const hashedPassword = await bcrypt.hash("correctPassword", 10);
    await mockRepo.create({
      name: "David Login",
      email: "david@example.com",
      password: hashedPassword,
      role: "admin"
    });

    const { req, res } = createMockReqRes({
      body: {
        email: "David@Example.com",
        password: "correctPassword"
      }
    });

    await authController.login(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, "Login successful");
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, "admin");

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.strictEqual(decoded.email, "david@example.com");
    assert.strictEqual(decoded.role, "admin");
  });

  await test("authController.login: rejects invalid password with 400", async () => {
    const mockRepo = new InMemoryUserRepository();
    authController.setUserRepository(mockRepo);

    const hashedPassword = await bcrypt.hash("realPassword", 10);
    await mockRepo.create({
      name: "Dave",
      email: "dave@example.com",
      password: hashedPassword
    });

    const { req, res } = createMockReqRes({
      body: {
        email: "dave@example.com",
        password: "wrongPassword"
      }
    });

    await authController.login(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, "Invalid email or password");
  });

  await test("authController.login: rejects non-existent email with 400", async () => {
    const mockRepo = new InMemoryUserRepository();
    authController.setUserRepository(mockRepo);

    const { req, res } = createMockReqRes({
      body: {
        email: "nonexistent@example.com",
        password: "somePassword"
      }
    });

    await authController.login(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, "Invalid email or password");
  });

  // -------------------------------------------------------------
  // Test Suite: userController with DynamoDB
  // -------------------------------------------------------------
  await test("userController.getUsers: lists users with passwords removed and supports search", async () => {
    const mockRepo = new InMemoryUserRepository();
    userController.setUserRepository(mockRepo);

    await mockRepo.create({ name: "Alice Admin", email: "alice@company.com", password: "pw1", role: "admin" });
    await mockRepo.create({ name: "Bob Buyer", email: "bob@company.com", password: "pw2", role: "user" });

    // Test search filter
    const { req, res } = createMockReqRes({
      query: { search: "admin" }
    });

    await userController.getUsers(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].name, "Alice Admin");
    assert.strictEqual(res.body[0].password, undefined);
  });

  await test("userController.updateUser: updates profile and sanitizes password", async () => {
    const mockRepo = new InMemoryUserRepository();
    userController.setUserRepository(mockRepo);

    const user = await mockRepo.create({
      name: "Old Profile",
      email: "profile@test.com",
      password: "secret_hash"
    });

    const { req, res } = createMockReqRes({
      params: { id: user.id },
      body: { name: "Updated Profile", country: "India" }
    });

    await userController.updateUser(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, "User updated successfully");
    assert.strictEqual(res.body.user.name, "Updated Profile");
    assert.strictEqual(res.body.user.country, "India");
    assert.strictEqual(res.body.user.password, undefined);
  });

  await test("userController.updateUser: returns 404 for missing user", async () => {
    const mockRepo = new InMemoryUserRepository();
    userController.setUserRepository(mockRepo);

    const { req, res } = createMockReqRes({
      params: { id: "u_ghost" },
      body: { name: "No one" }
    });

    await userController.updateUser(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.message, "User not found");
  });

  await test("userController.updateUser: returns 400 when updating to an already registered email", async () => {
    const mockRepo = new InMemoryUserRepository();
    userController.setUserRepository(mockRepo);

    await mockRepo.create({ name: "User One", email: "taken@example.com", password: "pw" });
    const userTwo = await mockRepo.create({ name: "User Two", email: "free@example.com", password: "pw" });

    const { req, res } = createMockReqRes({
      params: { id: userTwo.id },
      body: { email: "taken@example.com" }
    });

    await userController.updateUser(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.message, "Email is already registered");
  });

  await test("userController.deleteUser: deletes existing user and returns 200", async () => {
    const mockRepo = new InMemoryUserRepository();
    userController.setUserRepository(mockRepo);

    const user = await mockRepo.create({ name: "To Delete", email: "del@example.com", password: "pw" });

    const { req, res } = createMockReqRes({
      params: { id: user.id }
    });

    await userController.deleteUser(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.message, "User deleted successfully");

    // Verify user is gone
    const check = await mockRepo.findById(user.id);
    assert.strictEqual(check, null);
  });

  await test("userController.deleteUser: returns 404 when user does not exist", async () => {
    const mockRepo = new InMemoryUserRepository();
    userController.setUserRepository(mockRepo);

    const { req, res } = createMockReqRes({
      params: { id: "u_not_found" }
    });

    await userController.deleteUser(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.message, "User not found");
  });

  console.log(`\n=== User Controller Test Results: ${passed}/${total} passed ===`);
  process.exit(passed === total ? 0 : 1);
}

runControllerTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});


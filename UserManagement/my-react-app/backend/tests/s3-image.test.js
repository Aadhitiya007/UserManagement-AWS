require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

// Ensure non-production mock AWS credentials and bucket for standalone unit tests
if (!process.env.AWS_REGION || process.env.AWS_REGION === "your_region") {
  process.env.AWS_REGION = "ap-south-2";
}
if (!process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME === "your_bucket_name") {
  process.env.AWS_S3_BUCKET_NAME = "usermanagement-aws-aadhitiya-2026";
}
if (!process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID === "your_aws_access_key") {
  process.env.AWS_ACCESS_KEY_ID = "mock-test-access-key-id";
}
if (!process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY === "your_aws_secret_key") {
  process.env.AWS_SECRET_ACCESS_KEY = "mock-test-secret-access-key-987654";
}
const assert = require("assert");
const {
  getProductWithImageUrl,
  getProductsWithImageUrls
} = require("../controllers/productController");

async function runTests() {
  console.log("=== Running S3 Private Image Presigning Tests ===\n");
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  ${err.message}`);
    }
  }

  // Test 1: Empty or missing image
  await testAsync("Handles missing / empty image", async () => {
    const res = await getProductWithImageUrl({ name: "Test Product", image: "" });
    assert.strictEqual(res.imageUrl, "");
    assert.strictEqual(res.image, "");
  });

  // Test 2: Base64 data URI
  await testAsync("Preserves Base64 data URI without S3 signing", async () => {
    const base64Data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const res = await getProductWithImageUrl({ name: "Base64 Product", image: base64Data });
    assert.strictEqual(res.imageUrl, base64Data);
  });

  // Test 3: Local disk fallback path
  await testAsync("Formats local upload paths with leading slash", async () => {
    const res = await getProductWithImageUrl({ name: "Local Product", image: "uploads/products/sample.png" });
    assert.strictEqual(res.imageUrl, "/uploads/products/sample.png");
  });

  // Test 4: External URL (e.g. Unsplash)
  await testAsync("Preserves external non-S3 URLs", async () => {
    const unsplashUrl = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600";
    const res = await getProductWithImageUrl({ name: "Unsplash Product", image: unsplashUrl });
    assert.strictEqual(res.imageUrl, unsplashUrl);
  });

  // Test 5: Canonical S3 key (products/...)
  await testAsync("Generates temporary presigned URL for canonical S3 key", async () => {
    const canonicalKey = "products/1792754327334-community-connect-certificate.PNG";
    const res = await getProductWithImageUrl({ name: "S3 Product", image: canonicalKey });
    assert.ok(res.imageUrl.startsWith("https://"), "imageUrl must start with https://");
    assert.ok(res.imageUrl.includes("X-Amz-Signature="), "URL must contain AWS signature parameter");
    assert.ok(res.imageUrl.includes("X-Amz-Algorithm="), "URL must contain AWS algorithm parameter");
    assert.ok(res.imageUrl.includes("X-Amz-Expires="), "URL must contain AWS expiration parameter");
    // Verify credentials are NOT exposed in plain text
    assert.strictEqual(res.imageUrl.includes(process.env.AWS_SECRET_ACCESS_KEY), false, "Secret key must never be in URL");
  });

  // Test 6: Legacy full S3 URL belonging to the configured bucket
  await testAsync("Converts legacy full S3 URL into signed URL", async () => {
    const bucket = process.env.AWS_S3_BUCKET_NAME || "usermanagement-uploads-15112004-836548370281-ap-south-2-an";
    const region = process.env.AWS_REGION || "ap-south-2";
    const legacyUrl = `https://${bucket}.s3.${region}.amazonaws.com/products/1792754327334-community-connect-certificate.PNG`;
    const res = await getProductWithImageUrl({ name: "Legacy S3 Product", image: legacyUrl });
    assert.ok(res.imageUrl.startsWith("https://"), "imageUrl must start with https://");
    assert.ok(res.imageUrl.includes("X-Amz-Signature="), "Legacy URL must be converted into signed URL");
  });

  // Test 7: Batch products resolution
  await testAsync("Resolves multiple products in batch", async () => {
    const products = [
      { name: "P1", image: "products/test1.png" },
      { name: "P2", image: "https://images.unsplash.com/sample" },
      { name: "P3", image: "data:image/jpeg;base64,abc" }
    ];
    const resolved = await getProductsWithImageUrls(products);
    assert.strictEqual(resolved.length, 3);
    assert.ok(resolved[0].imageUrl.includes("X-Amz-Signature="));
    assert.strictEqual(resolved[1].imageUrl, "https://images.unsplash.com/sample");
    assert.strictEqual(resolved[2].imageUrl, "data:image/jpeg;base64,abc");
  });

  // Test 8: S3 image removal on product deletion
  await testAsync("Safely purges and invokes S3 deletion for product images", async () => {
    const s3 = require("../config/s3");
    const { deleteProductImageFile } = require("../controllers/productController");

    // Mock s3.send to ensure 100% offline isolation without real network requests
    const originalSend = s3.send;
    const capturedCommands = [];
    s3.send = async (cmd) => {
      capturedCommands.push(cmd);
      return { $metadata: { httpStatusCode: 204 } };
    };

    try {
      // Verify it handles invalid / empty images cleanly without invoking S3
      await deleteProductImageFile("");
      await deleteProductImageFile("data:image/png;base64,123");
      assert.strictEqual(capturedCommands.length, 0, "No S3 deletion command should be sent for empty or data URI");

      // Verify it handles canonical S3 key
      await deleteProductImageFile("products/test-image-removal-key.jpg");
      assert.strictEqual(capturedCommands.length, 1, "Exactly one S3 deletion command should be sent");
      assert.strictEqual(capturedCommands[0].constructor.name, "DeleteObjectCommand");
      assert.strictEqual(capturedCommands[0].input.Key, "products/test-image-removal-key.jpg");
      const bucket = process.env.AWS_S3_BUCKET_NAME || "usermanagement-aws-aadhitiya-2026";
      assert.strictEqual(capturedCommands[0].input.Bucket, bucket);

      // Verify it handles full S3 URL
      await deleteProductImageFile(`https://${bucket}.s3.amazonaws.com/products/test-legacy.jpg`);
      assert.strictEqual(capturedCommands.length, 2, "Second S3 deletion command should be sent");
      assert.strictEqual(capturedCommands[1].constructor.name, "DeleteObjectCommand");
      assert.strictEqual(capturedCommands[1].input.Key, "products/test-legacy.jpg");
      assert.strictEqual(capturedCommands[1].input.Bucket, bucket);
    } finally {
      // Restore original s3.send method
      s3.send = originalSend;
    }
  });

  console.log(`\n=== Test Results: ${passed}/${total} passed ===`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

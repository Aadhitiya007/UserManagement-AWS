require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const {
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = require("../config/s3");

async function verifyS3Access() {
  console.log("=== Verifying AWS S3 Configuration & Live Access ===\n");
  const bucketName = s3.getBucketName();
  const region = s3.getRegion();

  console.log(`Region:      ${region}`);
  console.log(`Bucket Name: ${bucketName || "(not configured)"}`);

  if (!bucketName) {
    console.error("\n❌ Error: AWS_S3_BUCKET_NAME is not defined in backend/.env");
    process.exit(1);
  }

  // Check if credentials are set
  const hasKey = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== "your_aws_access_key");
  const hasSecret = Boolean(process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_SECRET_ACCESS_KEY !== "your_aws_secret_key");
  console.log(`Credentials configured in .env: Key=${hasKey}, Secret=${hasSecret}`);

  // 1. Verify Bucket Connectivity
  console.log("\n1. Checking bucket accessibility (HeadBucketCommand)...");
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log("   ✓ Bucket is accessible and verified via HeadBucketCommand.");
  } catch (err) {
    const status = err.$metadata ? err.$metadata.httpStatusCode : null;
    console.log("   Diagnostics:", { name: err.name, message: err.message, httpStatusCode: status });

    if (status === 200 || status === 301) {
      console.log(`   ✓ Bucket is accessible (returned HTTP status ${status}).`);
    } else if (status === 403) {
      console.error(`   ❌ Access Denied (HTTP 403). The provided credentials do not have permission to access "${bucketName}".`);
      console.error("   Please ensure the IAM user/role has 's3:ListBucket' on 'arn:aws:s3:::" + bucketName + "'.");
    } else if (status === 404) {
      console.error(`   ❌ Bucket Not Found (HTTP 404). "${bucketName}" does not exist in region "${region}".`);
    } else {
      console.error(`   ❌ Failed with error [${err.name}]:`, err.message);
    }
  }

  // 2. Upload test object under unique integration-tests/ prefix
  const testKey = `integration-tests/verify-s3-${Date.now()}.txt`;
  console.log("\n2. Testing file upload (PutObjectCommand)...");
  let uploadSuccess = false;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: Buffer.from("S3 connectivity test verification payload"),
        ContentType: "text/plain"
      })
    );
    console.log(`   ✓ Successfully uploaded test object: ${testKey}`);
    uploadSuccess = true;
  } catch (err) {
    const status = err.$metadata ? err.$metadata.httpStatusCode : null;
    console.error(`   ❌ Failed to upload object (status ${status}):`, err.message);
  }

  // 3. Generate presigned URL
  if (uploadSuccess) {
    console.log("\n3. Testing presigned URL generation (GetObjectCommand)...");
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: testKey
      });
      const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 300 });
      console.log("   ✓ Successfully generated presigned GET URL.");
      console.log(`   Preview: ${presignedUrl.substring(0, 75)}...`);
    } catch (err) {
      console.error(`   ❌ Failed to generate presigned URL:`, err.message);
    }

    // 4. Delete test object
    console.log("\n4. Testing object cleanup (DeleteObjectCommand)...");
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: testKey
        })
      );
      console.log(`   ✓ Successfully purged test object: ${testKey}`);
    } catch (err) {
      console.error(`   ❌ Failed to delete test object:`, err.message);
    }
  }

  console.log("\n=== AWS S3 Verification Complete ===");
}

verifyS3Access().catch((err) => {
  console.error("\nUnexpected verification error:", err.message);
});

const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");

const clientConfig = {
  region: process.env.AWS_REGION || "ap-south-2"
};

// In AWS Lambda or environments using IAM roles / AWS SSO, credentials
// are resolved automatically by the default AWS SDK credential provider chain.
// If valid explicit keys are configured in local .env, supply them.
const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
const hasExplicitKeys =
  !isLambda &&
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  !process.env.AWS_ACCESS_KEY_ID.startsWith("your_") &&
  !process.env.AWS_ACCESS_KEY_ID.startsWith("mock-");

if (hasExplicitKeys) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {})
  };
}

const s3 = new S3Client(clientConfig);

s3.getBucketName = () => process.env.AWS_S3_BUCKET_NAME || "";
s3.getRegion = () => process.env.AWS_REGION || "ap-south-2";

/**
 * Checks connection to AWS S3 bucket and logs connection status.
 */
s3.checkConnection = async () => {
  const bucket = s3.getBucketName();
  if (!bucket) {
    console.warn("⚠️  AWS S3 warning: AWS_S3_BUCKET_NAME is not configured.");
    return false;
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`AWS S3 connected successfully (Bucket: ${bucket})`);
    return true;
  } catch (error) {
    // 301 Moved Permanently means the bucket exists and credentials reached AWS, but region header differed
    if (error.$metadata && (error.$metadata.httpStatusCode === 200 || error.$metadata.httpStatusCode === 301)) {
      console.log(`AWS S3 connected successfully (Bucket: ${bucket})`);
      return true;
    }
    console.warn(`AWS S3 connection note: ${error.message || error}`);
    return false;
  }
};

module.exports = s3;

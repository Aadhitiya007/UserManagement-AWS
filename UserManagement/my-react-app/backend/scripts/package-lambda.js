const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function buildLambdaPackage() {
  console.log("=== Packaging UserManagement-AWS Lambda Function ===\n");
  const backendDir = path.join(__dirname, "..");
  const zipOutput = path.join(backendDir, "lambda-deployment.zip");

  if (fs.existsSync(zipOutput)) {
    fs.unlinkSync(zipOutput);
    console.log("Removed previous zip artifact.");
  }

  console.log("Creating lambda-deployment.zip containing production runtime files...");

  const filesToInclude = [
    `'${path.join(backendDir, "lambda.js")}'`,
    `'${path.join(backendDir, "server.js")}'`,
    `'${path.join(backendDir, "package.json")}'`,
    `'${path.join(backendDir, "config")}'`,
    `'${path.join(backendDir, "controllers")}'`,
    `'${path.join(backendDir, "middleware")}'`,
    `'${path.join(backendDir, "models")}'`,
    `'${path.join(backendDir, "repositories")}'`,
    `'${path.join(backendDir, "routes")}'`,
    `'${path.join(backendDir, "node_modules")}'`
  ];

  const psCommand = `powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path ${filesToInclude.join(", ")} -DestinationPath '${zipOutput}' -CompressionLevel Optimal"`;

  execSync(psCommand, { stdio: "inherit" });

  const stats = fs.statSync(zipOutput);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ Lambda deployment archive built successfully!`);
  console.log(`  Artifact: ${zipOutput}`);
  console.log(`  Size:     ${sizeMb} MB`);
}

buildLambdaPackage();


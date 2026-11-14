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

  const items = [
    "lambda.js",
    "websocketHandler.js",
    "server.js",
    "package.json",
    "ai",
    "config",
    "controllers",
    "middleware",
    "repositories",
    "routes",
    "services",
    "utils",
    "node_modules"
  ];

  try {
    // Fast native zip creation with Windows bsdtar
    const cmd = `tar -a -c -f "${zipOutput}" ${items.join(" ")}`;
    execSync(cmd, { cwd: backendDir, stdio: "inherit" });
  } catch (err) {
    console.log("Fast tar zip failed, falling back to Compress-Archive...");
    const filesToInclude = items.map(f => `'${path.join(backendDir, f)}'`);
    const psCommand = `powershell -NoProfile -Command "$ProgressPreference = 'SilentlyContinue'; Compress-Archive -Path ${filesToInclude.join(", ")} -DestinationPath '${zipOutput}' -CompressionLevel Fastest"`;
    execSync(psCommand, { stdio: "inherit" });
  }

  const stats = fs.statSync(zipOutput);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ Lambda deployment archive built successfully!`);
  console.log(`  Artifact: ${zipOutput}`);
  console.log(`  Size:     ${sizeMb} MB`);
}

buildLambdaPackage();

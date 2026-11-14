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

  console.log("Creating optimized production lambda-deployment.zip without unused packages & dev files...");

  // Files & folders required for Lambda execution
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

  // Exclude unused packages, dev dependencies, type definitions, source maps, and documentation
  const excludes = [
    '--exclude="node_modules/@types"',
    '--exclude="node_modules/nodemon"',
    '--exclude="node_modules/socket.io-client"',
    '--exclude="node_modules/csv-parser"',
    '--exclude="node_modules/.bin"',
    '--exclude="*.map"',
    '--exclude="*.d.ts"',
    '--exclude="*.ts"',
    '--exclude="*.md"',
    '--exclude="*.markdown"',
    '--exclude="LICENSE*"',
    '--exclude="CHANGELOG*"',
    '--exclude="CONTRIBUTING*"',
    '--exclude="*.txt"',
    '--exclude="*/test/*"',
    '--exclude="*/tests/*"',
    '--exclude="*/example/*"',
    '--exclude="*/examples/*"',
    '--exclude="*/docs/*"',
    '--exclude="*/.github/*"'
  ];

  try {
    // Fast native zip creation with Windows bsdtar using exclude flags
    const cmd = `tar -a -c -f "${zipOutput}" ${excludes.join(" ")} ${items.join(" ")}`;
    execSync(cmd, { cwd: backendDir, stdio: "inherit" });
  } catch (err) {
    console.warn("Fast tar zip failed, falling back to standard zip...", err.message);
    const filesToInclude = items.map((f) => `'${path.join(backendDir, f)}'`);
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

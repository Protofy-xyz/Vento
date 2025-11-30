#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { mkdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");

function main() {
  const rootDir = join(__dirname, "..");
  const projectRoot = join(rootDir, "..", "..", "..");
  const binDir = join(projectRoot, "bin");
  mkdirSync(binDir, { recursive: true });

  const isWindows = process.platform.startsWith("win");
  const isMac = process.platform === "darwin";
  const binName = isWindows ? "ventoagent.exe" : "ventoagent";
  const outputPath = join(binDir, binName);

  // Environment: enable CGO for Windows and macOS (needed for GUI)
  const env = { ...process.env };
  if (isWindows || isMac) {
    env.CGO_ENABLED = "1";
  }

  // On Windows, try to find MinGW and add to PATH if not already available
  if (isWindows) {
    const mingwPaths = [
      "C:\\ProgramData\\mingw64\\mingw64\\bin",
      "C:\\mingw64\\bin",
      "C:\\tools\\mingw64\\bin",
      "C:\\msys64\\mingw64\\bin",
      "C:\\ProgramData\\chocolatey\\lib\\mingw\\tools\\install\\mingw64\\bin",
    ];
    
    // Check if gcc is already in PATH
    const gccCheck = spawnSync("where", ["gcc"], { encoding: "utf8" });
    if (gccCheck.status !== 0) {
      // gcc not found, try to add MinGW to PATH
      for (const p of mingwPaths) {
        if (existsSync(join(p, "gcc.exe"))) {
          console.log(`Adding MinGW to PATH: ${p}`);
          env.PATH = `${p};${env.PATH}`;
          break;
        }
      }
    }
  }

  // Build ldflags
  let ldflags = "-s -w";
  if (isWindows) {
    ldflags += " -H windowsgui";
  }

  console.log(`Compiling to ${outputPath} ...`);
  console.log(`CGO_ENABLED=${env.CGO_ENABLED || "0"}`);

  const result = spawnSync(
    "go",
    ["build", "-v", "-x", `-ldflags=${ldflags}`, "-o", outputPath, "./cmd/ventoagent"],
    {
      cwd: rootDir,
      stdio: "inherit",
      env,
    }
  );

  if (result.error) {
    console.error("Failed to execute go build:", result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`go build exited with code ${result.status}`);
    process.exit(result.status);
  }

  console.log("Compilation finished.");
}

main();

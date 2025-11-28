#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { mkdir } = require("node:fs/promises");
const { join } = require("node:path");

async function main() {
  const rootDir = join(__dirname, "..");
  const projectRoot = join(rootDir, "..", "..", "..");
  const binDir = join(projectRoot, "bin");
  await mkdir(binDir, { recursive: true });

  const isWindows = process.platform.startsWith("win");
  const binName = isWindows ? "ventoagent.exe" : "ventoagent";
  const outputPath = join(binDir, binName);

  console.log(`Compiling to ${outputPath} ...`);
  await new Promise((resolve, reject) => {
    const proc = spawn(
      "go",
      ["build", "-o", outputPath, "./cmd/ventoagent"],
      {
        cwd: rootDir,
        stdio: "inherit",
        shell: isWindows,
      }
    );
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`go build exited with code ${code}`));
    });
  });
  console.log("Compilation finished.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});


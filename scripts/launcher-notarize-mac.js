#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

// Project root (one level above /scripts)
const projectRoot = path.resolve(__dirname, "..");
// Load env variables from root .env
try {
  // Make sure you have: yarn add -D dotenv
  require("dotenv").config({ path: path.join(projectRoot, ".env") });
} catch (err) {
  console.warn("dotenv is not installed. Env file will not be loaded.");
}

// Read package.json from project root
const packageJsonPath = path.join(projectRoot, "package.json");
if (!fs.existsSync(packageJsonPath)) {
  console.error("package.json not found in project root.");
  process.exit(1);
}

const pkg = require(packageJsonPath);

// Use Yarn/NPM env vars if available, fallback to package.json
const version = process.env.npm_package_version || pkg.version;
if (!version) {
  console.error("Could not determine package version.");
  process.exit(1);
}

/**
 * CONFIG SECTION
 * Adjust these values to match your DMG naming convention.
 */

// Base name of your DMG (without version or extension)
// Example: if your final file is launcher-0.1.6.dmg -> base name is "launcher"
const DMG_BASE_NAME = "Vento";

// If your DMG file name includes the version, keep this true.
// If your DMG is always the same name (e.g. launcher.dmg), set this to false.
const INCLUDE_VERSION_IN_DMG_NAME = true;

// Dist folder where electron-builder outputs the DMG
const distDir = path.join(projectRoot, "../dist");

// Compute DMG file name
const dmgFileName = INCLUDE_VERSION_IN_DMG_NAME
  ? `${DMG_BASE_NAME}-${version}-arm64.dmg`
  : `${DMG_BASE_NAME}-arm64.dmg`;

const dmgPath = path.join(distDir, dmgFileName);

if (!fs.existsSync(dmgPath)) {
  console.error(`DMG file not found at: ${dmgPath}`);
  console.error("Check DMG_BASE_NAME / INCLUDE_VERSION_IN_DMG_NAME or your dist folder.");
  process.exit(1);
}

// Apple credentials from .env
const appleId = process.env.LAUNCHER_NOTARIZE_APPLE_ID;
const teamId = process.env.LAUNCHER_NOTARIZE_APPLE_TEAM_ID;
const password =
  process.env.LAUNCHER_NOTARIZE_APPLE_APP_SPECIFIC_PASSWORD ||
  process.env.LAUNCHER_NOTARIZE_NOTARY_PASSWORD ||
  process.env.LAUNCHER_NOTARIZE_APPLE_PASSWORD;

if (!appleId || !teamId || !password) {
  console.error("Missing Apple credentials in environment variables.");
  console.error("Expected at least: LAUNCHER_NOTARIZE_APPLE_ID, LAUNCHER_NOTARIZE_APPLE_TEAM_ID, LAUNCHER_NOTARIZE_APPLE_APP_SPECIFIC_PASSWORD (or LAUNCHER_NOTARIZE_NOTARY_PASSWORD / LAUNCHER_NOTARIZE_APPLE_PASSWORD).");
  process.exit(1);
}

console.log("Submitting DMG to Apple notarization:");
console.log(`  DMG:      ${dmgPath}`);
console.log(`  Apple ID: ${appleId}`);
console.log(`  Team ID:  ${teamId}`);
console.log("");

// Build args for:
// xcrun notarytool submit <dmgPath> --apple-id ... --team-id ... --password ... --wait
const args = [
  "notarytool",
  "submit",
  dmgPath,
  "--apple-id",
  appleId,
  "--team-id",
  teamId,
  "--password",
  password,
  "--wait",
];

const child = spawn("xcrun", args, {
  cwd: projectRoot,
  stdio: "inherit",
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("Notarization finished successfully.");
  } else {
    console.error(`Notarization process exited with code ${code}.`);
  }
  process.exit(code);
});

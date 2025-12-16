#!/usr/bin/env node
/**
 * extension.js
 * 
 * Run scripts from extensions.
 * 
 * Usage:
 *   yarn extension <name> <script>
 *   yarn extension systemd setup
 *   yarn extension systemd remove
 * 
 * For scripts requiring sudo:
 *   sudo $(which node) scripts/extension.js <name> <script>
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('Usage: yarn extension <name> <script>');
    console.log('');
    console.log('Examples:');
    console.log('  yarn extension systemd setup');
    console.log('  yarn extension systemd remove');
    console.log('  yarn extension systemd status');
    console.log('');
    
    // List available extensions
    const extensionsDir = path.join(__dirname, '..', 'extensions');
    if (fs.existsSync(extensionsDir)) {
        const extensions = fs.readdirSync(extensionsDir).filter(name => {
            const pkgPath = path.join(extensionsDir, name, 'package.json');
            return fs.existsSync(pkgPath);
        });
        
    const extensionsWithScripts = extensions
        .map(ext => {
            const pkgPath = path.join(extensionsDir, ext, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const scriptNames = Object.keys(pkg.scripts || {});
            return { name: ext, scripts: scriptNames };
        })
        .filter(ext => ext.scripts.length > 0);
    
    if (extensionsWithScripts.length > 0) {
        console.log('Available extensions scripts:');
        extensionsWithScripts.forEach(ext => {
            console.log(`  ${ext.name}: ${ext.scripts.join(', ')}`);
        });
    }
    }
    
    process.exit(1);
}

const [extensionName, scriptName, ...extraArgs] = args;
const rootDir = path.join(__dirname, '..');
const extensionDir = path.join(rootDir, 'extensions', extensionName);
const packageJsonPath = path.join(extensionDir, 'package.json');

// Check extension exists
if (!fs.existsSync(packageJsonPath)) {
    console.error(`❌ Extension '${extensionName}' not found`);
    console.error(`   Expected: extensions/${extensionName}/package.json`);
    process.exit(1);
}

// Read package.json
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const scripts = pkg.scripts || {};

// Check script exists
if (!scripts[scriptName]) {
    console.error(`❌ Script '${scriptName}' not found in extension '${extensionName}'`);
    console.error(`   Available scripts: ${Object.keys(scripts).join(', ') || 'none'}`);
    process.exit(1);
}

// Get the script command
const scriptCmd = scripts[scriptName];

console.log(`🔧 Running ${extensionName}:${scriptName}`);
console.log(`   ${scriptCmd}`);
console.log('');

// Execute the script
try {
    execSync(scriptCmd, {
        cwd: extensionDir,
        stdio: 'inherit',
        env: { ...process.env }
    });
} catch (err) {
    process.exit(err.status || 1);
}
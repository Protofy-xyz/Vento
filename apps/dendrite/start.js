#!/usr/bin/env node
/**
 * Dendrite launcher wrapper
 * Redirects stderr to stdout so Vento doesn't show red logs
 */

const { spawn } = require('child_process');
const path = require('path');

const binName = process.platform === 'win32' ? 'dendrite.exe' : 'dendrite';
const dendriteBinary = path.join(__dirname, 'bin', binName);
const configPath = path.resolve(__dirname, '../../data/dendrite/dendrite.yaml');

const args = ['--config', configPath, '--really-enable-open-registration'];

const proc = spawn(dendriteBinary, args, {
    cwd: __dirname,
    stdio: ['inherit', 'inherit', 'pipe'],  // stdin/stdout inherit, stderr piped
    windowsHide: true
});

// Redirect stderr to stdout
proc.stderr.on('data', (data) => {
    process.stdout.write(data);
});

proc.on('close', (code) => {
    process.exit(code || 0);
});

proc.on('error', (err) => {
    console.error('Failed to start dendrite:', err);
    process.exit(1);
});


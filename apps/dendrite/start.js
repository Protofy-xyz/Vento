#!/usr/bin/env node
/**
 * Dendrite launcher wrapper
 * Redirects stderr to stdout so Vento doesn't show red logs
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const binName = process.platform === 'win32' ? 'dendrite.exe' : 'dendrite';
const dendriteBinary = path.join(__dirname, 'bin', binName);
const configPath = path.resolve(__dirname, '../../data/dendrite/dendrite.yaml');
const dataDir = path.resolve(__dirname, '../../data/dendrite');
const tokensFile = path.join(dataDir, 'appservice-tokens.json');
const appserviceYaml = path.join(dataDir, 'vento-appservice.yaml');

// Ensure appservice config exists before starting Dendrite
function ensureAppserviceTokens() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    let tokens;
    if (fs.existsSync(tokensFile)) {
        try {
            tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
        } catch (e) {
            tokens = null;
        }
    }

    if (!tokens || !tokens.as_token || !tokens.hs_token) {
        tokens = {
            as_token: crypto.randomBytes(32).toString('hex'),
            hs_token: crypto.randomBytes(32).toString('hex')
        };
        fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
        console.log('Generated new appservice tokens.');
    }

    const appserviceContent = `# Vento Agents Application Service Registration
# AUTO-GENERATED - Do not edit tokens manually

id: vento-agents
url: "http://localhost:8000/api/core/v1/matrix/appservice"
as_token: "${tokens.as_token}"
hs_token: "${tokens.hs_token}"
sender_localpart: "ventobot"

namespaces:
  users:
    - exclusive: true
      regex: "@_vento_.*:vento\\\\.local"
  rooms: []
  aliases: []

rate_limited: false
protocols: []
`;
    fs.writeFileSync(appserviceYaml, appserviceContent);
}

ensureAppserviceTokens();

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


//run yarn to install dependencies in ../cinny
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const AdmZip = require('adm-zip');
const tar = require('tar');

const dataDir = path.join(__dirname, '..', '..', 'data', 'dendrite');
const tokensFile = path.join(dataDir, 'appservice-tokens.json');
const appserviceYaml = path.join(dataDir, 'vento-appservice.yaml');

// Generate a secure random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Generate appservice tokens if they don't exist
function ensureAppserviceTokens() {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    let tokens;
    
    // Check if tokens file exists
    if (fs.existsSync(tokensFile)) {
        try {
            tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
            console.log('Appservice tokens loaded from file.');
        } catch (e) {
            console.log('Error reading tokens file, regenerating...');
            tokens = null;
        }
    }

    // Generate new tokens if needed
    if (!tokens || !tokens.as_token || !tokens.hs_token) {
        tokens = {
            as_token: generateToken(),
            hs_token: generateToken()
        };
        fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
        console.log('Generated new appservice tokens.');
    }

    // Update vento-appservice.yaml with the tokens
    const appserviceContent = `# Vento Agents Application Service Registration
# This allows Vento agents to appear as real Matrix users
# AUTO-GENERATED - Do not edit tokens manually

id: vento-agents
url: "http://localhost:8000/api/core/v1/matrix/appservice"
as_token: "${tokens.as_token}"
hs_token: "${tokens.hs_token}"
sender_localpart: "ventobot"

# Namespace for agent users: @_vento_agentname:vento.local
namespaces:
  users:
    - exclusive: true
      regex: "@_vento_.*:vento\\\\.local"
  rooms: []
  aliases: []

# Rate limiting
rate_limited: false

# Protocol support
protocols: []
`;
    fs.writeFileSync(appserviceYaml, appserviceContent);
    console.log('Updated vento-appservice.yaml with tokens.');

    return tokens;
}

async function prepare() {
    console.log('Preparing Dendrite binaries...');

    const downloadDendrite = require('./../../scripts/download-dendrite');
    await downloadDendrite(AdmZip, tar);

    console.log('Dendrite binaries are ready.');
    
    // Generate appservice tokens
    ensureAppserviceTokens();
}

prepare().catch(err => {
    console.error('Error preparing Dendrite:', err);
    process.exit(1);
});


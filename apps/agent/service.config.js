/**
 * Service Configuration for Vento Agent
 * 
 * Runs the ventoagent binary with service token - no prior setup needed.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Load .env to get the secret for token generation
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const currentDir = path.dirname(__filename);
const binDir = path.resolve(path.join(currentDir, '../../bin'));
const dataDir = path.resolve(path.join(currentDir, '../../data'));
const logsDir = path.resolve(path.join(currentDir, '../../logs/raw'));

/**
 * Get the agent binary path for the current platform
 */
function getAgentBinary() {
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const binaryName = isWindows ? 'ventoagent.exe' : 'ventoagent';
    const binaryPath = path.join(binDir, binaryName);
    
    if (!fs.existsSync(binaryPath)) {
        console.warn(`⚠️  Vento Agent binary not found at ${binaryPath}`);
        console.warn(`   Run 'yarn download-agent' to download it.`);
        return null;
    }
    
    return binaryPath;
}

/**
 * Get service token for authentication
 */
function getServiceToken() {
    try {
        const { getServiceToken: getToken } = require('protobase');
        return getToken();
    } catch (e) {
        console.warn('⚠️  Could not generate service token:', e.message);
        return null;
    }
}

/**
 * Get the Vento host URL
 */
function getHost() {
    return process.env.VENTO_AGENT_HOST || process.env.API_URL || 'http://localhost:8000';
}

/**
 * Check if agent should be enabled
 */
function isAgentEnabled() {
    // Disable if explicitly set
    if (process.env.VENTO_AGENT_DISABLED === 'true') {
        return false;
    }
    
    // Check if binary exists
    const binary = getAgentBinary();
    if (!binary) {
        return false;
    }
    
    return true;
}

const agentBinary = getAgentBinary();
const configPath = path.join(dataDir, 'agent-config.json');
const host = getHost();
const token = getServiceToken();

// Build args - pass host and token directly for headless operation
const args = [
    '-config', configPath,
    '-host', host,
    '-device', 'computer'  // Use 'computer' as the device name for the main agent
];

// Add service token for headless mode
if (token) {
    args.push('-token', token);
}

const agentConfig = {
    name: 'agent',
    script: agentBinary,
    args: args,
    interpreter: 'none',  // It's a binary, not a script
    watch: false,
    autorestart: true,
    windowsHide: true,
    treekill: true,
    kill_timeout: 5000,
    cwd: dataDir,  // Run from data dir
    env: {
        NODE_ENV: 'production'
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: path.join(logsDir, `agent.stdout.log`),
    error_file: path.join(logsDir, `agent.stderr.log`),
    vizion: false
};

// Only export if agent is enabled and binary exists
const apps = [];
if (agentBinary && isAgentEnabled()) {
    if (token) {
        console.log(`✅ Vento Agent configured: ${host} (headless mode with service token)`);
        apps.push(agentConfig);
    } else {
        console.warn('⚠️  Vento Agent: Could not get service token. Agent will not start.');
    }
} else {
    console.log('ℹ️  Vento Agent binary not found. Run: yarn download-agent');
}

module.exports = {
    apps
};


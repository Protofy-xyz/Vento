#!/usr/bin/env node
/**
 * Vento Agent Setup
 * 
 * Interactive setup to configure the agent before running as a service.
 * Creates the config file in data/agent-config.json
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

const binDir = path.resolve(__dirname, '../../bin');
const dataDir = path.resolve(__dirname, '../../data');
const configPath = path.join(dataDir, 'agent-config.json');

function getAgentBinary() {
    const isWindows = os.platform() === 'win32';
    const binaryName = isWindows ? 'ventoagent.exe' : 'ventoagent';
    return path.join(binDir, binaryName);
}

function binaryExists() {
    return fs.existsSync(getAgentBinary());
}

function configExists() {
    return fs.existsSync(configPath);
}

async function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('\n🤖 Vento Agent Setup\n');

    // Check if binary exists
    if (!binaryExists()) {
        console.log('❌ Agent binary not found.');
        console.log('   Run: yarn download-agent\n');
        process.exit(1);
    }

    console.log('✅ Agent binary found:', getAgentBinary());

    // Check if already configured
    if (configExists()) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('\n📋 Existing configuration:');
        console.log(`   Host: ${config.host || 'not set'}`);
        console.log(`   Device: ${config.device_name || 'not set'}`);
        console.log(`   Token: ${config.token ? '****' + config.token.slice(-8) : 'not set'}`);
        
        const reconfigure = await prompt('\nReconfigure? (y/N): ');
        if (reconfigure.toLowerCase() !== 'y') {
            console.log('\n✅ Using existing configuration.');
            console.log('   Start with: yarn start (or pm2 will include it)\n');
            return;
        }
    }

    // Get host
    const defaultHost = 'http://localhost:8000';
    const host = await prompt(`\nVento host [${defaultHost}]: `) || defaultHost;

    // Check for headless mode
    const useToken = await prompt('Do you have an existing token? (y/N): ');
    
    let args = ['-config', configPath, '-host', host];

    if (useToken.toLowerCase() === 'y') {
        const token = await prompt('Token: ');
        if (token) {
            args.push('-token', token);
            console.log('\n🔐 Using provided token (headless mode)');
        }
    }

    // Run agent once to configure
    console.log('\n🚀 Running agent for initial setup...');
    console.log('   (You may need to enter username/password)\n');

    const binary = getAgentBinary();
    const agent = spawn(binary, [...args, '-once'], {
        stdio: 'inherit',
        cwd: dataDir
    });

    agent.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ Agent configured successfully!');
            console.log('   Config saved to:', configPath);
            console.log('\n   The agent will now run automatically with PM2.');
            console.log('   Or run manually: yarn workspace agent start\n');
        } else {
            console.log('\n❌ Setup failed with code:', code);
            console.log('   Check your credentials and try again.\n');
        }
    });
}

main().catch(console.error);


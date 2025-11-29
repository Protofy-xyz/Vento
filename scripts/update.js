/**
 * update.js
 * 
 * Script para actualizar el agent de forma segura:
 * 1. Para y elimina el agent de PM2 para liberar el .exe
 * 2. Descarga y actualiza el agent
 * 3. Arranca el agent de nuevo
 */

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

function runSilent(cmd) {
    try {
        execSync(cmd, { 
            stdio: 'pipe', 
            cwd: rootDir
        });
        return true;
    } catch (e) {
        return false;
    }
}

function run(cmd) {
    console.log(`▶ ${cmd}`);
    try {
        execSync(cmd, { 
            stdio: 'inherit', 
            cwd: rootDir
        });
        return true;
    } catch (e) {
        return false;
    }
}

function runRequired(cmd) {
    if (!run(cmd)) {
        console.error(`\n❌ Failed: ${cmd}`);
        process.exit(1);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function killAgentProcess() {
    // En Windows, intentar matar el proceso del agent directamente
    if (isWindows) {
        runSilent('taskkill /F /IM ventoagent.exe');
    } else {
        runSilent('pkill -f ventoagent');
    }
}

function isAgentRunning() {
    try {
        const result = execSync('pm2 jlist', { stdio: 'pipe', cwd: rootDir });
        const list = JSON.parse(result.toString());
        const agent = list.find(p => p.name === 'agent');
        return agent && agent.pm2_env && agent.pm2_env.status === 'online';
    } catch (e) {
        return false;
    }
}

async function main() {
    console.log('\n🔄 Updating agent...\n');

    // 0. Check if agent was running before update
    const wasRunning = isAgentRunning();
    if (wasRunning) {
        console.log('ℹ️  Agent was running, will restart after update');
    } else {
        console.log('ℹ️  Agent was not running, will not start after update');
    }

    // 1. Parar y eliminar el agent de PM2 completamente
    console.log('\n📦 Stopping agent...');
    runSilent('pm2 stop agent');
    runSilent('pm2 delete agent');
    
    // Matar el proceso directamente por si acaso
    await killAgentProcess();
    
    // Esperar un poco para que Windows libere el archivo
    console.log('   Waiting for file lock release...');
    await sleep(1500);

    // 2. Descargar y actualizar agent
    console.log('\n📥 Downloading agent...');
    runRequired('yarn download-agent');

    console.log('\n📥 Updating agent...');
    runRequired('yarn update-agent');

    // 3. Arrancar el agent de nuevo SOLO si estaba corriendo antes
    if (wasRunning) {
        console.log('\n🚀 Restarting agent...');
        runSilent('pm2 restart ecosystem.config.js --only agent');
    } else {
        console.log('\n⏸️  Skipping agent restart (was not running)');
    }
    
    console.log('\n✅ Agent update complete!\n');
}

main().catch(err => {
    console.error('\n❌ Update failed:', err.message);
    process.exit(1);
});

/**
 * update.js
 * 
 * Script para actualizar el agent de forma segura:
 * 1. Para el agent matando el proceso directamente
 * 2. Descarga y actualiza el agent
 * 
 * Para reiniciar el agent después de actualizar:
 *   node scripts/start.js restart agent
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
    // Matar el proceso del agent directamente
    if (isWindows) {
        runSilent('taskkill /F /IM ventoagent.exe');
    } else {
        runSilent('pkill -f ventoagent');
    }
}

async function main() {
    console.log('\n🔄 Updating agent...\n');

    // 1. Parar el agent matando el proceso
    console.log('📦 Stopping agent...');
    await killAgentProcess();
    
    // Esperar un poco para que Windows libere el archivo
    console.log('   Waiting for file lock release...');
    await sleep(1500);

    // 2. Descargar y actualizar agent
    console.log('\n📥 Downloading agent...');
    runRequired('yarn download-agent');

    console.log('\n📥 Updating agent...');
    runRequired('yarn update-agent');
    
    console.log('\n✅ Agent update complete!');
    console.log('   To restart the agent: node scripts/start.js restart agent\n');
}

main().catch(err => {
    console.error('\n❌ Update failed:', err.message);
    process.exit(1);
});

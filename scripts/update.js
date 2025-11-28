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

async function main() {
    console.log('\n🔄 Updating agent...\n');

    // 1. Parar y eliminar el agent de PM2 completamente
    console.log('📦 Stopping agent...');
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

    // 3. Arrancar el agent de nuevo (reiniciar PM2 para que lo vuelva a cargar)
    console.log('\n🚀 Restarting agent...');
    // Primero intentar reiniciar todo el ecosystem para que recargue la config del agent
    runSilent('pm2 restart ecosystem.config.js --only agent');
    
    console.log('\n✅ Agent update complete!\n');
}

main().catch(err => {
    console.error('\n❌ Update failed:', err.message);
    process.exit(1);
});

/**
 * update.js
 * 
 * Script para actualizar el agent de forma segura:
 * 1. Para el agent si está corriendo
 * 2. Descarga y actualiza el agent
 * 3. Arranca el agent de nuevo
 */

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

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

function runRequired(cmd) {
    if (!run(cmd)) {
        console.error(`\n❌ Failed: ${cmd}`);
        process.exit(1);
    }
}

async function main() {
    console.log('\n🔄 Updating agent...\n');

    // 1. Parar el agent (silencioso, no importa si falla)
    console.log('📦 Stopping agent...');
    runSilent('pm2 stop agent');

    // 2. Descargar y actualizar agent
    console.log('\n📥 Downloading agent...');
    runRequired('yarn download-agent');

    console.log('\n📥 Updating agent...');
    runRequired('yarn update-agent');

    // 3. Arrancar el agent (silencioso, no importa si falla)
    console.log('\n🚀 Starting agent...');
    runSilent('pm2 start agent');

    console.log('\n✅ Agent update complete!\n');
}

main().catch(err => {
    console.error('\n❌ Update failed:', err.message);
    process.exit(1);
});

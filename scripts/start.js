/**
 * start.js
 * 
 * Wrapper para iniciar PM2 en modo foreground (--no-daemon) que intercepta
 * Ctrl+C para ejecutar el cleanup de procesos antes de salir.
 * 
 * Uso:
 *   node scripts/start.js              # start-fast
 *   node scripts/start.js --prod       # prod mode
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const kill = require('tree-kill');

const isProd = process.argv.includes('--prod');
const rootDir = path.resolve(__dirname, '..');

// Configurar entorno
if (isProd) {
    process.env.NODE_ENV = 'production';
}

let pm2Process = null;
let isShuttingDown = false;
let restartCount = 0;
const MAX_RESTARTS_PER_MINUTE = 10;
let restartTimestamps = [];

/**
 * Obtiene los PIDs de PM2
 */
function getPM2Pids() {
    try {
        const output = execSync('pm2 jlist', { 
            encoding: 'utf8', 
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: rootDir,
            timeout: 10000
        });
        
        const jsonMatch = output.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        
        const processes = JSON.parse(jsonMatch[0]);
        return processes
            .filter(p => p.pid && p.pid !== 0)
            .map(p => ({ pid: p.pid, name: p.name }));
    } catch (e) {
        return [];
    }
}

/**
 * Limpia los procesos
 */
async function cleanup() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n\n🛑 Shutting down...\n');
    
    // Capturar PIDs antes de parar
    const processes = getPM2Pids();
    
    if (processes.length > 0) {
        console.log(`Found ${processes.length} process(es) to clean:`);
        for (const p of processes) {
            console.log(`  • ${p.name} (PID: ${p.pid})`);
        }
    }
    
    // Parar PM2
    console.log('\nStopping PM2...\n');
    try {
        execSync('pm2 kill', { stdio: 'inherit', cwd: rootDir });
    } catch (e) {
        // Ignorar errores
    }
    
    // Limpiar descendientes huérfanos
    if (processes.length > 0) {
        console.log('\n🧹 Cleaning orphan descendants...\n');
        
        for (const p of processes) {
            await new Promise(resolve => {
                kill(p.pid, 'SIGKILL', () => resolve());
            });
        }
    }
    
    console.log('\n✅ Shutdown complete.\n');
    process.exit(0);
}

/**
 * Verifica si hay demasiados reinicios en poco tiempo
 */
function shouldAllowRestart() {
    const now = Date.now();
    // Limpiar timestamps viejos (más de 1 minuto)
    restartTimestamps = restartTimestamps.filter(t => now - t < 60000);
    
    if (restartTimestamps.length >= MAX_RESTARTS_PER_MINUTE) {
        return false;
    }
    
    restartTimestamps.push(now);
    return true;
}

/**
 * Inicia PM2
 */
function startPM2() {
    console.log(`\n🚀 Starting Vento${isProd ? ' (production)' : ''}...\n`);
    
    pm2Process = spawn('pm2', ['start', 'ecosystem.config.js', '--no-daemon'], {
        cwd: rootDir,
        stdio: 'inherit',
        shell: true
    });

    pm2Process.on('close', (code) => {
        if (isShuttingDown) return;
        
        console.log(`\n⚠️  PM2 exited with code ${code}`);
        
        // Si el código es 0, fue un cierre normal - no reiniciar
        if (code === 0) {
            console.log('PM2 closed normally, shutting down...');
            cleanup();
            return;
        }
        
        // Si crasheó, intentar reiniciar automáticamente
        if (shouldAllowRestart()) {
            console.log('🔄 Restarting PM2 automatically in 2 seconds...\n');
            setTimeout(() => {
                if (!isShuttingDown) {
                    startPM2();
                }
            }, 2000);
        } else {
            console.log('❌ Too many restarts in the last minute. Stopping to prevent crash loop.');
            console.log('   Run the command again manually when ready.\n');
            cleanup();
        }
    });

    pm2Process.on('error', (err) => {
        console.error('Failed to start PM2:', err);
        if (!isShuttingDown) {
            if (shouldAllowRestart()) {
                console.log('🔄 Retrying in 3 seconds...');
                setTimeout(() => {
                    if (!isShuttingDown) {
                        startPM2();
                    }
                }, 3000);
            } else {
                cleanup();
            }
        }
    });
}

// Interceptar señales
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// También en Windows, escuchar el evento de cierre
if (process.platform === 'win32') {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    readline.on('SIGINT', cleanup);
    readline.on('close', cleanup);
}

// Iniciar PM2
startPM2();

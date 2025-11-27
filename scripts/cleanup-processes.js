/**
 * cleanup-processes.js
 * 
 * Obtiene los PIDs de PM2, para los procesos, y mata los descendientes huérfanos.
 * Todo en un solo paso para capturar los PIDs antes de que PM2 los limpie.
 * 
 * Uso: 
 *   node scripts/cleanup-processes.js         # stop
 *   node scripts/cleanup-processes.js --kill  # kill PM2 daemon también
 */

const { execSync, spawnSync } = require('child_process');
const kill = require('tree-kill');

const isKill = process.argv.includes('--kill');

/**
 * Obtiene los PIDs de PM2 usando pm2 jlist
 */
function getPM2Pids() {
    try {
        const output = execSync('pm2 jlist', { 
            encoding: 'utf8', 
            stdio: ['pipe', 'pipe', 'pipe'], // Capturar todo
            timeout: 10000
        });
        
        // El output puede tener mensajes de PM2 antes del JSON
        // Buscar el array JSON - puede ser [] o [{...}]
        // Usar un regex más específico que busque un array JSON válido
        const jsonMatch = output.match(/\[(?:\s*\{[\s\S]*?\}\s*,?\s*)*\]|\[\s*\]/);
        if (!jsonMatch) {
            return [];
        }
        
        let processes;
        try {
            processes = JSON.parse(jsonMatch[0]);
        } catch (e) {
            // Si falla el parsing, intentar buscar de otra forma
            const altMatch = output.match(/\[\{.*\}\]/s);
            if (!altMatch) return [];
            processes = JSON.parse(altMatch[0]);
        }
        return processes
            .filter(p => p.pid && p.pid !== 0) // Solo procesos con PID válido
            .map(p => ({
                pid: p.pid,
                name: p.name,
                status: p.pm2_env?.status
            }));
        
    } catch (e) {
        console.error('Error getting PM2 processes:', e.message);
        return [];
    }
}

/**
 * Mata un proceso y todo su árbol de descendientes
 */
function killProcessTree(pid) {
    return new Promise((resolve) => {
        kill(pid, 'SIGKILL', (err) => {
            if (err) {
                // Fallback: taskkill en Windows
                if (process.platform === 'win32') {
                    try {
                        execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
                        resolve(true);
                    } catch (e) {
                        resolve(false);
                    }
                } else {
                    resolve(false);
                }
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Ejecuta pm2 stop o kill
 */
function stopPM2() {
    try {
        const cmd = isKill ? 'pm2 kill' : 'pm2 stop all';
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        // Ignorar errores si PM2 no está corriendo
    }
}

/**
 * Función principal
 */
async function main() {
    console.log(`\n🛑 ${isKill ? 'Killing' : 'Stopping'} PM2 processes...\n`);
    
    // 1. Capturar PIDs ANTES de parar PM2
    const processes = getPM2Pids();
    
    if (processes.length === 0) {
        console.log('No active PM2 processes found.\n');
        stopPM2();
        console.log('\n✅ Done.');
        return;
    }
    
    console.log(`Found ${processes.length} active process(es):`);
    for (const proc of processes) {
        console.log(`  • ${proc.name} (PID: ${proc.pid})`);
    }
    
    // 2. Ejecutar pm2 stop/kill
    console.log(`\nExecuting pm2 ${isKill ? 'kill' : 'stop all'}...\n`);
    stopPM2();
    
    // 3. Pequeña pausa para que PM2 termine
    await new Promise(r => setTimeout(r, 500));
    
    // 4. Matar descendientes que puedan haber quedado huérfanos
    console.log('\n🧹 Cleaning up any orphan descendants...\n');
    
    let cleaned = 0;
    for (const proc of processes) {
        const success = await killProcessTree(proc.pid);
        if (success) {
            console.log(`  ✓ Cleaned ${proc.name} tree (PID: ${proc.pid})`);
            cleaned++;
        }
        // No reportamos fallos porque es normal que ya estén muertos
    }
    
    console.log(`\n✅ Done. Cleaned ${cleaned} process tree(s).`);
}

main().catch(console.error);

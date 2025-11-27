/**
 * cleanup-processes.js
 * 
 * Mata todos los procesos node/python huérfanos que puedan haber quedado
 * después de detener PM2. Usa tree-kill para matar árboles de procesos completos.
 * 
 * Uso: node scripts/cleanup-processes.js [--force]
 */

const { execSync, exec } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const forceKill = process.argv.includes('--force');

// Procesos que queremos limpiar (nombres de ejecutables)
const targetProcesses = ['node.exe', 'python.exe', 'tsx.exe'];

// PIDs a excluir (el proceso actual y sus padres)
const excludePids = new Set();
excludePids.add(process.pid);

// Obtener el PID padre si es posible
if (process.ppid) {
    excludePids.add(process.ppid);
}

/**
 * Obtiene la lista de PIDs de procesos node/python en Windows
 */
function getWindowsProcesses() {
    const processes = [];
    
    for (const processName of targetProcesses) {
        try {
            // Usar WMIC para obtener PIDs con más info
            const output = execSync(
                `wmic process where "name='${processName}'" get ProcessId,CommandLine /format:csv`,
                { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
            );
            
            const lines = output.split('\n').filter(line => line.trim());
            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts.length >= 3) {
                    const pid = parseInt(parts[parts.length - 1].trim(), 10);
                    const cmdLine = parts.slice(1, -1).join(',').trim();
                    
                    if (pid && !isNaN(pid) && !excludePids.has(pid)) {
                        // Filtrar procesos del sistema o que no son del proyecto
                        const isProjectProcess = 
                            cmdLine.includes('ventilo') || 
                            cmdLine.includes('pm2') ||
                            cmdLine.includes('next') ||
                            cmdLine.includes('tsx') ||
                            cmdLine.includes('adminpanel') ||
                            cmdLine.includes('core') ||
                            cmdLine.includes('api');
                        
                        if (isProjectProcess || forceKill) {
                            processes.push({ pid, name: processName, cmdLine });
                        }
                    }
                }
            }
        } catch (e) {
            // Proceso no encontrado o error, continuar
        }
    }
    
    return processes;
}

/**
 * Obtiene la lista de PIDs en Unix/Linux/Mac
 */
function getUnixProcesses() {
    const processes = [];
    
    try {
        const output = execSync(
            `ps aux | grep -E "(node|python|tsx)" | grep -v grep`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
        );
        
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const pid = parseInt(parts[1], 10);
                const cmdLine = parts.slice(10).join(' ');
                
                if (pid && !isNaN(pid) && !excludePids.has(pid)) {
                    const isProjectProcess = 
                        cmdLine.includes('ventilo') || 
                        cmdLine.includes('pm2') ||
                        cmdLine.includes('next') ||
                        cmdLine.includes('tsx');
                    
                    if (isProjectProcess || forceKill) {
                        processes.push({ pid, name: 'node', cmdLine });
                    }
                }
            }
        }
    } catch (e) {
        // No hay procesos o error
    }
    
    return processes;
}

/**
 * Mata un proceso usando tree-kill
 */
function killProcess(pid) {
    return new Promise((resolve) => {
        try {
            const kill = require('tree-kill');
            kill(pid, 'SIGKILL', (err) => {
                if (err) {
                    // Intentar con taskkill en Windows como fallback
                    if (isWindows) {
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
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * Función principal
 */
async function main() {
    console.log('🧹 Cleaning up orphan processes...\n');
    
    const processes = isWindows ? getWindowsProcesses() : getUnixProcesses();
    
    if (processes.length === 0) {
        console.log('✅ No orphan processes found.');
        return;
    }
    
    console.log(`Found ${processes.length} process(es) to kill:\n`);
    
    for (const proc of processes) {
        console.log(`  PID ${proc.pid}: ${proc.name}`);
        if (proc.cmdLine) {
            console.log(`      ${proc.cmdLine.substring(0, 80)}${proc.cmdLine.length > 80 ? '...' : ''}`);
        }
    }
    
    console.log('\nKilling processes...\n');
    
    let killed = 0;
    let failed = 0;
    
    for (const proc of processes) {
        const success = await killProcess(proc.pid);
        if (success) {
            console.log(`  ✓ Killed PID ${proc.pid}`);
            killed++;
        } else {
            console.log(`  ✗ Failed to kill PID ${proc.pid}`);
            failed++;
        }
    }
    
    console.log(`\n✅ Done: ${killed} killed, ${failed} failed.`);
}

main().catch(console.error);


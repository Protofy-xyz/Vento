
import { fork } from 'child_process';
import * as path from 'path';
import { watch } from 'chokidar';
import { on } from 'events';
import { getLogger } from 'protobase';

const logger = getLogger()

const processes = new Map();
let watchers = {}
export const Manager = {
    start: async (file, getContext, onExit, skipWatch?) => {
        const context = getContext ? await getContext() : {};
        if (processes.has(file)) {
            if (processes.get(file).killed) {
                processes.delete(file);
            } else {
                console.warn(`Manager: Process for "${file}" already running.`);
                return false;
            }
        }

        const absPath = path.resolve(file);
        const child = fork(absPath, [], {
            windowsHide: true
        });

        // Guardamos el proceso
        processes.set(file, child);

        // Enviar estado inicial
        child.send({ type: 'init', context});

        // Escuchar mensajes del hijo (opcional)
        child.on('message', (msg) => {
            console.log(`[Manager] Message from ${file}:`, msg);
        });

        // Limpieza si el hijo se cierra
        child.on('exit', (code) => {
            console.log(`[Manager] board file ${file} exited with code ${code}`);
            if(code) {
                logger.info(`Autopilot crashed for file: ${file} with code ${code}`);
            }
            processes.delete(file);
            onExit && onExit(file, code);
            //remove watcher
            if(watchers[file]) {
                watchers[file].close();
                delete watchers[file];
            }
        });

        if(skipWatch) {
            return true;
        }
        //set watcher for file changes
        let timer = null;
        watchers[file] = watch(file, { persistent: true, ignoreInitial: true })
            .on('change', (changedFile) => {
                console.log(`[Manager] File changed: ${changedFile}`);
                if (timer) {
                    clearTimeout(timer);
                }
                timer = setTimeout(() => {
                    if (!processes.has(file)) {
                        console.warn(`[Manager] No process found for file ${file}, skipping restart.`);
                        return;
                    }
                    console.log(`[Manager] Stopping board file ${file} due to change`);
                    Manager.stop(file);
                    setTimeout(() => {
                        console.log(`[Manager] Restarting board file ${file}`);
                        // Restart the process
                        Manager.start(file, getContext, onExit, false); // last param at true leads to boards only updating on the first change
                    }, 500);
                }, 1000);

            })
            .on('error', (error) => {
                console.error(`[Manager] Error watching file ${file}:`, error);
            });

        return true
    },

    stop: (file) => {
        const child = processes.get(file);
        if (child) {
            processes.delete(file);
            child.kill();
            return true
        } else {
            return false
        }
    },

    isRunning: (file) => {
        const child = processes.get(file);
        return !!child && !child.killed;
    },

    update: (file, chunk, key?, value?) => {
        const child = processes.get(file);
        if (child) {
            child.send({ type: 'update', chunk, key, value });
        }
    }
};
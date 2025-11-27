const path = require('path');
const currentDir = path.dirname(__filename);


module.exports = {
    apps: [{
        name: "python",
        script: path.join(currentDir, 'run.js'),
        args: '-m flask --app server run',
        interpreter: "node",
        windowsHide: true,
        autorestart: true,
        treekill: true,
        kill_timeout: 5000,
        cwd: currentDir,
        watch: [
            path.join(currentDir),  // Ruta que deseas monitorear
            path.join(currentDir, '..', '..', 'packages' ,'app')  // Añade otros directorios si es necesario
        ],
        watch_options: {
            followSymlinks: false,  
            usePolling: true,       
            interval: 1000,         
            depth: 10,
            ignored: [
                '**/*.!(py)',
            ]
        },
        log_date_format: "YYYY-MM-DD HH:mm:ss",
        out_file: '../../logs/raw/python.stdout.log',
        error_file: '../../logs/raw/python.stderr.log',
    }]
};
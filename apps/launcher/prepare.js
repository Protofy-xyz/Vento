const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

if(!fs.existsSync('public')) {
    fs.mkdirSync('public')
    //copy from ../../data/public
    const publicPath = path.resolve(__dirname, '../../data/public')
    fs.cpSync(publicPath, 'public', { recursive: true, force: true })
    console.log("Copied public files from data directory")
}

if (!fs.existsSync('../../electron/launcher')) {
    console.log("Compiling launcher app...")
    
    const child = spawn('yarn', ['package'], {
        stdio: 'inherit',
        shell: true,
        cwd: __dirname
    })
    
    child.on('error', (err) => {
        console.error('Failed to compile launcher:', err)
        process.exit(1)
    })
    
    child.on('close', (code) => {
        if (code !== 0) {
            console.error(`Launcher compilation failed with code ${code}`)
            process.exit(code)
        }
    })
}

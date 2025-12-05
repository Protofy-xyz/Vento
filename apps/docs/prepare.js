const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')


if (!fs.existsSync('../../data/pages/docs/index.html')) {
    console.log("Compiling docs app...")
    
    const child = spawn('yarn', ['package'], {
        stdio: 'inherit',
        shell: true,
        cwd: __dirname
    })
    
    child.on('error', (err) => {
        console.error('Failed to compile docs:', err)
        process.exit(1)
    })
    
    child.on('close', (code) => {
        if (code !== 0) {
            console.error(`Docs compilation failed with code: ${code}`)
            process.exit(code)
        }
    })
}

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const fast = process.argv[2] === '--fast'

if (!fs.existsSync('../../data/pages/workspace/index.html')) {
    console.log("Compiling adminpanel app...")
    
    // Usar spawn con stdio: 'inherit' para evitar maxBuffer
    const child = spawn('yarn', ['package'], {
        stdio: 'inherit',
        shell: true,
        cwd: __dirname
    })
    
    child.on('error', (err) => {
        console.error('Failed to compile adminpanel:', err)
        process.exit(1)
    })
    
    child.on('close', (code) => {
        if (code !== 0) {
            console.error(`Adminpanel compilation failed with code ${code}`)
            process.exit(code)
        }
    })
}

//run yarn to install dependencies in ../cinny
const path = require('path');
const { execSync, spawn } = require('child_process');
const fs = require('fs');

const cinnyDir = path.join(__dirname, '..', 'cinny');

console.log('Installing dependencies for Cinny...');
execSync('yarn install', { cwd: cinnyDir, stdio: 'inherit' });

if (!fs.existsSync('../../data/pages/chat/index.html')) {
    console.log("Compiling cinny app...")
    
    const child = spawn('yarn', ['package'], {
        stdio: 'inherit',
        shell: true,
        cwd: cinnyDir
    })
    
    child.on('error', (err) => {
        console.error('Failed to compile cinny:', err)
        process.exit(1)
    })
    
    child.on('close', (code) => {
        if (code !== 0) {
            console.error(`Cinny compilation failed with code ${code}`)
            process.exit(code)
        }
    })
}

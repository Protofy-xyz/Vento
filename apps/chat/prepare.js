//run yarn to install dependencies in ../cinny
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const cinnyDir = path.join(__dirname, '..', 'cinny');

console.log('Installing dependencies for Cinny...');
execSync('yarn install', { cwd: cinnyDir, stdio: 'inherit' });

if (!fs.existsSync('../../data/pages/chat/index.html')) {
    //run yarn package
    const { exec } = require('child_process');
    console.log("Compiling cinny app...")

    exec('yarn package', { cwd: cinnyDir }, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(stdout);
    });
}

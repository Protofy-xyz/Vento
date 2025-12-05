//add apps/launcher to package.json workspaces
const fs = require('fs');
const path = require('path');
const dirname = path.join(__dirname, '..')

const packagePath = path.join(dirname, 'package.json');

// load package.json and replace workspaces with the ones we want to keep
if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    //check if workspaces includes apps/launcher
    if (!packageJson.workspaces.includes('apps/launcher')) {
        packageJson.workspaces.push('apps/launcher');
    } else {
        console.log('apps/launcher already in package.json workspaces');
    }
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('package.json workspaces have been updated');
} else {
    console.error('package.json not found');
    process.exit(1);
}
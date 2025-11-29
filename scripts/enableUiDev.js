
const fs = require('fs');
const path = require('path');
const dirname = path.join(__dirname, '..')

const packagePath = path.join(dirname, 'package.json');

// load package.json and replace workspaces with the ones we want to keep
if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    //check if workspaces includes apps/adminpanel and apps/chat
    //if not, add them
    if (!packageJson.workspaces.includes('apps/adminpanel')) {
        packageJson.workspaces.push('apps/adminpanel');
    }
    
    if (!packageJson.workspaces.includes('apps/chat')) {
        packageJson.workspaces.push('apps/chat');
    }

    if (!packageJson.workspaces.includes('apps/cinny')) {
        packageJson.workspaces.push('apps/cinny');
    }
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('package.json workspaces have been updated');
} else {
    console.error('package.json not found');
    process.exit(1);
}
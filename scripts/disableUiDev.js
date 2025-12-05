
const fs = require('fs');
const path = require('path');
const dirname = path.join(__dirname, '..')

const packagePath = path.join(dirname, 'package.json');

// load package.json and replace workspaces with the ones we want to keep
if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    packageJson.workspaces = packageJson.workspaces.filter(workspace => workspace !== 'apps/adminpanel' && workspace !== 'apps/chat' && workspace !== 'apps/launcher' && workspace !== 'apps/docs');
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('package.json workspaces have been updated to exclude frontend development');
} else {
    console.error('package.json not found');
    process.exit(1);
}
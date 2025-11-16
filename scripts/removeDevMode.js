
const fs = require('fs');
const path = require('path');
const dirname = path.join(__dirname, '..')

const packagePath = path.join(dirname, 'package.json');
const workspaces = [
    "apps/api",
    "apps/core",
    "apps/chat",
    "apps/dendrite",
    "packages/app",
    "packages/config",
    "packages/protobase",
    "packages/protodevice",
    "packages/protonode",
    "extensions/*",
    "scripts"
]
// load package.json and replace workspaces with the ones we want to keep
if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.workspaces = workspaces;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log('package.json workspaces have been updated');
} else {
    console.error('package.json not found');
    process.exit(1);
}
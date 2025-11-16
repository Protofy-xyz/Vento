//scricpt to shrink the project by removing unnecessary files and directories
//useful to create a smaller package for distribution

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { execSync } = require('child_process');

const dirname = path.join(__dirname, '..')

// Remove node_modules directory
//only if not osx
if (process.platform === 'darwin') {
    console.log('Skipping node_modules removal on macOS');
} else {
    const nodeModulesPath = path.join(dirname, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
        rimraf.sync(nodeModulesPath);
        console.log('node_modules directory has been removed');
    }
}

//remove apps/cinny/node_modules
const cinnyNodeModulesPath = path.join(dirname, 'apps', 'cinny', 'node_modules');
if (fs.existsSync(cinnyNodeModulesPath)) {
    rimraf.sync(cinnyNodeModulesPath);
    console.log('apps/cinny/node_modules directory has been removed');
}

//remove apps/adminpanel/.next
const nextPath = path.join(dirname, 'apps', 'adminpanel', '.next');
if (fs.existsSync(nextPath)) {
    rimraf.sync(nextPath);
    console.log('.next directory in apps/adminpanel has been removed');
}

//remove apps/adminpanel/out
const outPath = path.join(dirname, 'apps', 'adminpanel', 'out');
if (fs.existsSync(outPath)) {
    rimraf.sync(outPath);
    console.log('out directory in apps/adminpanel has been removed');
}

//remove .yarn/cache
const yarnCachePath = path.join(dirname, '.yarn', 'cache');
if (fs.existsSync(yarnCachePath)) {
    rimraf.sync(yarnCachePath);
    console.log('.yarn/cache directory has been removed');
}


//check if its running on windows and remove bin/node-linux and bin/node-macos
const binPathLinux = path.join(dirname, 'bin', 'node-linux');
const binPathMacos = path.join(dirname, 'bin', 'node-macos');
if (process.platform === 'win32') {
    if (fs.existsSync(binPathLinux)) {
        rimraf.sync(binPathLinux);
        console.log('bin/node-linux has been removed');
    }
    if (fs.existsSync(binPathMacos)) {
        rimraf.sync(binPathMacos);
        console.log('bin/node-macos has been removed');
    }
}

//remove .env
// const envPath = path.join(dirname, '.env');
// if (fs.existsSync(envPath)) {
//     fs.unlinkSync(envPath);
//     console.log('.env file has been removed');
// }

//remove data/databases/* (and all its subdirectories and files)
const dataPath = path.join(dirname, 'data', 'databases');
if (fs.existsSync(dataPath)) {
    fs.readdirSync(dataPath).forEach(file => {
        const filePath = path.join(dataPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            rimraf.sync(filePath);
            console.log(`Removed directory: ${filePath}`);
        } else {
            fs.unlinkSync(filePath);
            console.log(`Removed file: ${filePath}`);
        }
    });
} else {
    console.log('data/databases directory does not exist');
}

//remove logs/* except for logs/.keep
const logsPath = path.join(dirname, 'logs');
if (fs.existsSync(logsPath)) {
    fs.readdirSync(logsPath).forEach(file => {
        const filePath = path.join(logsPath, file);
        if (file !== '.keep') { // Keep the .keep file
            if (fs.lstatSync(filePath).isDirectory()) {
                rimraf.sync(filePath);
                console.log(`Removed directory: ${filePath}`);
            } else {
                fs.unlinkSync(filePath);
                console.log(`Removed file: ${filePath}`);
            }
        }
    });
}

//remove apps/adminpanel/.tamagui
const tamaguiPath = path.join(dirname, 'apps', 'adminpanel', '.tamagui');
if (fs.existsSync(tamaguiPath)) {
    rimraf.sync(tamaguiPath);
    console.log('.tamagui directory in apps/adminpanel has been removed');
}

//remove settings
const settingsPath = path.join(dirname, 'data', 'settings');
if (fs.existsSync(settingsPath)) {
    fs.readdirSync(settingsPath).forEach(file => {
        const filePath = path.join(settingsPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            rimraf.sync(filePath);
            console.log(`Removed directory: ${filePath}`);
        } else {
            fs.unlinkSync(filePath);
            console.log(`Removed file: ${filePath}`);
        }
    });
}

//delete preincluded assets
const assetsPath = path.join(dirname, 'data', 'assets');
if (fs.existsSync(assetsPath)) {
    fs.readdirSync(assetsPath).forEach(file => {
        const filePath = path.join(assetsPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            rimraf.sync(filePath);
            console.log(`Removed directory: ${filePath}`);
        } else {
            fs.unlinkSync(filePath);
            console.log(`Removed file: ${filePath}`);
        }
    });
} else {
    console.log('data/assets directory does not exist');
}

//delete the contents of data/keys
const keysPath = path.join(dirname, 'data', 'keys');
if (fs.existsSync(keysPath)) {
    fs.readdirSync(keysPath).forEach(file => {
        const filePath = path.join(keysPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            rimraf.sync(filePath);
            console.log(`Removed directory: ${filePath}`);
        } else {
            fs.unlinkSync(filePath);
            console.log(`Removed file: ${filePath}`);
        }
    });
} else {
    console.log('data/keys directory does not exist');
}


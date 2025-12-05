const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'build');
const targetDir = path.join(__dirname, '..', '..', 'data', 'pages', 'docs');

function copyRecursive(src, dest) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function cleanDirectory(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

console.log('Copying docs build to data/pages/docs/...');

// Clean target directory
cleanDirectory(targetDir);

// Copy build to target
if (fs.existsSync(sourceDir)) {
    copyRecursive(sourceDir, targetDir);
    console.log('✓ Docs build copied to data/pages/docs/');
} else {
    console.error('✗ Build directory not found. Run "docusaurus build" first.');
    process.exit(1);
}


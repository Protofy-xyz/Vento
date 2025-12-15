const { execSync } = require('child_process');

const VENTO_REMOTE = 'vento';
const VENTO_URL = 'https://github.com/Protofy-xyz/Vento.git';
const VENTO_BRANCH = 'main';

function run(cmd, options = {}) {
    console.log(`> ${cmd}`);
    try {
        execSync(cmd, { stdio: 'inherit', ...options });
        return true;
    } catch (e) {
        if (!options.ignoreError) {
            throw e;
        }
        return false;
    }
}

function exec(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf-8' }).trim();
    } catch (e) {
        return null;
    }
}

function getRemoteUrl(name) {
    return exec(`git remote get-url ${name}`);
}

function remoteExists(name) {
    return getRemoteUrl(name) !== null;
}

function isValidVentoUrl(url) {
    if (!url) return false;
    return url.includes('Protofy-xyz/Vento') || url.includes('protofy-xyz/vento');
}

function hasUncommittedChanges() {
    const status = exec('git status --porcelain');
    return status && status.length > 0;
}

function hasMergeInProgress() {
    const mergeHead = exec('git rev-parse -q --verify MERGE_HEAD');
    return mergeHead !== null;
}

async function main() {
    console.log('🔄 Vento Update\n');

    // Check for merge in progress
    if (hasMergeInProgress()) {
        console.error('❌ There is a merge in progress. Please resolve it first:');
        console.error('   git merge --abort     (to cancel)');
        console.error('   git merge --continue  (after resolving conflicts)');
        process.exit(1);
    }

    // Check for uncommitted changes
    if (hasUncommittedChanges()) {
        console.error('❌ You have uncommitted changes. Please:');
        console.error('   git stash             (to save temporarily)');
        console.error('   git commit -am "..."  (to commit)');
        process.exit(1);
    }

    // Check if remote "vento" exists
    if (!remoteExists(VENTO_REMOTE)) {
        console.log(`📡 Remote "${VENTO_REMOTE}" not found. Adding...`);
        run(`git remote add ${VENTO_REMOTE} ${VENTO_URL}`);
        console.log(`✅ Remote "${VENTO_REMOTE}" added.\n`);
    } else {
        const currentUrl = getRemoteUrl(VENTO_REMOTE);
        if (!isValidVentoUrl(currentUrl)) {
            console.error(`❌ Remote "${VENTO_REMOTE}" exists but points to:`);
            console.error(`   ${currentUrl}`);
            console.error(`   Expected: ${VENTO_URL}`);
            console.error(`\n   To fix: git remote set-url ${VENTO_REMOTE} ${VENTO_URL}`);
            process.exit(1);
        }
        console.log(`✅ Remote "${VENTO_REMOTE}" already exists: ${currentUrl}\n`);
    }

    // Fetch from vento
    console.log(`📥 Fetching from ${VENTO_REMOTE}...`);
    run(`git fetch ${VENTO_REMOTE}`);

    // Merge vento/main
    console.log(`\n🔀 Merging ${VENTO_REMOTE}/${VENTO_BRANCH}...`);
    const mergeSuccess = run(`git merge ${VENTO_REMOTE}/${VENTO_BRANCH}`, { ignoreError: true });
    
    if (!mergeSuccess) {
        console.error('\n⚠️  Merge failed (probably conflicts). Resolve conflicts and then run:');
        console.error('   git merge --continue');
        console.error('   yarn clean && yarn package');
        process.exit(1);
    }

    // Clean
    console.log('\n🧹 Cleaning...');
    run('yarn clean');

    // Package
    console.log('\n📦 Packaging...');
    run('yarn package');

    console.log('\n✅ Vento update completed!');
}

main().catch(err => {
    console.error('\n❌ Error during update:', err.message);
    process.exit(1);
});

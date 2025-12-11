const { glob } = require('glob');
const fs = require('fs/promises');
const path = require('path');

const patterns = [
  'packages/*/dist',
  'packages/*/.next',
  'apps/*/dist',
  'apps/*/.next',
  'apps/*/out',
  'apps/dendrite/bin',
  'apps/clients/*/dist',
  'apps/clients/*/build',
  'apps/clients/*/.next',
  'apps/clients/*/out',
  'extensions/*/dist',
  'extensions/*/build',
  'extensions/*/.next',
  'data/pages',
  'bin'
];

const cwd = process.cwd();

const removeDir = async (target) => {
  await fs.rm(target, { recursive: true, force: true });
  console.log(`Removed ${path.relative(cwd, target)}`);
};

const main = async () => {
  const matches = new Set();

  for (const pattern of patterns) {
    const paths = await glob(pattern, {
      cwd,
      dot: true,
      absolute: true,
      ignore: ['**/node_modules/**']
    });
    paths.forEach((p) => matches.add(p));
  }

  if (!matches.size) {
    console.log('Nothing to clean.');
    return;
  }

  for (const target of Array.from(matches).sort()) {
    await removeDir(target);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const path = require('path');
const fs = require('fs');

async function main() {
  const [projectsDir, projectName, version] = process.argv.slice(2);

  if (!projectsDir || !projectName || !version) {
    console.error('[worker] Missing arguments', { projectsDir, projectName, version });
    process.exit(1);
  }

  try {
    const tag = version === 'latest' ? 'latest' : 'v' + version;
    const releaseUrl = 'https://api.github.com/repos/Protofy-xyz/Vento/releases/tags/' + tag;

    console.log('[worker] Fetching release info for', { projectName, tag });
    const response = await fetch(releaseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch release info: ' + response.status);
    }

    const data = await response.json();
    const zipBallUrl = data?.assets?.[0]?.browser_download_url;
    if (!zipBallUrl) {
      throw new Error('Release asset not found');
    }

    const zipFilePath = path.join(projectsDir, `${projectName}.zip`);
    console.log('[worker] Downloading zip to', zipFilePath);
    const zipResponse = await fetch(zipBallUrl);
    if (!zipResponse.ok) {
      throw new Error('Failed to download project zip: ' + zipResponse.status);
    }

    const arrayBuffer = await zipResponse.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(zipFilePath, zipBuffer);

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipFilePath);
    const projectFolderPath = path.join(projectsDir, projectName);
    console.log('[worker] Extracting to', projectFolderPath);
    zip.extractAllTo(projectFolderPath, true);
    fs.unlinkSync(zipFilePath);

    const removeDevModeScript = path.join(projectFolderPath, 'scripts', 'removeDevMode.js');
    console.log('[worker] Running removeDevMode script');
    require(removeDevModeScript);

    const downloadBinariesScript = path.join(projectFolderPath, 'scripts', 'download-bins.js');
    console.log('[worker] Running download-bins script');
    await require(downloadBinariesScript)(AdmZip, require('tar'));

    const downloadDendriteScript = path.join(projectFolderPath, 'scripts', 'download-dendrite.js');
    console.log('[worker] Running download-dendrite script');
    await require(downloadDendriteScript)(AdmZip, require('tar'));

    console.log('[worker] Download completed successfully for', projectName);
    process.exit(0);
  } catch (err) {
    console.error('[worker] Download failed:', err);
    process.exit(1);
  }
}

main();


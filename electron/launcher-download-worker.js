const path = require('path');
const fs = require('fs');

async function main() {
  const [projectsDir, projectName, version] = process.argv.slice(2);

  if (!projectsDir || !projectName || !version) {
    console.error('[worker] Missing arguments', { projectsDir, projectName, version });
    process.exit(1);
  }

  const serializeError = (err, step) => ({
    message: err?.message || String(err),
    stack: err?.stack,
    step,
  });

  const notify = (type, payload = {}) => {
    if (typeof process.send !== 'function') return;
    try {
      process.send({ type, ...payload });
    } catch (err) {
      console.warn('[worker] Failed to send IPC message:', err?.message || err);
    }
  };

  let currentStep = 'init';

  try {
    currentStep = 'fetch-release';
    const releaseUrl = 'https://api.github.com/repos/Protofy-xyz/Vento/releases/tags/' + version;

    console.log('[worker] Fetching release info for', { projectName, version });
    const response = await fetch(releaseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch release info: ' + response.status);
    }

    currentStep = 'parse-release';
    const data = await response.json();
    const zipBallUrl = data?.assets?.[0]?.browser_download_url;
    if (!zipBallUrl) {
      throw new Error('Release asset not found');
    }

    const zipFilePath = path.join(projectsDir, `${projectName}.zip`);
    console.log('[worker] Downloading zip to', zipFilePath);
    currentStep = 'download-zip';
    const zipResponse = await fetch(zipBallUrl);
    if (!zipResponse.ok) {
      throw new Error('Failed to download project zip: ' + zipResponse.status);
    }

    currentStep = 'write-zip';
    const arrayBuffer = await zipResponse.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(zipFilePath, zipBuffer);

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipFilePath);
    const projectFolderPath = path.join(projectsDir, projectName);
    console.log('[worker] Extracting to', projectFolderPath);
    currentStep = 'extract-zip';
    zip.extractAllTo(projectFolderPath, true);
    fs.unlinkSync(zipFilePath);

    const removeDevModeScript = path.join(projectFolderPath, 'scripts', 'removeDevMode.js');
    console.log('[worker] Running removeDevMode script');
    currentStep = 'remove-dev-mode';
    require(removeDevModeScript);

    const downloadBinariesScript = path.join(projectFolderPath, 'scripts', 'download-bins.js');
    console.log('[worker] Running download-bins script');
    currentStep = 'download-bins';
    await require(downloadBinariesScript)(AdmZip, require('tar'));

    const downloadAgentScript = path.join(projectFolderPath, 'scripts', 'download-agent.js');
    console.log('[worker] Running download-agent script');
    currentStep = 'download-agent';
    const { downloadAgent } = require(downloadAgentScript);
    await downloadAgent({ force: true });

    const downloadDendriteScript = path.join(projectFolderPath, 'scripts', 'download-dendrite.js');
    console.log('[worker] Running download-dendrite script');
    currentStep = 'download-dendrite';
    await require(downloadDendriteScript)(AdmZip, require('tar'));

    currentStep = 'done';
    console.log('[worker] Download completed successfully for', projectName);
    notify('download-success', { step: currentStep });
    process.exit(0);
  } catch (err) {
    console.error('[worker] Download failed:', err);
    notify('download-error', serializeError(err, currentStep));
    process.exit(1);
  }
}

main();


import * as fspath from 'path';
import * as fsSync from 'fs';
import { promises as fs } from 'fs';
import { BoardsDir } from "../../extensions/boards/system/boards";
import { acquireLock, releaseLock } from "../../extensions/boards/system/lock";
import { json } from 'stream/consumers';

const VersionsBaseDir = (root: string) => fspath.join(root, 'data', 'versions');

const VersionDir = (root: string, boardId: string, version: number | string) =>
  fspath.join(VersionsBaseDir(root), boardId, String(version));

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function copyFileIfExists(src: string, dst: string) {
  if (fsSync.existsSync(src)) {
    await ensureDir(fspath.dirname(dst));
    await fs.copyFile(src, dst);
  }
}

export async function copyDirRecursive(srcDir: string, dstDir: string) {
  if (!fsSync.existsSync(srcDir)) return;
  await ensureDir(dstDir);
  for (const entry of await fs.readdir(srcDir, { withFileTypes: true })) {
    const src = fspath.join(srcDir, entry.name);
    const dst = fspath.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(src, dst);
    } else {
      await ensureDir(fspath.dirname(dst));
      await fs.copyFile(src, dst);
    }
  }
}

export async function snapshotBoardFiles(root: string, boardId: string, version: number) {
  const base = BoardsDir(root);
  const jsonPath = fspath.join(base, `${boardId}.json`);
  const logicPath = fspath.join(base, `${boardId}.js`);
  const uiPath = fspath.join(base, `${boardId}_ui.js`);
  const boardFolder = fspath.join(base, boardId);

  const dstBase = VersionDir(root, boardId, version);

  await acquireLock(jsonPath);
  try {
    await ensureDir(dstBase);
    //force version number in JSON
    const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
    jsonData.version = version;
    await fs.writeFile(fspath.join(dstBase, `${boardId}.json`), JSON.stringify(jsonData, null, 2)); // pretty print
    await copyFileIfExists(logicPath, fspath.join(dstBase, `${boardId}.js`));
    await copyFileIfExists(uiPath,    fspath.join(dstBase, `${boardId}_ui.js`));
    await copyDirRecursive(boardFolder, fspath.join(dstBase, boardId));
  } catch (e) {
    console.error('snapshotBoardFiles error:', e);
    throw e;
  } finally {
    releaseLock(jsonPath);
  }
}

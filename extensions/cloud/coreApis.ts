import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuid } from "uuid";
import dotenv from 'dotenv'
import { API, isElectron } from "protobase";
import infraUrls from "@extensions/protoinfra/utils/protoInfraUrls";

const ensureProjectInstanceId = async (envPath: string) => {
    try {
        const rawEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const parsed = rawEnv ? dotenv.parse(rawEnv) : {};
        const existing = parsed.PROJECT_INSTANCE_ID || process.env.PROJECT_INSTANCE_ID;
        if (existing) {
            process.env.PROJECT_INSTANCE_ID = existing;
            return existing;
        }
        const id = uuid();
        const needsEol = rawEnv.length > 0 && !rawEnv.endsWith('\n') && !rawEnv.endsWith('\r\n');
        const prefix = needsEol ? os.EOL : '';
        fs.appendFileSync(envPath, `${prefix}PROJECT_INSTANCE_ID=${id}${os.EOL}`);
        process.env.PROJECT_INSTANCE_ID = id;
        return id;
    } catch (err) {
        console.warn('[env] Could not ensure PROJECT_INSTANCE_ID:', (err as any)?.message || err);
        return process.env.PROJECT_INSTANCE_ID || '';
    }
};

const shouldSendTelemetry = async (telemetryPath: string) => {
    try {
        if (!fs.existsSync(telemetryPath)) {
            return true;
        }
        const raw = await fs.promises.readFile(telemetryPath, 'utf8');
        const normalized = raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
        return normalized !== 'false';
    } catch (err) {
        console.warn('[env] Could not read cloud telemetry setting:', (err as any)?.message || err);
        return true;
    }
};

function getCurrentBranch(repoPath) {
    try {
        const headPath = path.join(repoPath, ".git", "HEAD");
        const content = fs.readFileSync(headPath, "utf8").trim();

        if (content.startsWith("ref:")) {
            return content.replace("ref: refs/heads/", "").trim();
        }

        return content;
    } catch (err) {
        return undefined;
    }
}

function getCurrentCommit(repoPath) {
    try {
        const branch = getCurrentBranch(repoPath);

        if (/^[0-9a-f]{40}$/i.test(branch)) return branch;
        const commitPath = path.join(repoPath, ".git", "refs", "heads", branch);
        return fs.readFileSync(commitPath, "utf8").trim();
    } catch (err) {
        return undefined;
    }
}

const envPath = path.resolve(process.cwd(), '../../.env');
const sourcePath = path.resolve(process.cwd(), '../../');
const telemetryPath = path.resolve(process.cwd(), '../../data/settings/cloud.telemetry');

export default async (app, context) => {
    await ensureProjectInstanceId(envPath);

    await context.automations.scheduleJob({
        croneTime: '0 */20 * * * *',
        name: 'cloud-telemetry',
        callback: async () => {
            if (!await shouldSendTelemetry(telemetryPath)) {
                return;
            }
            const electronRuntime = isElectron();
            await API.post(infraUrls.cloud.telemetry, {
                path: "/vento/alive",
                from: process.env.PROJECT_INSTANCE_ID,
                payload: {
                    platform: os.platform(),
                    release: os.release(),
                    version: os.version(),
                    arch: os.arch(),
                    electron: electronRuntime,
                    gitCommit: getCurrentCommit(sourcePath),
                    gitBranch: getCurrentBranch(sourcePath),    
                    totalmem: os.totalmem(),
                    freemem: os.freemem(),
                    hostname: os.hostname(),
                    osUptime: os.uptime(),
                    processUptime: process.uptime(),
                }
            });
        },
        runOnInit: true
    });
}
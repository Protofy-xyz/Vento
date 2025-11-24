import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuid } from "uuid";
import dotenv from 'dotenv'
import { API } from "protobase";
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

const envPath = path.resolve(process.cwd(), '../../.env');

export default async (app, context) => {
    await ensureProjectInstanceId(envPath);

    await context.automations.scheduleJob({
        croneTime: '0 */20 * * * *',
        name: 'cloud-telemetry',
        callback: async () => {
            await API.post(infraUrls.cloud.telemetry, {
                path: "/vento/alive",
                from: process.env.PROJECT_INSTANCE_ID,
                payload: {
                    platform: os.platform(),
                    release: os.release(),
                    version: os.version(),
                    arch: os.arch(),
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
import { API } from "protobase";
import { DevicesModel } from ".";
import { AutoAPI, handler, getServiceToken, getDeviceToken,getRoot } from 'protonode'
import { getLogger, generateEvent } from 'protobase';
import * as fs from 'fs';
import { promises as promisesFs } from 'fs';
import * as fspath from 'path';
import { addAction } from "@extensions/actions/coreContext/addAction";
import { addCard } from "@extensions/cards/coreContext/addCard";
import { removeActions } from "@extensions/actions/coreContext/removeActions";
import { gridSizes as GRID } from 'protolib/lib/gridConfig';
import { compileMessagesTopic } from "@extensions/esphome/utils";
import { connect as mqttConnect, IClientOptions } from 'mqtt';
import { protoInfraUrls } from "@extensions/protoinfra/utils/protoInfraUrls";
import { randomUUID } from 'crypto';

const PER_PARAM_ROWS = 1; // tweak as needed (extra grid rows per visible param)
const PADDING_ICON = 6; // extra padding for icon

const computeCardSize = (paramsObj?: Record<string, any>) => {
    const baseWidth = 2
    const baseHeight = 6
    const paramCount = Object.keys(paramsObj ?? {}).length > 1
        ? Object.keys(paramsObj ?? {}).length
        : 0;

    const width = baseWidth;
    const height =
        paramCount > 0 ? baseHeight + paramCount * PER_PARAM_ROWS + PADDING_ICON : baseHeight;

    return { width, height };
};

// Accepts the stored card object so we can inspect src.id and defaults.name
const inferSubsystemFromId = (
    idOrName: string,                // what you're currently looping (e.g., 'leds_red')
    deviceName: string,
    src?: any                        // the stored card object
) => {
    const storedId: string | undefined = src?.id;              // where addCard's id should be
    const humanName: string | undefined = src?.defaults?.name; // e.g. 'asas leds red'

    //   console.log('[inferSubsystemFromId] INPUT', { idOrName, deviceName, storedId, humanName });

    // 1) Prefer the true stored ID if present (full prefix format)
    const pick = storedId || idOrName;

    // Fast-paths for full IDs
    const monPrefix = `devices_monitors_${deviceName}_`;
    if (pick.startsWith(monPrefix)) {
        const rest = pick.slice(monPrefix.length);
        // console.log('[inferSubsystemFromId] monitors fast-path', { pick, rest });
        return rest || 'misc';
    }

    const actPrefix = `devices_${deviceName}_`;
    if (pick.startsWith(actPrefix)) {
        const rest = pick.slice(actPrefix.length); // <subsystem>_<action...> OR just <subsystem>
        const firstUnderscore = rest.indexOf('_');
        const subsys = firstUnderscore >= 0 ? rest.slice(0, firstUnderscore) : rest;
        // console.log('[inferSubsystemFromId] actions fast-path', { pick, rest, subsys });
        if (subsys) return subsys;
    }

    // 2) Short-key heuristic (what your API is returning: 'leds_red', 'leds_off', etc.)
    //    Take the segment before the first underscore if it exists and is non-empty.
    if (idOrName.includes('_')) {
        const subsys = idOrName.split('_')[0] || '';
        if (subsys) {
            //   console.log('[inferSubsystemFromId] short-key heuristic', { idOrName, subsys });
            return subsys;
        }
    }

    // 3) Try to infer from defaults.name: usually "<deviceName> <subsystem> ..."
    if (humanName) {
        const prefix = `${deviceName} `;
        let tail = humanName.startsWith(prefix) ? humanName.slice(prefix.length) : humanName;
        // Split by space or underscore and grab first token that isn’t empty.
        const token = (tail.split(/[\s_]+/).find(Boolean) || '').trim();
        if (token) {
            //   console.log('[inferSubsystemFromId] humanName heuristic', { humanName, token });
            return token;
        }
    }

    // 4) Last fallback
    //   console.log('[inferSubsystemFromId] fallback -> misc', { idOrName, deviceName });
    return 'misc';
};



// Pack items left→right and wrap
const pack = (items: Array<{ i: string; w: number; h: number }>, cols: number) => {
    const out: any[] = [];
    let x = 0, y = 0, rowH = 0;
    for (const it of items) {
        const w = Math.min(it.w, cols);
        if (x + w > cols) { x = 0; y += rowH; rowH = 0; }
        out.push({ i: it.i, x, y, w, h: it.h, isResizable: true });
        x += w; rowH = Math.max(rowH, it.h);
    }
    return out;
};

// Shift a layout vertically by offsetY
const shiftY = (layout: any[], offsetY: number) =>
    layout.map(l => ({ ...l, y: l.y + offsetY }));

// Compute total height of a packed section (max y+h)
const sectionHeight = (layout: any[]) =>
    layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);

const SIZE = {
    value: {
        lg: { w: GRID.lg.normalW, h: GRID.lg.normalH },
        md: { w: GRID.md.normalW, h: GRID.md.normalH },
        sm: { w: GRID.sm.normalW, h: GRID.sm.normalH },
        xs: { w: GRID.xs.normalW, h: GRID.xs.normalH },
    },
    action: {
        lg: { w: GRID.lg.normalW, h: GRID.lg.normalH },
        md: { w: GRID.md.normalW, h: GRID.md.normalH },
        sm: { w: GRID.sm.normalW, h: GRID.sm.normalH },
        xs: { w: GRID.xs.normalW, h: GRID.xs.normalH },
    },
};

// --- Smarter board generator: groups by subsystem, uses gridSizes totals ---
const generateDeviceBoard = async (
  boardName: string = 'devices_all',
  deviceName?: string          // <- NEW
) => {
    const token = getServiceToken();

    const DEFAULT_HTML_VALUE = `//@card/react
function Widget(card) {
  const value = card.value;
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} height="100%" ai="center" jc="center" width="100%">
          {card.icon && card.displayIcon !== false && (
            <Icon name={card.icon} size={48} color={card.color}/>
          )}
          {card.displayResponse !== false && (
            <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? "N/A"} />
          )}
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
`;

    const DEFAULT_HTML_ACTION = `//@card/react
function Widget(card) {
  const value = card.value;
  const content = <YStack f={1} ai="center" jc="center" width="100%">
    {card.icon && card.displayIcon !== false && (
      <Icon name={card.icon} size={48} color={card.color}/>
    )}
    {card.displayResponse !== false && (
      <CardValue mode={card.markdownDisplay ? 'markdown' : card.htmlDisplay ? 'html' : 'normal'} value={value ?? "N/A"} />
    )}
  </YStack>
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <ActionCard data={card}>
          {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}
        </ActionCard>
      </ProtoThemeProvider>
    </Tinted>
  );
}
`;

    const makeKey = (s: string, kind: 'value' | 'action') =>
        `${kind}_${s.replace(/[^a-z0-9_]+/gi, '_').toLowerCase()}`;

    try {
        const cards: any[] = [];
        type Sized = { i: string; w: number; h: number; id: string; device: string; subsystem: string; };
        const buckets = {
            lg: new Map<string, Sized[]>(),
            md: new Map<string, Sized[]>(),
            sm: new Map<string, Sized[]>(),
            xs: new Map<string, Sized[]>(),
        };
        const ensureBucket = (bp: 'lg' | 'md' | 'sm' | 'xs', key: string) => {
            if (!buckets[bp].has(key)) buckets[bp].set(key, []);
            return buckets[bp].get(key)!;
        };

        const treeResp = await API.get(`/api/core/v1/cards?token=${token}`);
        const cardsArray = Array.isArray(treeResp?.data?.items) ? treeResp.data.items : [];
        console.log('🤖 ~ generateDeviceBoard ~ cardsArray:', cardsArray)
        const deviceCardsArray = cardsArray.filter((card: any) => card?.group === 'devices');
        console.log('🤖 ~ generateDeviceBoard ~ deviceCardsArray:', deviceCardsArray)

        const devicesMap = new Map<string, any[]>();
        for (const card of deviceCardsArray) {
            const tag = card?.tag || 'unknown';
            if (!devicesMap.has(tag)) {
                devicesMap.set(tag, []);
            }
            devicesMap.get(tag)!.push(card);
        }

        console.log('🤖 ~ generateDeviceBoard ~ devicesMap:', devicesMap)

        const deviceEntries = deviceName
            ? (devicesMap.has(deviceName) ? [[deviceName, devicesMap.get(deviceName)!]] : [])
            : Array.from(devicesMap.entries());

        console.log('🤖 ~ generateDeviceBoard ~ deviceEntries:', deviceEntries)

        for (const [deviceName, deviceCards] of deviceEntries) {
            for (const cardEntry of deviceCards) {
                const id = cardEntry?.name ?? cardEntry?.id ?? cardEntry?.key;
                if (!id || id === 'devices_table') continue;
                const src = cardEntry || {};
                const d = src.defaults || {};

                const type: 'value' | 'action' = (d.type === 'action') ? 'action' : 'value';
                const humanName = `${id}`;
                const key = makeKey(`${deviceName}__${id}`, type);
                const size = SIZE[type];

                const card: any = {
                    key,
                    name: humanName,
                    type: d.type || 'value',
                    icon: d.icon || '',
                    description: d.description || '',
                    width: d.width,
                    height: d.height,
                };

                if ('rulesCode' in d) card.rulesCode = d.rulesCode;
                if ('params' in d) card.params = d.params;
                if ('configParams' in d) card.configParams = d.configParams;
                if ('method' in d) card.method = d.method;
                if ('persistValue' in d) card.persistValue = d.persistValue;
                if ('buttonMode' in d) card.buttonMode = d.buttonMode;
                if ('buttonLabel' in d) card.buttonLabel = d.buttonLabel;
                if ('displayButton' in d) card.displayButton = d.displayButton;
                if ('displayButtonIcon' in d) card.displayButtonIcon = d.displayButtonIcon;
                if ('displayIcon' in d) card.displayIcon = d.displayIcon;
                if ('displayResponse' in d) card.displayResponse = d.displayResponse;
                if ('html' in d && d.html) card.html = d.html;
                if ('color' in d) card.color = d.color;

                if (!card.html) {
                    card.html = (type === 'action') ? DEFAULT_HTML_ACTION : DEFAULT_HTML_VALUE;
                }

                cards.push(card);

                const subsystem = inferSubsystemFromId(id, deviceName, src);
                if (subsystem === 'misc') {
                    console.log('🤖 ~ generateDeviceBoard ~ subsystem: misc', { deviceName, id, storedId: src?.id, humanName: d?.name });
                }
                const groupKey = `${deviceName}::${subsystem}`;
                // push sizes per breakpoint
                ensureBucket('lg', groupKey).push({ i: key, w: size.lg.w, h: size.lg.h, id, device: deviceName, subsystem });
                ensureBucket('md', groupKey).push({ i: key, w: size.md.w, h: size.md.h, id, device: deviceName, subsystem });
                ensureBucket('sm', groupKey).push({ i: key, w: size.sm.w, h: size.sm.h, id, device: deviceName, subsystem });
                ensureBucket('xs', groupKey).push({ i: key, w: size.xs.w, h: size.xs.h, id, device: deviceName, subsystem });
            }
        }

        const aiTemplatePath = fspath.join(process.cwd(), '..', '..', 'data', 'templates', 'boards', 'smart ai agent', 'smart ai agent.json');
        let aiTemplateJson: any = {};
        if (fs.existsSync(aiTemplatePath)) {
            const aiTemplateData = fs.readFileSync(aiTemplatePath, 'utf-8');
            aiTemplateJson = JSON.parse(aiTemplateData);
            for (const card of aiTemplateJson.cards || []) {
                cards.push(card);
            }
        }

        // --- after you've finished filling `buckets` (lg/md/sm/xs) ---
        const groupWeights = new Map<string, number>();

        // Use lg bucket as canonical — membership is identical across breakpoints
        for (const [gk, items] of buckets.lg.entries()) {
            const weight = items.length; // monitors + actions -> #cards in group
            groupWeights.set(gk, weight);
        }

        // Pretty log of all weights once
        console.groupCollapsed('[devices_board] Subsystem weights');
        for (const [gk, weight] of groupWeights.entries()) {
            const [device, subsystem] = gk.split('::');
            console.log(`- ${device} :: ${subsystem} -> weight=${weight}`);
        }
        console.groupEnd();

        // helper: shift both axes
        const shiftXY = (layout: any[], dx: number, dy: number) =>
            layout.map(l => ({ ...l, x: l.x + dx, y: l.y + dy }));

        // compute width (in cols) a local packed group actually uses
        const groupWidth = (layout: any[]) =>
            layout.reduce((m, l) => Math.max(m, l.x + l.w), 0);

        // --- after computing groupWeights + the weights log ---
        const buildGroupedLayout = (bp: 'lg' | 'md' | 'sm' | 'xs', cols: number) => {
            const groupKeys = Array.from(buckets[bp].keys()).sort((a, b) => {
                const wa = groupWeights.get(a) ?? buckets[bp].get(a)?.length ?? 0;
                const wb = groupWeights.get(b) ?? buckets[bp].get(b)?.length ?? 0;
                if (wa !== wb) return wa - wb;
                const [da, sa] = a.split('::');
                const [db, sb] = b.split('::');
                return da === db ? sa.localeCompare(sb) : da.localeCompare(db);
            });

            // log final order
            console.groupCollapsed(`[devices_board] Order @ ${bp} (cols=${cols})`);
            groupKeys.forEach((gk, i) => {
                const [device, subsystem] = gk.split('::');
                const w = groupWeights.get(gk) ?? buckets[bp].get(gk)?.length ?? 0;
                console.log(`${i + 1}. ${device} :: ${subsystem} (weight=${w})`);
            });
            console.groupEnd();

            let curX = 0;      // current column
            let curY = 0;      // current row (y coord)
            let rowH = 0;      // tallest group height in the current row
            const result: any[] = [];

            for (const gk of groupKeys) {
                const items = buckets[bp].get(gk)!;

                // Pack this group's cards locally (origin at 0,0)
                const local = pack(items.map(({ i, w, h }) => ({ i, w, h })), cols);

                // Measure this group's footprint
                const gW = Math.min(groupWidth(local), cols);   // cols occupied
                const gH = sectionHeight(local);                // rows occupied

                // If it doesn't fit in the remaining columns, wrap to next row
                if (curX + gW > cols) {
                    curX = 0;
                    curY += rowH + 1;    // +1 row spacer between rows of groups
                    rowH = 0;
                }

                // Place this group at (curX, curY)
                const placed = shiftXY(local, curX, curY);
                result.push(...placed);

                // Advance cursor
                curX += gW;            // move to the right after the block
                rowH = Math.max(rowH, gH);
            }

            return result;
        };


        const layouts = {
            lg: buildGroupedLayout('lg', GRID.lg.totalCols),
            md: buildGroupedLayout('md', GRID.md.totalCols),
            sm: buildGroupedLayout('sm', GRID.sm.totalCols),
            xs: buildGroupedLayout('xs', GRID.xs.totalCols),
        };
        const emptyLayouts = {
            lg: [],
            md: [],
            sm: [],
            xs: [],
        }

        const payload = {
            name: boardName,
            version: Date.now(),
            layouts: emptyLayouts,
            cards,
            rules: [],
            network: "core",
            tags: ["network"],
            autopilot: false,
            icon: 'router',
            savedAt: Date.now()
        };

        try {
            await API.get(`/api/core/v1/boards/${encodeURIComponent(boardName)}/delete?token=${token}`);
            logger.info({ boardName }, 'Deleted existing board before re-creating');
        } catch (e: any) {
            const status = e?.response?.status || e?.status;
            if (status !== 404) {
                logger.warn({ boardName, err: e?.response?.data || e }, 'Delete board failed (non-404)');
            }
        }

        await API.post(`/api/core/v1/boards?token=${token}`, payload);
        logger.info({ boardName, count: cards.length }, 'Generated devices board with grouped subsystem layouts');
    } catch (err) {
        logger.error({ err }, 'Failed to generate devices board');
    }
};

const deleteDeviceCards = async (deviceName: string) => {
    try {
        const token = getServiceToken();
        // fetch the full cards tree
        const cardsTree = await API.get(`/api/core/v1/cards?token=${token}`);

        // cardsTree structure: { [group]: { [tag]: { [name]: {...} } } }
        const deviceCards = cardsTree?.data?.devices?.[deviceName] || {};
        const names = Object.keys(deviceCards);

        if (!names.length) return;

        // POST-based delete per card: /api/core/v1/cards/:group/:tag/:name/delete
        await Promise.all(
            names.map((name) =>
                API.post(
                    `/api/core/v1/cards/devices/${encodeURIComponent(
                        deviceName
                    )}/${encodeURIComponent(name)}/delete?token=${token}`,
                    {}
                ).catch((err) => {
                    logger.error({ deviceName, name, err }, 'Failed deleting device card');
                })
            )
        );

        logger.info({ deviceName, count: names.length }, 'Deleted device cards');
    } catch (err) {
        logger.error({ err }, 'Failed deleting cards for device');
    }
};
const deleteDeviceActions = async (deviceName: string) => {
    try {
        // remove actions (ProtoMemDB 'actions' chunk) + emit delete events
        await removeActions({
            chunk: 'actions',
            group: 'devices',
            tag: deviceName,
        });
        logger.info({ deviceName }, 'Deleted device actions');

        // also remove all cards belonging to this device
        await deleteDeviceCards(deviceName);
    } catch (err) {
        logger.error({ deviceName, err }, 'Failed deleting actions/cards for device');
    }
};

const dataDir = (root) => fspath.join(root, "/data/devices/")


const getDB = (path, req, session) => {
    const db = {
        async *iterator() {
            // console.log("Iterator")
            try {
                await promisesFs.access(dataDir(getRoot(req)), promisesFs.constants.F_OK)
            } catch (error) {
                console.log("Creating deviceDefinitions folder")
                await promisesFs.mkdir(dataDir(getRoot(req)))
            }
            const files = (await promisesFs.readdir(dataDir(getRoot(req)))).filter(f => {
                const filenameSegments = f.split('.')
                return !fs.lstatSync(fspath.join(dataDir(getRoot(req)), f)).isDirectory() && (filenameSegments[filenameSegments.length - 1] === "json")
            })
            // console.log("Files: ", files)
            for (const file of files) {
                //read file content
                const fileContent = await promisesFs.readFile(dataDir(getRoot(req)) + file, 'utf8')
                yield [file.name, fileContent];
            }
        },

        async del(key, value) {
            console.log("Deleting key: ", JSON.stringify({key,value}))
            const filePath = dataDir(getRoot(req)) + key + ".json"
            try {
                await promisesFs.unlink(filePath)
            } catch (error) {
                console.log("Error deleting file: " + filePath)
            }
        },

        async put(key, value) {
            const filePath = dataDir(getRoot(req)) + key + ".json"
            const ymlPath = dataDir(getRoot(req)) + key +  "/config.yaml"
            // if folder does not exist, create it
            await promisesFs.mkdir(dataDir(getRoot(req)) + key, { recursive: true })
            try{
                const defaultYamlContent = `esphome:
  platformio_options:
    board_build.flash_mode: dio
    board_build.arduino.memory_type: opi_opi
    board_upload.maximum_ram_size: 524288
    build_flags:
      - '-DBOARD_HAS_PSRAM'
      - '-DARDUINO_USB_CDC_ON_BOOT=1'
      - '-mfix-esp32-psram-cache-issue'
  name: ${key}
esp32:
  board: esp32-s3-devkitc-1
  variant: esp32s3
  flash_size: 16Mb
  framework:
    type: arduino
logger: {}
`
                await promisesFs.writeFile(filePath, value)
                if (!fs.existsSync(ymlPath)) {
                    await promisesFs.writeFile(ymlPath, defaultYamlContent)
                }
            }catch(error){
                console.error("Error creating file: " + filePath, error)
            }
        },

        async get(key) {
            const filePath = dataDir(getRoot(req)) + key + ".json"
            try{
                const fileContent = await promisesFs.readFile(filePath, 'utf8')
                return fileContent
            }catch(error){
                throw new Error("File not found")
            }                   
        }
    };

    return db;
}

// iterate over all devices and register an action for each subsystem action
const registerActions = async () => {
    const db = getDB('devices')
    //db.iterator is yeilding
    for await (const [key, value] of db.iterator()) {
        // console.log('device: ', value)
        const deviceInfo = DevicesModel.load(JSON.parse(value))
        // 🔴 delete existing actions & cards for this device before adding new ones
        await deleteDeviceActions(deviceInfo.data.name)

        for (const subsystem of deviceInfo.data?.subsystem) {
            // console.log('subsystem: ', subsystem)
            if (subsystem.name == "mqtt") continue
            for (const monitor of subsystem.monitors ?? []) {
                // console.log('monitor: ', monitor)
                const monitorModel = deviceInfo.getMonitorByEndpoint(monitor.endpoint)
                const stateName = deviceInfo.getStateNameByMonitor(monitorModel)
                const iconFromValue = monitor.cardProps?.icon ?? "scan-eye";
                const colorFromValue = monitor.cardProps?.color;
                const { width, height } = computeCardSize({});
                const cardWidth = monitor.cardProps?.width || width;
                const cardHeight = monitor.cardProps?.height || height;

                if (subsystem.monitors.length == 1) {

                    addCard({
                        group: 'devices',
                        tag: deviceInfo.data.name,
                        id: 'devices_monitors_' + deviceInfo.data.name + '_' + subsystem.name,
                        templateName: deviceInfo.data.name + ' ' + subsystem.name + ' device value',
                        name: subsystem.name,
                        defaults: {
                            name: deviceInfo.data.name + ' ' + subsystem.name,
                            description: monitor.description ?? "",
                            rulesCode: `return states['devices']['${deviceInfo.data.name}']['${stateName}']`,
                            type: 'value',
                            icon: iconFromValue,
                            ...(colorFromValue ? { color: colorFromValue } : {}),
                            width: cardWidth,
                            height: cardHeight
                        },
                        emitEvent: true
                    })
                } else {
                    addCard({
                        group: 'devices',
                        tag: deviceInfo.data.name,
                        id: 'devices_monitors_' + deviceInfo.data.name + '_' + monitor.name,
                        templateName: deviceInfo.data.name + ' ' + monitor.name + ' device value',
                        name: monitor.name,
                        defaults: {
                            name: deviceInfo.data.name + ' ' + monitor.name,
                            description: monitor.description ?? "",
                            rulesCode: `return states['devices']['${deviceInfo.data.name}']['${stateName}']`,
                            type: 'value',
                            icon: iconFromValue,
                            ...(colorFromValue ? { color: colorFromValue } : {}),
                            width: width,
                            height: height
                        },
                        emitEvent: true
                    })
                }
            }
            const formatParamsJson = (json) => {
                const parts = Object.entries(json).map(([key, value]) => {
                    return `${key} ${value}`;
                });

                if (parts.length === 0) {
                    return 'No constraints specified';
                }

                return `The value must have ${parts.join(', ')}`;
            }

            for (const action of subsystem.actions ?? []) {
                const url = `/api/core/v1/devices/${deviceInfo.data.name}/subsystems/${subsystem.name}/actions/${action.name}`;
                const isJsonSchema = action.payload?.type === "json-schema";

                const params = { 
                    value: {
                        description: action.description ?? "Value to send",
                    } 
                };
                if (isJsonSchema) {
                    delete params.value
                    const toParamType = (schemaType?: string) => {
                        switch (schemaType) {
                            case 'int':
                            case 'number':
                                return 'number';
                            case 'array':
                            case 'object':
                                return 'json';
                            case 'boolean':
                                return 'boolean';
                            default:
                                return 'string';
                        }
                    };
                    type JsonSchema = {
                        type?: 'string' | 'number' | 'int' | 'boolean' | 'object' | 'array';
                        default?: any;
                        enum?: any[];
                        minimum?: number;
                        properties?: Record<string, JsonSchema>;
                        required?: string[];
                        items?: JsonSchema;
                        description?: string;
                    };

                    const exampleForSchema = (field?: JsonSchema): any => {
                        if (!field || typeof field !== 'object') return null;

                        // If an explicit default is provided, prefer it
                        if (field.default !== undefined) return field.default;

                        switch (field.type) {
                            case 'object': {
                                const props = field.properties || {};
                                const keys = field.required?.length ? field.required : Object.keys(props);
                                const out: Record<string, any> = {};
                                for (const key of keys) {
                                    out[key] = exampleForSchema(props[key]);
                                }
                                return JSON.stringify(out, null, 2);
                            }
                            case 'array': {
                                // Build a one-element example array
                                const item = exampleForSchema(field.items || { type: 'string' });
                                return [item];
                            }
                            case 'string':
                                return Array.isArray(field.enum) && field.enum.length ? field.enum[0] : '';
                            case 'number':
                            case 'int':
                                return typeof field.minimum === 'number' ? field.minimum : 0;
                            case 'boolean':
                                return false;
                            default:
                                return null;
                        }
                    };

                    if (action.payload?.schema && typeof action.payload?.schema === "object") {
                        for (const [key, value] of Object.entries(action.payload.schema)) {
                            if (typeof value === "object" && !Array.isArray(value)) {
                                params[key] = {
                                    visible: true,
                                    description: value.description ?? formatParamsJson(value),
                                    defaultValue: exampleForSchema(value),
                                    type: toParamType(value.type)
                                }
                                if (value.enum) {
                                    params[key].description += ` Possible values: ${value.enum.join(", ")}`;
                                }
                            } else {
                                params[key] = {
                                    visible: true,
                                    description: '',
                                    defaultValue: '',
                                    type: 'string'
                                }
                            }
                        }
                    }


                }
                const rulesCode = isJsonSchema
                    ? `const value = { value: JSON.stringify(userParams) };\nreturn (await execute_action('${url}', value))?.reply`
                    : `return (await execute_action('${url}', userParams))?.reply`;
                const getParams = (params) => {
                    let actionParams = {}
                    for (const key in params) {
                        actionParams[key] = params[key].description || ''
                    }
                    return actionParams
                }
                addAction({
                    group: 'devices',
                    name: subsystem.name + '_' + action.name, //get last path element
                    url: `/api/core/v1/devices/${deviceInfo.data.name}/subsystems/${subsystem.name}/actions/${action.name}`,
                    tag: deviceInfo.data.name,
                    description: action.description ?? "",
                    ...!action.payload?.value ? { params } : {},
                    emitEvent: true
                })
                const iconFromAction = action.cardProps?.icon ?? "rocket";
                const colorFromAction = action.cardProps?.color;
                const { width, height } = computeCardSize(params); // use config params to size
                const cardWidth = action.cardProps?.width || width;
                const cardHeight = action.cardProps?.height || height;
                //http://localhost:8000/api/core/v1/cards to understand what this fills
                addCard({
                    group: 'devices',
                    tag: deviceInfo.data.name,
                    id: 'devices_' + deviceInfo.data.name + '_' + subsystem.name + '_' + action.name,
                    templateName: deviceInfo.data.name + ' ' + subsystem.name + ' ' + action.name + ' device action',
                    name: subsystem.name + '_' + action.name,
                    defaults: (() => {
                        const paramsForDefaults = action.payload?.value ? {} : getParams(params);

                        return {
                            width: cardWidth,
                            height: cardHeight * (action.mode === 'request-reply' ? 2 : 1),
                            icon: iconFromAction,
                            name: deviceInfo.data.name + ' ' + subsystem.name + ' ' + action.name,
                            description: action.description ?? '',
                            rulesCode,
                            params: paramsForDefaults,
                            configParams: params,
                            type: 'action',
                            ...(colorFromAction ? { color: colorFromAction } : {}),
                            displayResponse: action.mode === 'request-reply'
                        };
                    })(),
                    emitEvent: true
                })
            }
        }
        await generateDeviceBoard(deviceInfo.data.name, deviceInfo.data.name);
    }
}

export const DevicesAutoAPI = AutoAPI({
    modelName: 'devices',
    modelType: DevicesModel,
    prefix: '/api/core/v1/',
    skipDatabaseIndexes: true,
    getDB: getDB,
    transformers:{
        generateDeviceCredentials: async (field, e, data) => {
            if(!data.credentials) data.credentials = {}
            data.credentials.mqtt = {username: data.name, password: getDeviceToken(data.name, false)}
            return data
        }

    },
    onBeforeDelete: async (data, session, req) => {
        console.log("🤖 ~ data:", data)
        if(typeof data === 'string') {
            try {
                data = JSON.parse(data)
            } catch (e) {
                console.log("🤖 ~ Failed to parse data:", e)
            }
        }
        // before deleting a device, remove all actions and cards associated with it
        await deleteDeviceActions(data.name)
        //also delete the folder in data/devices/[deviceName]
        const devicePath = fspath.join(process.cwd(), getRoot(req), "data", "devices", data.name)
        if(fs.existsSync(devicePath)){
            fs.rmSync(devicePath, { recursive: true, force: true });
            // console.log("🤖 ~ Deleted device path:", devicePath)
        }
        //delete associated board
        const token = getServiceToken();
        try {
            await API.get(`/api/core/v1/boards/${encodeURIComponent(data.name)}/delete?token=${token}`);
            logger.info({ boardName: data.name }, 'Deleted associated device board');
        } catch (e: any) {
            const status = e?.response?.status || e?.status;
            if (status !== 404) {
                logger.warn({ boardName: data.name, err: e?.response?.data || e }, 'Delete associated device board failed (non-404)');
            }
        }
        return data;
    }

})

const logger = getLogger()


export default (app, context) => {
    const devicesPath = '../../data/devices/'
    const { topicSub, topicPub, mqtt } = context;

    const parseMaybeJSON = (value: string) => {
        if (typeof value !== 'string') {
            return value;
        }
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    };

    const createReplyWaiter = (topic: string, timeoutMs: number) => {
        let readyResolve: (() => void) | undefined;
        const ready = new Promise<void>((resolve) => {
            readyResolve = resolve;
        });

        const wait = new Promise<string>((resolve, reject) => {
            let settled = false;
            let listening = false;

            const cleanup = () => {
                if (settled) return;
                settled = true;
                if (listening) {
                    mqtt?.removeListener?.('message', onMessage as any);
                    mqtt?.unsubscribe?.(topic, () => undefined);
                }
                clearTimeout(timer);
            };

            const onMessage = (messageTopic: string, payload: Buffer) => {
                if (messageTopic !== topic) {
                    return;
                }
                cleanup();
                resolve(payload?.toString?.() ?? String(payload));
            };

            const timer = setTimeout(() => {
                cleanup();
                reject(new Error(`Timeout waiting for reply on ${topic}`));
            }, timeoutMs);

            mqtt?.subscribe(topic, { qos: 1 }, (err) => {
                if (err) {
                    cleanup();
                    reject(err);
                    return;
                }
                listening = true;
                mqtt?.on?.('message', onMessage as any);
                readyResolve?.();
            });
        });

        return { ready, wait };
    };
    DevicesAutoAPI(app, context)
    // Device topics: devices/[deviceName]/[endpoint], en caso de no tener endpoint: devices/[deviceName]
    /* examples
        devices/patata/switch/relay/actions/status
        devices/patata/button/relay/actions/status
        ...
    */


    registerActions()

    app.get('/api/core/v1/devices/registerActions', handler(async (req, res, session) => {
        if(!session || !session.user.admin) {
            res.status(401).send({error: "Unauthorized"})
            return
        }
        registerActions()
        res.send({message: 'Register actions started'})
    }))

    app.get('/api/core/v1/devices/path', handler(async (req, res, session) => {
        const devicesPath = fspath.join(process.cwd(), getRoot(req), "data", "devices")
        if(!session || !session.user.admin) {
            res.status(401).send({error: "Unauthorized"})
            return
        }

        if(!fs.existsSync(devicesPath)){
            console.log("Creating devices path: ", devicesPath)
            fs.mkdir(devicesPath, {recursive: true}, err => {
                if (err) {
                    console.error("Error creating devices path: ", err)
                    res.status(500).send({error: "Internal Server Error"})
                    return
                }else{
                    if(fs.existsSync(devicesPath)){
                        console.log("Devices path created successfully: ", devicesPath)
                        res.send({path: devicesPath})
                        return
                    }else{
                        res.status(404).send({error: "Not Found"})
                        return
                    }
                }
            })
        }else{
            res.send({path: devicesPath})
        }
        
    }))

    app.get('/api/core/v1/devices/:device/subsystems/:subsystem/actions/:action/:value?', handler(async (req, res, session) => {
        if(!session || !session.user.admin) {
            res.status(401).send({error: "Unauthorized"})
            return
        }
        console.log("action params: ",req.params)
        const valueParam = req.params.value ?? req.query.value ?? (req.body && typeof req.body === 'object' ? (req.body as any).value : undefined)
        const value = Array.isArray(valueParam) ? valueParam[0] : valueParam
        const db = getDB('devices')
        const deviceInfo = DevicesModel.load(JSON.parse(await db.get(req.params.device)), session)
        const subsystem = deviceInfo.getSubsystem(req.params.subsystem)
        if(!subsystem) {
            res.status(404).send(`Subsytem [${req.params.subsystem}] not found in device [${req.params.device}]`)
            return
        }
        
        const action = subsystem.getAction(req.params.action)
        if(!action) {
            res.status(404).send(`Action [${req.params.action}] not found in Subsytem [${req.params.subsystem}] for device [${req.params.device}]`)
            return
        }

        const payloadValue = value == undefined ? action.data.payload?.type == "json" ? JSON.stringify(action.getValue()) : action.getValue() : value
        const mode = action.getMode?.()

        if(mode === 'request-reply') {
            const baseEndpoint = action.getEndpoint().replace(/\/+$/, '')
            const requestId = randomUUID().replace(/-/g, '')
            const requestTopic = `${baseEndpoint}/${requestId}`
            const replyTopic = `${requestTopic}/reply`
            const timeoutMs = action.getReplyTimeoutMs?.() ?? action.data.replyTimeoutMs ?? 5000
            const { ready, wait } = createReplyWaiter(replyTopic, timeoutMs)
            try {
                await ready
                topicPub(mqtt, requestTopic, payloadValue ?? '')
                const replyMessage = await wait
                res.send({
                    subsystem: req.params.subsystem,
                    action: req.params.action,
                    device: req.params.device,
                    mode,
                    requestId,
                    replyTopic,
                    result: 'reply',
                    reply: parseMaybeJSON(replyMessage)
                })
            } catch (err: any) {
                const status = err?.message?.toLowerCase?.().includes('timeout') ? 504 : 500
                res.status(status).send({
                    subsystem: req.params.subsystem,
                    action: req.params.action,
                    device: req.params.device,
                    mode,
                    requestId,
                    replyTopic,
                    error: err?.message ?? 'Failed waiting for reply'
                })
            }
            return
        }

        topicPub(mqtt, action.getEndpoint(), payloadValue ?? '')
        
        res.send({
            subsystem: req.params.subsystem,
            action: req.params.action,
            device: req.params.device,
            result: 'done'
        })
    }))

    app.get('/api/core/v1/devices/:device/subsystems/:subsystem/monitors/:monitor', handler(async (req, res, session) => {
        if(!session || !session.user.admin) {
            res.status(401).send({error: "Unauthorized"})
            return
        }

        const db = getDB('devices')
        const deviceInfo = DevicesModel.load(JSON.parse(await db.get(req.params.device)), session)
        const subsystem = deviceInfo.getSubsystem(req.params.subsystem)
        if(!subsystem) {
            res.status(404).send(`Subsytem [${req.params.subsystem}] not found in device [${req.params.device}]`)
            return
        }

        const monitor = subsystem.getMonitor(req.params.monitor)
        if(!monitor) {
            res.status(404).send(`Monitor [${req.params.monitor}] not found in Subsytem [${req.params.subsystem}] for device [${req.params.device}]`)
            return
        }
        
        //x=1 is a dummy param to allow the use of the & operator in the url
        const urlLastDeviceEvent = `/api/core/v1/events?x=1&filter[from]=device&filter[user]=${req.params.device}&filter[path]=${monitor.getEventPath()}&itemsPerPage=1&token=${session.token}&orderBy=created&orderDirection=desc`
        const data = await API.get(urlLastDeviceEvent)

        if(!data || !data.data ||  !data.data['items'] || !data.data['items'].length) {
            res.status(404).send({value:null})
            return
        }
        res.send({value: data.data['items'][0]?.payload?.message})
    }))

    app.post('/api/core/v1/devices/:device/subsystems/:subsystem/monitors/:monitor/ephemeral', handler(async (req, res, session) => {
        if(!session || !session.user.admin) {
            res.status(401).send({error: "Unauthorized"})
            return
        }

        const db = getDB('devices')
        const deviceInfo = DevicesModel.load(JSON.parse(await db.get(req.params.device)), session)
        const subsystem = deviceInfo.getSubsystem(req.params.subsystem)
        if(!subsystem) {
            res.status(404).send(`Subsytem [${req.params.subsystem}] not found in device [${req.params.device}]`)
            return
        }

        const monitor = subsystem.getMonitor(req.params.monitor)
        if(!monitor) {
            res.status(404).send(`Monitor [${req.params.monitor}] not found in Subsytem [${req.params.subsystem}] for device [${req.params.device}]`)
            return
        }
        let {value} = req.body
        if(value == "true"  || value == true) {
            value = true;
        }else{
            value = false;
        }
        const device = deviceInfo.setMonitorEphemeral(req.params.subsystem, req.params.monitor, value)
        if(device){
            await db.put(device.getId(), JSON.stringify(device.serialize(true)))
        }
        res.send({value})
    }))

    const processMessage = async (message: string, topic: string) => {
        const splitted = topic.split("/");
        const device = splitted[0];
        const deviceName = splitted[1];
        const endpoint = splitted.slice(2).join("/")
        let parsedMessage = message;
        try {
            parsedMessage = JSON.parse(message);
        } catch (err) { }
        if (endpoint == 'debug') {
            // logger.error({ from: device, deviceName, endpoint }, JSON.stringify({topic, message}))
        } else {
            const db = getDB('devices')
            let deviceInfo = undefined
            try {
                deviceInfo = DevicesModel.load(JSON.parse(await db.get(deviceName)))
            } catch (err) {
                logger.error({ from: device, deviceName, endpoint }, "Device not found: "+JSON.stringify({topic, message}))
                return
            }
            // console.log("deviceInfo: ", deviceInfo)
            // console.log("subsystems: ", deviceInfo.data.subsystem)
            // console.log("endpoint: ", endpoint)
            const monitor = deviceInfo?.getMonitorByEndpoint("/"+endpoint)
            // console.log("monitor: ", monitor)
            if(!monitor){
                // logger.error({ from: device, deviceName, endpoint }, "Device not found: "+JSON.stringify({topic, message}))
                return
            }
            // const subsystem = deviceInfo.getSubsystem(req.params.subsystem)
            const stateName = deviceInfo.getStateNameByMonitor(monitor)
            context.state.set({ group: 'devices', tag: deviceName, name: stateName, value: parsedMessage, emitEvent: true });
            generateEvent(
                {
                    ephemeral: monitor.data.ephemeral??false,
                    path: endpoint, 
                    from: "device",
                    user: deviceName,
                    payload: {
                        message: parsedMessage,
                        deviceName,
                        endpoint
                    }
                },
                getServiceToken()
            );
        }
    }

    topicSub(mqtt, 'devices/#', (message, topic) => processMessage(message, topic))

    const processCompileMessage = async (message: string, topic: string) => {
        const splitted = topic.split("/");
        const compileSessionId = splitted[2];
        let parsedMessage = message;
        try {
            parsedMessage = JSON.parse(message);
            // console.log("🤖 ~ processCompileMessage ~ parsedMessage:", parsedMessage)
        } catch (err) { }
        let deviceName = parsedMessage.deviceName;

        if(parsedMessage.event == "exit") {
            // console.log("Compile session exited: ", compileSessionId, parsedMessage, deviceName)
            const db = getDB('devices')
            let deviceInfo = undefined
            try {
                deviceInfo = DevicesModel.load(JSON.parse(await db.get(deviceName)))
                if (!deviceInfo.data.data) {
                    deviceInfo.data.data = {};
                }
                deviceInfo.data.data.lastCompile = {
                    sessionId: compileSessionId,
                    timestamp: Date.now(),
                    code: parsedMessage.code,
                    success: parsedMessage.code == 0,
                }
                await db.put(deviceInfo.getId(), JSON.stringify(deviceInfo.serialize(true)))
                console.log("Updated device lastCompile info: ", deviceName, deviceInfo.data.data.lastCompile)
            } catch (err) {
                //logger.error({ deviceName }, "Device not found to update compile info: " + JSON.stringify({ topic, message }))
                return
            }
        }
    }
    const compileBrokerUrl = protoInfraUrls.esphome.mqtt
    const COMPILE_DEFAULT_RECONNECT_PERIOD_MS = 5000;
    const COMPILE_BACKOFF_RECONNECT_PERIOD_MS = 5 * 60 * 1000;
    const MAX_COMPILE_RECONNECT_ATTEMPTS = 12;
    let compileReconnectAttempts = 0;
    let compileBackoffTimer: ReturnType<typeof setTimeout> | null = null;

    const compileClientOpts: IClientOptions = {
        clean: true,
        reconnectPeriod: COMPILE_DEFAULT_RECONNECT_PERIOD_MS
    };

    const scheduleCompileBackoffReconnect = () => {
        if (compileBackoffTimer) return;
        compileBackoffTimer = setTimeout(() => {
            compileBackoffTimer = null;
            compileReconnectAttempts = 0;
            logger.info(`Retrying compile MQTT connection after ${COMPILE_BACKOFF_RECONNECT_PERIOD_MS / 60000} minutes`);
            compileClient.reconnect();
        }, COMPILE_BACKOFF_RECONNECT_PERIOD_MS);
    };

    const compileClient = mqttConnect(compileBrokerUrl, compileClientOpts);
    const subscribeTopic = compileMessagesTopic('#');

    compileClient.on('connect', () => {
        compileReconnectAttempts = 0;
        if (compileBackoffTimer) {
            clearTimeout(compileBackoffTimer);
            compileBackoffTimer = null;
        }
        logger.info({ broker: compileBrokerUrl }, 'Connected to compile MQTT broker');
        compileClient.subscribe(subscribeTopic, { qos: 1 }, (err) => {
            if (err) {
                logger.error({ err }, 'Failed subscribing to ' + subscribeTopic);
            } else {
                logger.info('Subscribed to ' + subscribeTopic);
            }
        });
    });

    compileClient.on('message', (topic, payload) => {
        try {
            const msg = payload?.toString?.() ?? String(payload);
            processCompileMessage(msg, topic);
        } catch (err) {
            logger.error({ err, topic }, 'Error handling compile MQTT message');
        }
    });

    compileClient.on('error', (err) => {
        logger.error({ err }, 'compile MQTT client error');
    });
    compileClient.on('reconnect', () => {
        compileReconnectAttempts += 1;
        logger.info(`Reconnecting to compile MQTT broker (attempt ${compileReconnectAttempts})`);
        if (compileReconnectAttempts >= MAX_COMPILE_RECONNECT_ATTEMPTS && !compileBackoffTimer) {
            logger.warn(`Reached ${MAX_COMPILE_RECONNECT_ATTEMPTS} compile MQTT reconnect attempts. Will retry every ${COMPILE_BACKOFF_RECONNECT_PERIOD_MS / 60000} minutes`);
            compileClient.end(true, () => scheduleCompileBackoffReconnect());
        }
    });
    compileClient.on('close', () => logger.warn('compile MQTT connection closed'));

    process.on('SIGINT', () => {
        compileClient.end(true, () => logger.info('compile MQTT client closed (SIGINT)'));
    });
    process.on('SIGTERM', () => {
        compileClient.end(true, () => logger.info('compile MQTT client closed (SIGTERM)'));
    });

}

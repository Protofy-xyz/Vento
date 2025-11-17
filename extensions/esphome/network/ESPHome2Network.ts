import {
    componentBuilders,
    deepClone,
    toNumberFromGpio
} from '@extensions/esphome/components'

const yaml = require("js-yaml");

const skipGenericSections = new Set(["esp32"]);

const isPlainObject = (value: any) => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};

const toTitleCase = (value: string) => {
    return value
        .split(/[_-]+/g)
        .map(part => part ? part.charAt(0).toUpperCase() + part.slice(1) : "")
        .filter(Boolean)
        .join(" ");
};

const formatGenericValue = (value: any) => {
    if (value === undefined || value === null) return "--";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value);
    } catch (_err) {
        return String(value);
    }
};

const normalizeGenericSectionData = (sectionData: any) => {
    if (Array.isArray(sectionData)) {
        return sectionData.reduce((acc: Record<string, any>, item: any, idx: number) => {
            acc[`item_${idx + 1}`] = item;
            return acc;
        }, {});
    }
    if (isPlainObject(sectionData)) {
        return sectionData;
    }
    if (sectionData === undefined || sectionData === null) {
        return {};
    }
    return { value: sectionData };
};

const buildGenericEditableProps = (sectionData: Record<string, any>) => {
    const entries = Object.entries(sectionData || {});
    if (!entries.length) {
        return {
            estado: {
                label: "Estado",
                default: "Disponible"
            }
        };
    }
    return entries.reduce((acc: Record<string, { label: string; default: string }>, [propKey, propValue]) => {
        acc[propKey] = {
            label: propKey,
            default: formatGenericValue(propValue)
        };
        return acc;
    }, {});
};

const ensureUniqueComponentId = (usedIds: Set<string>, baseId: string) => {
    let uniqueId = baseId;
    let counter = 1;
    while (usedIds.has(uniqueId)) {
        uniqueId = `${baseId}-${counter}`;
        counter += 1;
    }
    usedIds.add(uniqueId);
    return uniqueId;
};

const buildGenericComponent = (sectionKey: string, sectionData: any, usedIds: Set<string>) => {
    if (sectionData === undefined || sectionData === null) {
        return null;
    }
    const normalizedData = normalizeGenericSectionData(sectionData);
    const editableProps = buildGenericEditableProps(normalizedData);
    const label = toTitleCase(sectionKey) || sectionKey;
    const id = ensureUniqueComponentId(usedIds, `generic-${sectionKey}`);
    return {
        id,
        type: "device",
        label,
        category: "generic-config",
        pins: { left: [], right: [] },
        editableProps,
        meta: {
            kind: "generic-config",
            section: sectionKey,
            raw: deepClone(sectionData)
        }
    };
};

const buildGenericComponents = (config: any, existingComponents: any[], knownBuilderKeys: Set<string>) => {
    const generics: any[] = [];
    const usedIds = new Set((existingComponents || []).map((component: any) => component.id));
    Object.entries(config || {}).forEach(([sectionKey, sectionData]) => {
        if (knownBuilderKeys.has(sectionKey) || skipGenericSections.has(sectionKey)) {
            return;
        }
        const component = buildGenericComponent(sectionKey, sectionData, usedIds);
        if (component) {
            generics.push(component);
        }
    });
    return generics;
};

const parseYaml = (yamlText: any) => {
    let config;

    // --- parche !lambda ---
    yamlText = yamlText.replace(/!lambda[ \t]+(.+)/g, (match, code) => {
        const trimmed = code.trim();
        const escaped = trimmed.replace(/'/g, "''");
        return `'@!lambda ''${escaped}''@'`;
    });

    try {
        config = yaml.load(yamlText);
    } catch (e) {
        console.error("Error parsing YAML:", e);
        return null;
    }

    // -----------------------------
    // ESP32/ESP32-S3 pinout definitions
    // -----------------------------
    const espBoards = {
        wroom32: {
            id: "ESP32",
            label: "ESP32-WROOM-32",
            pins: {
                left: [
                    "3V3", "GND", "EN",
                    "GPIO36", "GPIO39", "GPIO34", "GPIO35",
                    "GPIO32", "GPIO33", "GPIO25", "GPIO26"
                ],
                right: [
                    "GPIO27", "GPIO14", "GPIO12", "GPIO13",
                    "GPIO23", "GPIO22", "GPIO1_TX", "GPIO3_RX",
                    "GPIO21_SDA", "GPIO22_SCL"
                ]
            }
        },
        esp32s3_devkitc_1: {
            id: "ESP32S3",
            label: "ESP32-S3-DevKitC-1",
            pins: {
                // Esto es un ejemplo simplificado para el editor,
                // no el pinout completo oficial.
                left: [
                    "3V3", "GND", "EN",
                    "GPIO1", "GPIO2", "GPIO3", "GPIO4",
                    "GPIO5", "GPIO6", "GPIO7", "GPIO8",
                    "GPIO9", "GPIO10", "GPIO11", "GPIO12",
                    "GPIO13", "GPIO14", "GPIO15"
                ],
                right: [
                    "GPIO16", "GPIO17", "GPIO18", "GPIO19",
                    "GPIO20", "GPIO21",
                    "GPIO38", "GPIO39", "GPIO40", "GPIO41"
                ]
            }
        }
    };

    const mapPins = (arr: string[]) =>
        arr.map(name => ({
            name,
            type: name.startsWith("GPIO") ? "gpio" : "power"
        }));

    // ----------------------------------
    // Detectar la placa a partir del YAML
    // ----------------------------------
    const esp32Config = config.esp32 || {};
    const boardName: string = esp32Config.board || "";
    const variant: string = esp32Config.variant || "";

    let boardDef = espBoards.wroom32; // default

    if (variant === "esp32s3" || boardName.includes("esp32-s3-devkitc-1")) {
        boardDef = espBoards.esp32s3_devkitc_1;
    }

    // ----------------------------------
    // Start building schematic
    // ----------------------------------
    let components: any[] = [];
    let subsystems: any[] = [];

    // ESP32 / ESP32-S3 Component
    components.push({
        type: "device",
        id: boardDef.id,
        label: boardDef.label,
        category: "esp-board",
        meta: {
            kind: "esp-board",
            raw: {
                board: boardName,
                variant
            }
        },
        center: true,
        pins: {
            left: mapPins(boardDef.pins.left),
            right: mapPins(boardDef.pins.right)
        }
    });

    // ----------------------------------
    // SWITCH → RELAY
    // ----------------------------------
    const builderContext: Record<string, any> = {}
    const builderKeys = new Set(componentBuilders.map((builder: any) => builder.key))
    componentBuilders.forEach((builder) => {
        const configSection = config[builder.key]
        const {
            components: builtComponents,
            data,
            subsystems: builderSubsystems
        } = builder.build(configSection, builderContext)
        if (builtComponents?.length) {
            components.push(...builtComponents)
        }
        if (builderSubsystems?.length) {
            subsystems.push(...builderSubsystems)
        }
        if (data) {
            builderContext[builder.key] = data
        }
    })

    const genericComponents = buildGenericComponents(config, components, builderKeys)
    if (genericComponents.length) {
        components.push(...genericComponents)
    }

    const schematic = { components, subsystems, config: deepClone(config) ?? {} };
    console.log(JSON.stringify(schematic, null, 4));
    return schematic;
};

const normalizeSection = (items: any[]) => {
    if (items.length === 0) return undefined;
    if (items.length === 1) return items[0];
    return items;
};

const cloneOrEmpty = (obj: any) => {
    const cloned = deepClone(obj);
    if (cloned === undefined || cloned === null) return {};
    return cloned;
};

const dumpYaml = (schematic: any) => {
    if (!schematic) return "";
    const baseConfig = cloneOrEmpty(schematic.config);
    const components = schematic.components || [];

    const findPin = (component: any, pinName: string) => {
        return (
            component?.pins?.left?.find((p: any) => p.name === pinName) ||
            component?.pins?.right?.find((p: any) => p.name === pinName)
        );
    };

    const switches = components
        .filter((c: any) => c.category === "switch")
        .map((component: any) => {
            const raw = cloneOrEmpty(component.meta?.raw);
            raw.platform = raw.platform || "gpio";
            raw.id = component.id;
            raw.name = component.label || component.id;
            const controlPin = findPin(component, "control");
            if (controlPin) {
                const parsedPin = toNumberFromGpio(controlPin.connectedTo);
                if (parsedPin !== undefined) raw.pin = parsedPin;
            }
            const alwaysOn = component.editableProps?.alwaysOn?.default;
            raw.restore_mode = alwaysOn ? "ALWAYS_ON" : "ALWAYS_OFF";
            return raw;
        });

    if (switches.length) {
        baseConfig.switch = normalizeSection(switches);
    } else {
        delete baseConfig.switch;
    }

    const uarts = components
        .filter((c: any) => c.category === "uart")
        .map((component: any) => {
            const raw = cloneOrEmpty(component.meta?.raw);
            raw.id = component.id;
            raw.name = component.label || component.id;
            const txPin = findPin(component, "tx");
            const rxPin = findPin(component, "rx");
            if (txPin) {
                const parsed = toNumberFromGpio(txPin.connectedTo);
                if (parsed !== undefined) raw.tx_pin = parsed;
            }
            if (rxPin) {
                const parsed = toNumberFromGpio(rxPin.connectedTo);
                if (parsed !== undefined) raw.rx_pin = parsed;
            }
            const baudValue = component.editableProps?.baud?.default;
            if (baudValue !== undefined && baudValue !== null && baudValue !== "") {
                raw.baud_rate = Number(baudValue);
            }
            return raw;
        });

    if (uarts.length) {
        baseConfig.uart = normalizeSection(uarts);
    } else {
        delete baseConfig.uart;
    }

    const i2cBuses = components
        .filter((c: any) => c.category === "i2c-bus")
        .map((component: any, idx: number) => {
            const raw = cloneOrEmpty(component.meta?.raw);
            const sdaPin = findPin(component, "SDA");
            const sclPin = findPin(component, "SCL");
            raw.id =
                component.meta?.busId ||
                component.pins?.right?.[0]?.name ||
                raw.id ||
                `i2c_bus${idx}`;
            if (sdaPin) {
                const parsed = toNumberFromGpio(sdaPin.connectedTo);
                if (parsed !== undefined) raw.sda = parsed;
            }
            if (sclPin) {
                const parsed = toNumberFromGpio(sclPin.connectedTo);
                if (parsed !== undefined) raw.scl = parsed;
            }
            return raw;
        });

    if (i2cBuses.length) {
        baseConfig.i2c = normalizeSection(i2cBuses);
    } else {
        delete baseConfig.i2c;
    }

    const mapI2CDevice = (category: string, key: string) =>
        components
            .filter((c: any) => c.category === category)
            .map((component: any, idx: number) => {
                const raw = cloneOrEmpty(component.meta?.raw);
                raw.id = raw.id || component.id || `${category}_${idx}`;
                raw.name = component.label || raw.name || raw.id;
                const busPin = findPin(component, "i2c_bus");
                if (busPin && busPin.connectedTo) {
                    raw.i2c_id = busPin.connectedTo;
                }
                return raw;
            });

    const adxlDevices = mapI2CDevice("adxl345", "adxl345");
    if (adxlDevices.length) {
        baseConfig.adxl345 = normalizeSection(adxlDevices);
    } else {
        delete baseConfig.adxl345;
    }

    const adsDevices = mapI2CDevice("ads1115", "ads1115");
    if (adsDevices.length) {
        baseConfig.ads1115 = normalizeSection(adsDevices);
    } else {
        delete baseConfig.ads1115;
    }

    let dumped = yaml.dump(baseConfig);
    dumped = dumped.replace(/'@!lambda ''(.*?)''@'/g, (_match: string, code: string) => {
        const restoredCode = code.replace(/''/g, "'");
        return `!lambda ${restoredCode}`;
    });
    dumped = dumped.replace(/'@/g, "").replace(/@'/g, "");
    return dumped;
};
// export functions as an object
export {
    parseYaml,
    dumpYaml
};

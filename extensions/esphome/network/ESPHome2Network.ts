const yaml = require("js-yaml");

const deepClone = (value: any) => {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
};

const toNumberFromGpio = (handle?: string | number | null) => {
    if (handle === null || handle === undefined) return undefined;
    if (typeof handle === "number") return handle;
    const text = String(handle);
    const match = text.match(/GPIO\s*(\d+)/i);
    if (match && match[1]) {
        return Number(match[1]);
    }
    const genericDigits = text.match(/(\d+)/);
    if (genericDigits && genericDigits[1]) {
        return Number(genericDigits[1]);
    }
    return text;
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
    if (config.switch) {
        const switches = Array.isArray(config.switch)
            ? config.switch
            : [config.switch];

        switches.forEach((sw, idx) => {
            if (sw.platform === "gpio") {
                components.push({
                    id: `Relay${idx + 1}`,
                    type: "device",
                    label: `Relay ${idx + 1}`,
                    category: "switch",
                    meta: {
                        kind: "switch",
                        raw: deepClone(sw)
                    },
                    editableProps: {
                        alwaysOn: {
                            type: "boolean",
                            label: "Always On",
                            description: "If enabled, the relay reset state will be always on.",
                            default: sw.restore_mode === "ALWAYS_ON"
                        }
                    },
                    pins: {
                        left: [
                            {
                                name: "control",
                                description: "Control pin to activate the relay",
                                connectedTo: `GPIO${sw.pin}`, // aquí ya usas 40,41 del S3
                                type: "input"
                            }
                        ],
                        right: []
                    }
                });
            }
        });
    }

    // ----------------------------------
    // UART support
    // ----------------------------------
    if (config.uart) {
        const uartConfigs = Array.isArray(config.uart)
            ? config.uart
            : [config.uart];

        uartConfigs.forEach((uart, idx) => {
            const uartId = uart.id || `UART${idx}`;

            components.push({
                id: uartId,
                type: "device",
                label: `UART ${idx}`,
                category: "uart",
                meta: {
                    kind: "uart",
                    raw: deepClone(uart)
                },
                editableProps: {
                    baud: {
                        type: "number",
                        label: "Baud Rate",
                        description: "Baud rate for UART communication",
                        default: uart.baud_rate || 115200
                    }
                },
                pins: {
                    left: [
                        {
                            name: "tx",
                            description: "tx pin of UART bus",
                            connectedTo: `GPIO${uart.tx_pin}`,
                            type: "input"
                        },
                        {
                            name: "rx",
                            description: "rx pin of UART bus",
                            connectedTo: `GPIO${uart.rx_pin}`,
                            type: "input"
                        }
                    ],
                    right: [
                        {
                            name: "uart_bus",
                            description: "UART bus",
                            connectedTo: null,
                            type: "output"
                        }
                    ]
                }
            });
        });
    }

    // ----------------------------------
    // I2C support
    // ----------------------------------
    let i2cBuses: string[] = [];

    if (config.i2c) {
        const i2cConfigs = Array.isArray(config.i2c)
            ? config.i2c
            : [config.i2c];

        i2cConfigs.forEach((bus, idx) => {
            const busId = bus.id || `i2c_bus${idx === 0 ? "" : idx + 1}`;

            i2cBuses.push(busId);

            components.push({
                id: `I2C-Bus${idx === 0 ? "" : idx + 1}`,
                type: "device",
                label: `I2C Bus${idx === 0 ? "" : " " + (idx + 1)}`,
                category: "i2c-bus",
                meta: {
                    kind: "i2c-bus",
                    raw: deepClone(bus),
                    busId
                },
                pins: {
                    left: [
                        {
                            name: "SDA",
                            description: "SDA pin of I2C bus",
                            connectedTo: `GPIO${bus.sda}`,
                            type: "input"
                        },
                        {
                            name: "SCL",
                            description: "SCL pin of I2C bus",
                            connectedTo: `GPIO${bus.scl}`,
                            type: "input"
                        }
                    ],
                    right: [
                        {
                            name: busId,
                            description: "I2C bus",
                            connectedTo: null,
                            type: "output"
                        }
                    ]
                }
            });
        });
    }

    // ----------------------------------
    // ADXL SUPPORT (i2c-based sensors)
    // ----------------------------------
    if (config.adxl345) {
            const sensors = Array.isArray(config.adxl345)
            ? config.adxl345
            : [config.adxl345];

        sensors.forEach((sensor, idx) => {
            const busUsed = sensor.i2c_id || i2cBuses[0] || "i2c_bus";

            components.push({
                id: `ADXL${idx === 0 ? "" : idx + 1}`,
                type: "device",
                label: `Accelerometer ADXL${idx === 0 ? "" : idx + 1}`,
                category: "adxl345",
                meta: {
                    kind: "adxl345",
                    raw: deepClone(sensor)
                },
                pins: {
                    left: [
                        {
                            name: "i2c_bus",
                            description: "I2C bus",
                            connectedTo: busUsed
                        }
                    ],
                    right: []
                }
            });
        });
    }

    // ----------------------------------
    // ADS1115 SUPPORT (i2c-based sensors)
    // ----------------------------------
    if (config.ads1115) {
        const sensors = Array.isArray(config.ads1115)
            ? config.ads1115
            : [config.ads1115];
        sensors.forEach((sensor, idx) => {
            const busUsed = sensor.i2c_id || i2cBuses[0] || "i2c_bus";
            components.push({
                id: `ADS1115_${idx === 0 ? "" : idx + 1}`,
                type: "device",
                label: `ADC ADS1115${idx === 0 ? "" : idx + 1}`,
                category: "ads1115",
                meta: {
                    kind: "ads1115",
                    raw: deepClone(sensor)
                },
                pins: {
                    left: [
                        {
                            name: "i2c_bus",
                            description: "I2C bus",
                            connectedTo: busUsed
                        }
                    ],
                    right: []
                }
            });
        });
    }

    const schematic = { components, config: deepClone(config) ?? {} };
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

    return yaml.dump(baseConfig);
};
// export functions as an object
export {
    parseYaml,
    dumpYaml
};

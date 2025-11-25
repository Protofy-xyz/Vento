class NeopixelsBus {
    name;
    platform;
    rgb_order;
    chipset;
    numLeds;
    restoreMode;
    defaultTransitionLength;
    effects = [];
    mqttMsgs;
    type;
    constructor(name, platform, numLeds, rgb_order, chipset, restoreMode, defaultTransitionLength, effect1, effect2, effect3, effect4, effect5, effect6, effect7, effect8, effect9, effect10, effect11) {
        this.name = name
        this.type = 'light'
        this.platform = platform
        this.rgb_order = rgb_order
        this.chipset = chipset
        this.numLeds = numLeds
        this.restoreMode = restoreMode
        this.defaultTransitionLength = defaultTransitionLength
        this.effects = [effect1, effect2, effect3, effect4, effect5, effect6, effect7, effect8, effect9, , effect10, effect11]
        this.mqttMsgs = {
            state: "ON",
            color: {
                r: 255,
                g: 0,
                b: 0
            },
            effect: "My Slow Random Effect",
            brightness: 255
        }
    }
    extractNestedComponents(element, deviceComponents) {
        const keysToExtract = [
          { key: 'mqtt', nestedKey: 'on_message' },
          { key: 'mqtt', nestedKey: 'on_json_message' },
        ];
      
        keysToExtract.forEach(({ key, nestedKey }) => {
          if (element.config[nestedKey]) {
            if(!deviceComponents[key]) deviceComponents[key] = {}
            if(!deviceComponents[key][nestedKey]) deviceComponents[key][nestedKey] = []
    
            if(Array.isArray(deviceComponents[key][nestedKey])){
              deviceComponents[key][nestedKey].push(...element.config[nestedKey])
            } else {
              deviceComponents[key][nestedKey] = {
                ...deviceComponents[key][nestedKey],
                ...element.config[nestedKey]
              }
            }
          }
        });
      }
    
      extractComponent(element, deviceComponents) {
        if (['mqtt'].includes(element.name)) {
          this.extractNestedComponents(element, deviceComponents)
        } else {
          if (!deviceComponents[element.name]) {
            deviceComponents[element.name] = element.config
          } else {
            if (!Array.isArray(deviceComponents[element.name])) {
              deviceComponents[element.name] = [deviceComponents[element.name]]
            }
            deviceComponents[element.name].push(element.config)
          }
        }
      }
    attach(pin, deviceComponents) {
        var hasEffects = false
        this.effects.forEach(element => {
            if (element === true) hasEffects = true;
        });
        const componentObjects = [
            {
                name: this.type,
                config: {
                    platform: this.platform,
                    pin: pin,
                    name: this.name,
                    id: this.name,
                    chipset: this.chipset,
                    num_leds: this.numLeds,
                    rgb_order: this.rgb_order,
                    restore_mode: this.restoreMode,
                    default_transition_length: this.defaultTransitionLength,
                },
                subsystem: this.getSubsystem()

            },
            {
                name: 'mqtt',
                config: {
                  on_json_message: [
                    {
                      topic: `devices/${deviceComponents.esphome.name}/${this.type}/${this.name}/individual_control/command`,
                      then: {
                        "light.addressable_set": {
                            id: this.name,
                            range_from: "@!lambda return (int)(x[\"from\"]);@",
                            range_to: "@!lambda int t=(int)(x[\"from\"]); if (x.containsKey(\"to\")) t=x[\"to\"]; return t;@",
                            red: "@!lambda return (float)((int)x[\"red\"]) / 255.0;@",
                            green: "@!lambda return (float)((int)x[\"green\"]) / 255.0;@",
                            blue: "@!lambda return (float)((int)x[\"blue\"]) / 255.0;@"
                        }
                      }
                    }
                  ]
                }
              },
        ]

        componentObjects.forEach((element, j) => {
            this.extractComponent(element, deviceComponents)
          })
        if (!hasEffects) {
            return deviceComponents;
        } else {
            let effects = []
            if (this.effects[0]) {
                effects = effects.concat([
                    { pulse: null },
                    {
                        pulse:
                        {
                            name: "Fast Pulse",
                            transition_length: "0.5s",
                            update_interval: "0.5s"
                        }
                    },
                    {
                        pulse:
                        {
                            name: "Slow Pulse",
                            update_interval: "2s"
                        }
                    }
                ])
            }
            if (this.effects[1]) {
                effects = effects.concat([
                    { random: null },
                    {
                        random:
                        {
                            name: "My Slow Random Effect",
                            transition_length: "30s",
                            update_interval: "30s"
                        }
                    },
                    {
                        random:
                        {
                            name: "My Fast Random Effect",
                            transition_length: "4s",
                            update_interval: "5s"
                        }
                    }
                ])

            }
            if (this.effects[2]) {
                effects = effects.concat([
                    { strobe: null },
                    {
                        strobe:
                        {
                            name: "Strobe Effect With Custom Values",
                            colors: [{
                                state: true,
                                brightness: "100%",
                                red: "100%",
                                green: "0%",
                                blue: "0%",
                                duration: "500ms"
                            },
                            { state: false, duration: "250ms" },
                            {
                                state: true,
                                brightness: "100%",
                                red: "0%",
                                green: "100%",
                                blue: "0%",
                                duration: "500ms"
                            }
                            ]
                        }
                    }
                ])
            }
            if (this.effects[3]) {
                effects = effects.concat([
                    { flicker: null },
                    {
                        flicker:
                        {
                            name: "Flicker Effect With Custom Values",
                            alpha: "95%",
                            intensity: "1.5%"
                        }
                    }
                ])
            }
            // if (this.effects[4]) {
            //     effects = effects.concat([
            //         { addressable_rainbow: null },
            //         {
            //             addressable_rainbow:
            //             {
            //                 name: "Rainbow Effect With Custom Values",
            //                 speed: 10,
            //                 width: 50
            //             }
            //         }
            //     ])
            // }
            // if (this.effects[5]) {
            //     effects = effects.concat([
            //         { addressable_color_wipe: null },
            //         {
            //             addressable_color_wipe:
            //             {
            //                 name: "Color Wipe Effect With Custom Values",
            //                 add_led_interval: "100ms",
            //                 reverse: false,
            //                 colors: [
            //                     { red: "100%", green: "100%", blue: "100%", num_leds: 1 },
            //                     { red: "0%", green: "0%", blue: "0%", num_leds: 1 },
            //                 ]
            //             }
            //         }
            //     ])
            // }
            // if (this.effects[6]) {
            //     effects = effects.concat([
            //         { addressable_scan: null },
            //         {
            //             addressable_scan:
            //             {
            //                 name: "Scan Effect With Custom Values",
            //                 move_interval: "100ms",
            //                 scan_width: 1
            //             }
            //         }
            //     ])
            // }
            // if (this.effects[7]) {
            //     effects = effects.concat([
            //         { addressable_twinkle: null },
            //         {
            //             addressable_twinkle:
            //             {
            //                 name: "Twinkle Effect With Custom Values",
            //                 twinkle_probability: "5%",
            //                 progress_interval: "4ms"
            //             }
            //         }
            //     ])
            // }
            // if (this.effects[8]) {
            //     effects = effects.concat([
            //         { addressable_random_twinkle: null },
            //         {
            //             addressable_random_twinkle:
            //             {
            //                 name: "Random Twinkle Effect With Custom Values",
            //                 twinkle_probability: "5%",
            //                 progress_interval: "32ms"
            //             }
            //         }
            //     ])
            // }
            // if (this.effects[9]) {
            //     effects = effects.concat([
            //         { addressable_fireworks: null },
            //         {
            //             addressable_fireworks:
            //             {
            //                 name: "Fireworks Effect With Custom Values",
            //                 update_interval: "32ms",
            //                 spark_probability: "10%",
            //                 use_random_color: false,
            //                 fade_out_rate: 120
            //             }
            //         }
            //     ])
            // }

            // if (this.effects[10]) {
            //     effects = effects.concat([
            //         { addressable_flicker: null },
            //         {
            //             addressable_flicker:
            //             {
            //                 name: "Adressable flicker Effect With Custom Values",
            //                 update_interval: "16ms",
            //                 intensity: "5%"
            //             }
            //         }
            //     ])
            // }
            componentObjects[0].config["effects"] = effects
            return deviceComponents;
        }
    }
    getSubsystem() {
        return {
            name: this.name,
            type: this.type,
            actions: [
                {
                    name: 'manual_control',
                    label: 'Manual control',
                    description: 'Control the neopixels manually by setting the state, color, effect and brightness. State can be ON or OFF. Color is an object with r, g and b values between 0 and 255. Effect is a string with the name of the effect to use. Brightness is a value between 0 and 255',
                    endpoint: "/" + this.type + "/" + this.name + "/command",
                    connectionType: 'mqtt',
                    payload: {
                        type: 'json-schema',
                        schema: {
                            "state": { "type": "string", "enum": ["ON", "OFF"] },
                            "color": {
                                "type": "object",
                                "properties": {
                                    "r": { "type": "int", "minimum": 0, "maximum": 255 },
                                    "g": { "type": "int", "minimum": 0, "maximum": 255 },
                                    "b": { "type": "int", "minimum": 0, "maximum": 255 }
                                },
                                "required": ["r", "g", "b"]
                            },
                            "effect": { "type": "string", "enum": ["none"].concat(this.effects.filter(e => e).map((e, i) => {
                                if (i == 0) return ["Fast Pulse", "Slow Pulse"]
                                if (i == 1) return ["My Slow Random Effect", "My Fast Random Effect"]
                                if (i == 2) return ["Strobe Effect With Custom Values"]
                                if (i == 3) return ["Flicker Effect With Custom Values"]
                                // if (i == 4) return ["Rainbow Effect With Custom Values"]
                                // if (i == 5) return ["Color Wipe Effect With Custom Values"]
                                // if (i == 6) return ["Scan Effect With Custom Values"]
                                // if (i == 7) return ["Twinkle Effect With Custom Values"]
                                // if (i == 8) return ["Random Twinkle Effect With Custom Values"]
                                // if (i == 9) return ["Fireworks Effect With Custom Values"]
                                // if (i == 10) return ["Adressable flicker Effect With Custom Values"]
                                return []
                            }).flat()) },
                            "brightness": { "type": "int", "minimum": 0, "maximum": 255, "default": 255 }
                        }
                    },
                    cardProps: {
                        icon: "wrench",
                    },
                },
                {
                    name: 'red',
                    label: 'Red',
                    description: 'Turns on the neopixels in red',
                    props: {
                        theme: "red",
                        color: "$red10"
                    },
                    cardProps: {
                        icon: "lightbulb",
                        color: "$red10"
                    },
                    endpoint: "/" + this.type + "/" + this.name + "/command",
                    connectionType: 'mqtt',
                    payload: {
                        type: 'json',
                        value: {
                            state: "ON",
                            color: {
                                r: 180,
                                g: 0,
                                b: 0
                            },
                            effect: "none",
                            brightness: 255
                        },
                    },
                },
                {
                    name: 'green',
                    label: 'Green',
                    description: 'Turns on the neopixels in green',
                    props: {
                        theme: "green",
                        color: "$green10"
                    },
                    cardProps: {
                        icon: "lightbulb",
                        color: "$green10"
                    },
                    endpoint: "/" + this.type + "/" + this.name + "/command",
                    connectionType: 'mqtt',
                    payload: {
                        type: 'json',
                        value: {
                            state: "ON",
                            color: {
                                r: 0,
                                g: 180,
                                b: 0
                            },
                            effect: "none",
                            brightness: 255
                        },
                    },
                },
                {
                    name: 'blue',
                    label: 'Blue',
                    description: 'Turns on the neopixels in blue',
                    props: {
                        theme: "blue",
                        color: "$blue10"
                    },
                    cardProps: {
                        icon: "lightbulb",
                        color: "$blue10"
                    },
                    endpoint: "/" + this.type + "/" + this.name + "/command",
                    connectionType: 'mqtt',
                    payload: {
                        type: 'json',
                        value: {
                            state: "ON",
                            color: {
                                r: 0,
                                g: 0,
                                b: 180
                            },
                            effect: "none",
                            brightness: 255
                        },
                    },
                },
                {
                    name: 'off',
                    label: 'Turn off',
                    description: 'Turns off the neopixels',
                    props: {
                        theme: "gray",
                        color: "$gray10"
                    },
                    cardProps: {
                        icon: "lightbulb-off",
                        color: "$gray10"
                    },
                    endpoint: "/" + this.type + "/" + this.name + "/command",
                    connectionType: 'mqtt',
                    payload: {
                        type: 'json',
                        value: {
                            state: "OFF",
                            color: {
                                r: 0,
                                g: 0,
                                b: 0
                            },
                            effect: "none",
                            brightness: 255
                        },
                    },
                },
                {
                    name: 'individual_control',
                    label: 'Individual control',
                    description: 'Control individual neopixels. From and to are the indexes of the neopixels to control. Red, green and blue are the color values and must be between 0 and 255',
                    endpoint: "/" + this.type + "/" + this.name + "/individual_control/command",
                    connectionType: 'mqtt',
                    payload: {
                        type: 'json-schema',
                        schema: {
                            "from": { "type": "int", "minimum": 0, "maximum": this.numLeds - 1, "default": 0 },
                            "to": { "type": "int", "minimum": 0, "maximum": this.numLeds - 1, "default": this.numLeds - 1 },
                            "red": { "type": "int", "minimum": 0, "maximum": 255, "default": 0 },
                            "green": { "type": "int", "minimum": 0, "maximum": 255, "default": 0 },
                            "blue": { "type": "int", "minimum": 0, "maximum": 255, "default": 0 }

                          }
                    },
                    cardProps: {
                        icon: "sliders-horizontal",
                    },
                }
            ]
        }
    }
}

export function neopixelsBus(name, numLeds, rgb_order, chipset, restoreMode, defaultTransitionLength, channel, effect1, effect2, effect3, effect4, effect5, effect6, effect7, effect8, effect9, effect10, effect11) {
    return new NeopixelsBus(name, 'esp32_rmt_led_strip', numLeds, rgb_order, chipset, restoreMode, defaultTransitionLength, channel, effect1, effect2, effect3, effect4, effect5, effect6, effect7, effect8, effect9, effect10, effect11)
}
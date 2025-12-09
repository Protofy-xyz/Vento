import { DeviceBoardModel } from ".";
import { AutoAPI } from 'protonode'

const initialData = {
    "Protofy ESP32 devBoard": {
        "id": "1",
        "name": "Protofy ESP32 devBoard",
        "core": "esp32",
        "icon": "/public/images/device/esp32-icon.png",
        "image": "/public/images/device/esp32c4.png",
        "ports": [
            { "number": 1, "side": "left", "name": "3V3", "type": "P", "analog": false, "description": "3V3 Power supply", "maxVoltage": 3.3, "rtc": false },
            { "number": 2, "side": "left", "name": "EN", "type": "I", "analog": false, "description": "CHIP_PU, RESET", "maxVoltage": 3.3, "rtc": false },
            { "number": 3, "side": "left", "name": "36", "type": "I", "analog": true, "description": "GPIO36, ADC1_CH0, S_VP", "maxVoltage": 3.3, "rtc": true },
            { "number": 4, "side": "left", "name": "39", "type": "I", "analog": true, "description": "GPIO39, ADC1_CH3, S_VN", "maxVoltage": 3.3, "rtc": true },
            { "number": 5, "side": "left", "name": "34", "type": "I", "analog": true, "description": "GPIO34, ADC1_CH6, VDET_1", "maxVoltage": 3.3, "rtc": true },
            { "number": 6, "side": "left", "name": "35", "type": "I", "analog": true, "description": "GPIO35, ADC1_CH7, VDET_2", "maxVoltage": 3.3, "rtc": true },
            { "number": 7, "side": "left", "name": "32", "type": "IO", "analog": true, "description": "GPIO32, ADC1_CH4, TOUCH_CH9, XTAL_32K_P", "maxVoltage": 3.3, "rtc": true },
            { "number": 8, "side": "left", "name": "33", "type": "IO", "analog": true, "description": "GPIO33, ADC1_CH5, TOUCH_CH8, XTAL_32K_N", "maxVoltage": 3.3, "rtc": true },
            { "number": 9, "side": "left", "name": "25", "type": "IO", "analog": true, "description": "GPIO25, ADC1_CH8, DAC_1", "maxVoltage": 3.3, "rtc": true },
            { "number": 10, "side": "left", "name": "26", "type": "IO", "analog": true, "description": "GPIO26, ADC2_CH9, DAC_2", "maxVoltage": 3.3, "rtc": true },
            { "number": 11, "side": "left", "name": "27", "type": "IO", "analog": true, "description": "GPIO27, ADC2_CH7, TOUCH_CH7", "maxVoltage": 3.3, "rtc": true },
            { "number": 12, "side": "left", "name": "14", "type": "IO", "analog": true, "description": "GPIO14, ADC2_CH6, TOUCH_CH6, MTMS", "maxVoltage": 3.3, "rtc": true },
            { "number": 13, "side": "left", "name": "12", "type": "IO", "analog": true, "description": "GPIO12, ADC2_CH5, TOUCH_CH5, MTDI", "maxVoltage": 3.3, "rtc": true },
            { "number": 14, "side": "left", "name": "GND", "type": "G", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false },
            { "number": 15, "side": "left", "name": "13", "type": "IO", "analog": true, "description": "GPIO13, ADC2_CH4, TOUCH_CH4, MTCK", "maxVoltage": 3.3, "rtc": true },
            { "number": 16, "side": "left", "name": "9", "type": "IO", "analog": false, "description": "GPIO9, D2", "maxVoltage": 3.3, "rtc": false },
            { "number": 17, "side": "left", "name": "10", "type": "IO", "analog": false, "description": "GPIO10, D3", "maxVoltage": 3.3, "rtc": false },
            { "number": 18, "side": "left", "name": "11", "type": "IO", "analog": false, "description": "GPIO11, CMD", "maxVoltage": 3.3, "rtc": false },
            { "number": 19, "side": "left", "name": "5V", "type": "P", "analog": false, "description": "5V Power supply", "maxVoltage": 5.0, "rtc": false },
            { "number": 1, "side": "right", "name": "GND", "type": "G", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false },
            { "number": 2, "side": "right", "name": "23", "type": "IO", "analog": false, "description": "GPIO23", "maxVoltage": 3.3, "rtc": false },
            { "number": 3, "side": "right", "name": "22", "type": "IO", "analog": false, "description": "GPIO22", "maxVoltage": 3.3, "rtc": false },
            { "number": 4, "side": "right", "name": "TX", "type": "IO", "analog": false, "description": "GPIO1, U0TXD", "maxVoltage": 3.3, "rtc": false },
            { "number": 5, "side": "right", "name": "RX", "type": "IO", "analog": false, "description": "GPIO3, U0RXD", "maxVoltage": 3.3, "rtc": false },
            { "number": 6, "side": "right", "name": "21", "type": "IO", "analog": false, "description": "GPIO21", "maxVoltage": 3.3, "rtc": false },
            { "number": 7, "side": "right", "name": "GND", "type": "GND", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false },
            { "number": 8, "side": "right", "name": "19", "type": "IO", "analog": false, "description": "GPIO19", "maxVoltage": 3.3, "rtc": false },
            { "number": 9, "side": "right", "name": "18", "type": "IO", "analog": false, "description": "GPIO18", "maxVoltage": 3.3, "rtc": false },
            { "number": 10, "side": "right", "name": "5", "type": "IO", "analog": false, "description": "GPIO5", "maxVoltage": 3.3, "rtc": false },
            { "number": 11, "side": "right", "name": "17", "type": "IO", "analog": false, "description": "GPIO17", "maxVoltage": 3.3, "rtc": false },
            { "number": 12, "side": "right", "name": "16", "type": "IO", "analog": false, "description": "GPIO16", "maxVoltage": 3.3, "rtc": false },
            { "number": 13, "side": "right", "name": "4", "type": "IO", "analog": true, "description": "GPIO4, ADC2_CH0, TOUCH_CH0", "maxVoltage": 3.3, "rtc": true },
            { "number": 14, "side": "right", "name": "0", "type": "IO", "analog": true, "description": "GPIO0, ADC2_CH1, TOUCH_CH1, Boot", "maxVoltage": 3.3, "rtc": true },
            { "number": 15, "side": "right", "name": "2", "type": "IO", "analog": true, "description": "GPIO2, ADC2_CH2, TOUCH_CH2", "maxVoltage": 3.3, "rtc": true },
            { "number": 16, "side": "right", "name": "15", "type": "IO", "analog": true, "description": "GPIO15, ADC2_CH3, TOUCH_CH3, MTDO", "maxVoltage": 3.3, "rtc": true },
            { "number": 17, "side": "right", "name": "8", "type": "IO", "analog": false, "description": "GPIO8, D1", "maxVoltage": 3.3, "rtc": false },
            { "number": 18, "side": "right", "name": "7", "type": "IO", "analog": false, "description": "GPIO7, D0", "maxVoltage": 3.3, "rtc": false },
            { "number": 19, "side": "right", "name": "CLK", "type": "IO", "analog": false, "description": "GPIO6, CLK", "maxVoltage": 3.3, "rtc": false }
        ],
        "config": {
            "esphome-arduino":{
                "esphome":{},
                "esp32":{
                    "board": "esp32dev",
                    "variant": "esp32",
                    "framework": { 
                        "type": "arduino"
                    }
                }
            },
            "esphome-idf":{
                "esphome":{},
                "esp32":{
                    "board": "esp32dev",
                    "variant": "esp32", 
                    "framework": { 
                        "type": "esp-idf"
                    }
                }
            },
            "esphome-yaml":{
                "esphome":{
                    "name": "protofy_esp32_devboard"
                },
                "esp32":{
                    "board": "esp32dev",
                    "variant": "esp32",
                    "framework": {
                        "type": "esp-idf"
                    }
                }
            }
        }
    },
    "Seeed Studio XIAO ESP32S3": {
        "id": "2",
        "name": "Seeed Studio XIAO ESP32S3",
        "core": "esp32s3",
        "icon": "/public/images/device/xiao-icon.png",
        "image": "/public/images/device/seeed_xiao_esp32s3.png",
        "ports": [
            { "number": 1, "side": "left", "name": "44", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": false },
            { "number": 2, "side": "left", "name": "7", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true },
            { "number": 3, "side": "left", "name": "8", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true },
            { "number": 4, "side": "left", "name": "9", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true },
            { "number": 5, "side": "left", "name": "3V3", "type": "P", "analog": false, "description": "3V3 Power supply", "maxVoltage": 3.3, "rtc": true },
            { "number": 6, "side": "left", "name": "GND", "type": "G", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false },
            { "number": 7, "side": "left", "name": "VUSB", "type": "P", "analog": false, "description": "USB Voltage", "maxVoltage": 5.0, "rtc": false },

            { "number": 1, "side": "right", "name": "43", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": false },
            { "number": 2, "side": "right", "name": "6", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true },
            { "number": 3, "side": "right", "name": "5", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true },
            { "number": 4, "side": "right", "name": "4", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true },
            { "number": 5, "side": "right", "name": "3", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": false },
            { "number": 6, "side": "right", "name": "2", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true },
            { "number": 7, "side": "right", "name": "1", "type": "IO", "analog": true, "description": "", "maxVoltage": 3.3, "rtc": true }

        ],
        "config": {
            "esphome-arduino":{
                "esphome":{},
                "esp32":{
                    "board": "seeed_xiao_esp32s3",
                    "variant": "esp32s3",
                    "framework": { 
                        "type": "arduino",
                        "version": "latest",
                        "platform_version": "6.5.0"
                    }
                }
            },
            "esphome-idf":{
                "esphome":{},
                "esp32":{
                    "board": "seeed_xiao_esp32s3",
                    "variant": "esp32s3", 
                    "framework": { 
                        "type": "esp-idf"
                    }
                }
            },
            "esphome-yaml":{
                "esphome":{
                    "name": "seeed_xiao_esp32s3"
                },
                "esp32":{
                    "board": "seeed_xiao_esp32s3",
                    "variant": "esp32s3",
                    "framework": { 
                        "type": "arduino",
                        "version": "latest",
                        "platform_version": "6.5.0"
                    }
                }
            }
        }
    },
    "ESP32 S3 DevKitC": {
        "id": "3",
        "name": "ESP32 S3 DevKitC",
        "core": "esp32s3",
        "icon": "/public/images/device/esp32s3-icon.png",
        "image": "/public/images/device/esp32s3-devkitc.png",
        "ports": [
            { "number": 1, "side": "left", "name": "3V3", "type": "P", "analog": false, "description": "3.3 V power supply", "maxVoltage": 3.3, "rtc": false },
            { "number": 2, "side": "left", "name": "3V3", "type": "P", "analog": false, "description": "3.3 V power supply", "maxVoltage": 3.3, "rtc": false },
            { "number": 3, "side": "left", "name": "RST", "type": "I", "analog": false, "description": "EN", "maxVoltage": 3.3, "rtc": false },
            { "number": 4, "side": "left", "name": "4", "type": "IO", "analog": true, "description": "RTC_GPIO4, GPIO4, TOUCH4, ADC1_CH3", "maxVoltage": 3.3, "rtc": true },
            { "number": 5, "side": "left", "name": "5", "type": "IO", "analog": true, "description": "RTC_GPIO5, GPIO5, TOUCH5, ADC1_CH4", "maxVoltage": 3.3, "rtc": true },
            { "number": 6, "side": "left", "name": "6", "type": "IO", "analog": true, "description": "RTC_GPIO6, GPIO6, TOUCH6, ADC1_CH5", "maxVoltage": 3.3, "rtc": true },
            { "number": 7, "side": "left", "name": "7", "type": "IO", "analog": true, "description": "RTC_GPIO7, GPIO7, TOUCH7, ADC1_CH6", "maxVoltage": 3.3, "rtc": true },
            { "number": 8, "side": "left", "name": "15", "type": "IO", "analog": true, "description": "RTC_GPIO15, GPIO15, U0RTS, ADC2_CH4, XTAL_32K_P", "maxVoltage": 3.3, "rtc": true },
            { "number": 9, "side": "left", "name": "16", "type": "IO", "analog": true, "description": "RTC_GPIO16, GPIO16, U0CTS, ADC2_CH5, XTAL_32K_N", "maxVoltage": 3.3, "rtc": true },
            { "number": 10, "side": "left", "name": "17", "type": "IO", "analog": true, "description": "RTC_GPIO17, GPIO17, U1TXD, ADC2_CH6", "maxVoltage": 3.3, "rtc": true },
            { "number": 11, "side": "left", "name": "18", "type": "IO", "analog": true, "description": "RTC_GPIO18, GPIO18, U1RXD, ADC2_CH7, CLK_OUT3", "maxVoltage": 3.3, "rtc": true },
            { "number": 12, "side": "left", "name": "8", "type": "IO", "analog": true, "description": "RTC_GPIO8, GPIO8, TOUCH8, ADC1_CH7, SUBSPICS1", "maxVoltage": 3.3, "rtc": true },
            { "number": 13, "side": "left", "name": "3", "type": "IO", "analog": true, "description": "RTC_GPIO3, GPIO3, TOUCH3, ADC1_CH2", "maxVoltage": 3.3, "rtc": true },
            { "number": 14, "side": "left", "name": "46", "type": "IO", "analog": true, "description": "GPIO46", "maxVoltage": 3.3, "rtc": true },
            { "number": 15, "side": "left", "name": "9", "type": "IO", "analog": true, "description": "RTC_GPIO9, GPIO9, TOUCH9, ADC1_CH8, FSPIHD, SUBSPIHD", "maxVoltage": 3.3, "rtc": true },
            { "number": 16, "side": "left", "name": "10", "type": "IO", "analog": true, "description": "RTC_GPIO10, GPIO10, TOUCH10, ADC1_CH9, FSPICS0, FSPIIO4, SUBSPICS0", "maxVoltage": 3.3, "rtc": true },
            { "number": 17, "side": "left", "name": "11", "type": "IO", "analog": true, "description": "RTC_GPIO11, GPIO11, TOUCH11, ADC2_CH0, FSPID, FSPIIO5, SUBSPID", "maxVoltage": 3.3, "rtc": true },
            { "number": 18, "side": "left", "name": "12", "type": "IO", "analog": true, "description": "RTC_GPIO12, GPIO12, TOUCH12, ADC2_CH1, FSPICLK, FSPIIO6, SUBSPICLK", "maxVoltage": 3.3, "rtc": true },
            { "number": 19, "side": "left", "name": "13", "type": "IO", "analog": true, "description": "RTC_GPIO13, GPIO13, TOUCH13, ADC2_CH2, FSPIQ, FSPIIO7, SUBSPIQ", "maxVoltage": 3.3, "rtc": true },
            { "number": 20, "side": "left", "name": "14", "type": "IO", "analog": true, "description": "RTC_GPIO14, GPIO14, TOUCH14, ADC2_CH3, FSPIWP, FSPIDQS, SUBSPIWP", "maxVoltage": 3.3, "rtc": true },
            { "number": 21, "side": "left", "name": "5V", "type": "P", "analog": false, "description": "5 V power supply", "maxVoltage": 5.0, "rtc": false },
            { "number": 22, "side": "left", "name": "GND", "type": "G", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false },
            
            { "number": 1, "side": "right", "name": "GND", "type": "G", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false },
            { "number": 2, "side": "right", "name": "TX", "type": "IO", "analog": true, "description": "U0TXD, GPIO43, CLK_OUT1", "maxVoltage": 3.3, "rtc": true },
            { "number": 3, "side": "right", "name": "RX", "type": "IO", "analog": true, "description": "U0RXD, GPIO44, CLK_OUT2", "maxVoltage": 3.3, "rtc": true },
            { "number": 4, "side": "right", "name": "1", "type": "IO", "analog": true, "description": "RTC_GPIO1, GPIO1, TOUCH1, ADC1_CH0", "maxVoltage": 3.3, "rtc": true },
            { "number": 5, "side": "right", "name": "2", "type": "IO", "analog": true, "description": "RTC_GPIO2, GPIO2, TOUCH2, ADC1_CH1", "maxVoltage": 3.3, "rtc": true },
            { "number": 6, "side": "right", "name": "42", "type": "IO", "analog": true, "description": "MTMS, GPIO42", "maxVoltage": 3.3, "rtc": true },
            { "number": 7, "side": "right", "name": "41", "type": "IO", "analog": true, "description": "MTDI, GPIO41, CLK_OUT1", "maxVoltage": 3.3, "rtc": true },
            { "number": 8, "side": "right", "name": "40", "type": "IO", "analog": true, "description": "MTDO, GPIO40, CLK_OUT2", "maxVoltage": 3.3, "rtc": true },
            { "number": 9, "side": "right", "name": "39", "type": "IO", "analog": true, "description": "MTCK, GPIO39, CLK_OUT3, SUBSPICS1", "maxVoltage": 3.3, "rtc": true },
            { "number": 10, "side": "right", "name": "38", "type": "IO", "analog": true, "description": "GPIO38, FSPIWP, SUBSPIWP, RGB LED", "maxVoltage": 3.3, "rtc": true },
            { "number": 11, "side": "right", "name": "37", "type": "IO", "analog": true, "description": "SPIDQS, GPIO37, FSPIQ, SUBSPIQ", "maxVoltage": 3.3, "rtc": true },
            { "number": 12, "side": "right", "name": "36", "type": "IO", "analog": true, "description": "SPIIO7, GPIO36, FSPICLK, SUBSPICLK", "maxVoltage": 3.3, "rtc": true },
            { "number": 13, "side": "right", "name": "35", "type": "IO", "analog": true, "description": "SPIIO6, GPIO35, FSPID, SUBSPID", "maxVoltage": 3.3, "rtc": true },
            { "number": 14, "side": "right", "name": "0", "type": "IO", "analog": true, "description": "RTC_GPIO0, GPIO0", "maxVoltage": 3.3, "rtc": true },
            { "number": 15, "side": "right", "name": "45", "type": "IO", "analog": true, "description": "GPIO45", "maxVoltage": 3.3, "rtc": true },
            { "number": 16, "side": "right", "name": "48", "type": "IO", "analog": true, "description": "GPIO48, SPICLK_N, SUBSPICLK_N_DIFF", "maxVoltage": 3.3, "rtc": true },
            { "number": 17, "side": "right", "name": "47", "type": "IO", "analog": true, "description": "GPIO47, SPICLK_P, SUBSPICLK_P_DIFF", "maxVoltage": 3.3, "rtc": true },
            { "number": 18, "side": "right", "name": "21", "type": "IO", "analog": true, "description": "RTC_GPIO21, GPIO21", "maxVoltage": 3.3, "rtc": true },
            { "number": 19, "side": "right", "name": "20", "type": "IO", "analog": true, "description": "RTC_GPIO20, GPIO20, U1CTS, ADC2_CH9, CLK_OUT1, USB_D+", "maxVoltage": 3.3, "rtc": true },
            { "number": 20, "side": "right", "name": "19", "type": "IO", "analog": true, "description": "RTC_GPIO19, GPIO19, U1RTS, ADC2_CH8, CLK_OUT2, USB_D-", "maxVoltage": 3.3, "rtc": true },
            { "number": 21, "side": "right", "name": "GND", "type": "G", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false },
            { "number": 22, "side": "right", "name": "GND", "type": "G", "analog": false, "description": "Ground", "maxVoltage": 0, "rtc": false }
        ],
        "config": {
            "esphome-arduino":{
                "esphome":{
                    "platformio_options": {
                        "board_build.flash_mode": "dio",
                        "board_build.arduino.memory_type": "opi_opi",
                        "board_upload.maximum_ram_size": 524288,
                        "build_flags": [
                            "-DBOARD_HAS_PSRAM",
                            "-DARDUINO_USB_CDC_ON_BOOT=1",
                            "-mfix-esp32-psram-cache-issue"
                        ]
                    }
                },
                "esp32":{
                    "board": "esp32-s3-devkitc-1",
                    "variant": "esp32s3",
                    "flash_size": "16Mb",
                    "framework": {
                        "type": "arduino"
                    }
                }
            },
            "esphome-idf":{
                "esphome":{
                    "platformio_options": {
                        "board_build.flash_mode": "dio",
                        "board_build.arduino.memory_type": "opi_opi",
                        "board_upload.maximum_ram_size": 524288,
                        "build_flags": [
                            "-DBOARD_HAS_PSRAM",
                            "-DARDUINO_USB_CDC_ON_BOOT=1",
                            "-mfix-esp32-psram-cache-issue"
                        ]
                    }
                },
                "esp32":{
                    "board": "esp32-s3-devkitc-1",
                    "variant": "esp32s3",
                    "flash_size": "16Mb",
                    "framework": {
                        "type": "esp-idf"
                    }
                }
            },
            "esphome-yaml":{
                "esphome":{
                    "name": "esp32_s3_devkitc",
                    "platformio_options": {
                        "board_build.flash_mode": "dio",
                        "board_build.arduino.memory_type": "opi_opi",
                        "board_upload.maximum_ram_size": 524288,
                        "build_flags": [
                            "-DBOARD_HAS_PSRAM",
                            "-DARDUINO_USB_CDC_ON_BOOT=1",
                            "-mfix-esp32-psram-cache-issue"
                        ]
                    }
                },
                "esp32":{
                    "board": "esp32-s3-devkitc-1",
                    "variant": "esp32s3",
                    "flash_size": "16Mb",
                    "framework": {
                        "type": "arduino"
                    }
                }
            }
        }
    },
    // "Protofy ESP32 devBoard": {
    //     "id": "4",
    //     "name": "Protofy ESP32 devBoard",
    //     "core": "esp32",
    //     "ports": [
    //         { "number": 1, "side": "left", "name": "36", "type": "I", "analog": true, "description": "GPIO36, ADC1_CH0, S_VP", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 2, "side": "left", "name": "39", "type": "I", "analog": true, "description": "GPIO39, ADC1_CH3, S_VN", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 3, "side": "left", "name": "34", "type": "I", "analog": true, "description": "GPIO34, ADC1_CH6, VDET_1", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 4, "side": "left", "name": "35", "type": "I", "analog": true, "description": "GPIO35, ADC1_CH7, VDET_2", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 5, "side": "left", "name": "32", "type": "IO", "analog": true, "description": "GPIO32, ADC1_CH4, TOUCH_CH9, XTAL_32K_P", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 6, "side": "left", "name": "33", "type": "IO", "analog": true, "description": "GPIO33, ADC1_CH5, TOUCH_CH8, XTAL_32K_N", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 7, "side": "left", "name": "25", "type": "IO", "analog": true, "description": "GPIO25, ADC1_CH8, DAC_1", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 8, "side": "left", "name": "26", "type": "IO", "analog": true, "description": "GPIO26, ADC2_CH9, DAC_2", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 9, "side": "left", "name": "27", "type": "IO", "analog": true, "description": "GPIO27, ADC2_CH7, TOUCH_CH7", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 10, "side": "left", "name": "14", "type": "IO", "analog": true, "description": "GPIO14, ADC2_CH6, TOUCH_CH6, MTMS", "maxVoltage": 3.3, "rtc": true },
    //         { "number": 11, "side": "left", "name": "13", "type": "IO", "analog": true, "description": "GPIO13, ADC2_CH4, TOUCH_CH4, MTCK", "maxVoltage": 3.3, "rtc": true },

    //         { "number": 1, "side": "right", "name": "23", "type": "IO", "analog": false, "description": "GPIO23", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 2, "side": "right", "name": "22", "type": "IO", "analog": false, "description": "GPIO22", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 3, "side": "right", "name": "21", "type": "IO", "analog": false, "description": "GPIO21", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 4, "side": "right", "name": "TX", "type": "IO", "analog": false, "description": "GPIO1, U0TXD", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 5, "side": "right", "name": "RX", "type": "IO", "analog": false, "description": "GPIO3, U0RXD", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 6, "side": "right", "name": "19", "type": "IO", "analog": false, "description": "GPIO19", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 7, "side": "right", "name": "18", "type": "IO", "analog": false, "description": "GPIO18", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 8, "side": "right", "name": "17", "type": "IO", "analog": false, "description": "GPIO17", "maxVoltage": 3.3, "rtc": false },
    //         { "number": 9, "side": "right", "name": "16", "type": "IO", "analog": false, "description": "GPIO16", "maxVoltage": 3.3, "rtc": false }
    //     ],
    //     "config": {
    //         "esphome-arduino": {
    //             "esphome": {},
    //             "esp32": {
    //                 "board": "esp32dev",
    //                 "variant": "esp32",
    //                 "framework": {
    //                     "type": "arduino"
    //                 }
    //             }
    //         },
    //         "esphome-idf": {
    //             "esphome": {},
    //             "esp32": {
    //                 "board": "esp32dev",
    //                 "variant": "esp32",
    //                 "framework": {
    //                     "type": "esp-idf"
    //                 }
    //             }
    //         }
    //     }
    // },
    "Protofy ESP32S3 devBoard": {
        "id": "4",
        "name": "Protofy ESP32S3 devBoard",
        "core": "esp32s3",
        "icon": "/public/vento-square.png",
        "image": "/public/images/device/ProtofyESP32S3devBoard.png",
        "ports": [
            { "number": 1, "side": "left", "name": "44", "type": "IO", "analog": true, "description": "GPIO44, ADC1_CH0", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 195 }, "handleSide": "left"} },
            { "number": 2, "side": "left", "name": "43", "type": "IO", "analog": true, "description": "GPIO43, ADC1_CH1", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 244 }, "handleSide": "left"} },
            { "number": 3, "side": "left", "name": "5", "type": "IO", "analog": true, "description": "GPIO5, ADC1_CH2", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 341 }, "handleSide": "left"} },
            { "number": 4, "side": "left", "name": "4", "type": "IO", "analog": true, "description": "GPIO4, ADC1_CH3", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 390 }, "handleSide": "left"} },
            { "number": 5, "side": "left", "name": "6", "type": "IO", "analog": true, "description": "GPIO6, ADC1_CH4", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 1049 }, "handleSide": "left"} },
            { "number": 6, "side": "left", "name": "7", "type": "IO", "analog": true, "description": "GPIO7, ADC1_CH5", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 1177 }, "handleSide": "left"} },
            { "number": 7, "side": "left", "name": "15", "type": "IO", "analog": true, "description": "GPIO15, ADC2_CH0", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 1305 }, "handleSide": "left"} },
            { "number": 8, "side": "left", "name": "16", "type": "IO", "analog": true, "description": "GPIO16, ADC2_CH1", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 1433 }, "handleSide": "left"} },
            { "number": 9, "side": "left", "name": "17", "type": "IO", "analog": true, "description": "GPIO17, ADC2_CH2", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 1561 }, "handleSide": "left"} },
            { "number": 10, "side": "left", "name": "18", "type": "IO", "analog": true, "description": "GPIO18, ADC2_CH3", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 1689 }, "handleSide": "left"} },
            { "number": 11, "side": "left", "name": "8", "type": "IO", "analog": true, "description": "GPIO8, ADC2_CH4", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 1817 }, "handleSide": "left"} },

            { "number": 1, "side": "right", "name": "47", "type": "IO", "analog": true, "description": "GPIO47", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 195 }, "handleSide": "right"} },
            { "number": 2, "side": "right", "name": "21", "type": "IO", "analog": true, "description": "GPIO21", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 244 }, "handleSide": "right"} },
            { "number": 3, "side": "right", "name": "42", "type": "IO", "analog": true, "description": "GPIO42", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 341 }, "handleSide": "right"} },
            { "number": 4, "side": "right", "name": "48", "type": "IO", "analog": true, "description": "GPIO48", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 390 }, "handleSide": "right"} },
            { "number": 5, "side": "right", "name": "10", "type": "IO", "analog": true, "description": "GPIO10", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 1049 }, "handleSide": "right"} },
            { "number": 6, "side": "right", "name": "9", "type": "IO", "analog": true, "description": "GPIO9", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 1177 }, "handleSide": "right"} },
            { "number": 7, "side": "right", "name": "39", "type": "IO", "analog": true, "description": "GPIO39", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 1305 }, "handleSide": "right"} },
            { "number": 8, "side": "right", "name": "40", "type": "IO", "analog": true, "description": "GPIO40", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 1433 }, "handleSide": "right"} },
            { "number": 9, "side": "right", "name": "41", "type": "IO", "analog": true, "description": "GPIO41", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 1561 }, "handleSide": "right"} },
            { "number": 10, "side": "right", "name": "2", "type": "IO", "analog": true, "description": "GPIO2", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 1689 }, "handleSide": "right"} },
            { "number": 11, "side": "right", "name": "1", "type": "IO", "analog": true, "description": "GPIO1", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 1817 }, "handleSide": "right"} },

            { "number": 1, "side": "bottom", "name": "virtual1", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 100, "y": 2105 }, "handleSide": "bottom"} },
            { "number": 2, "side": "bottom", "name": "virtual2", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 200, "y": 2105 }, "handleSide": "bottom"} },
            { "number": 3, "side": "bottom", "name": "virtual3", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 300, "y": 2105 }, "handleSide": "bottom"} },
            { "number": 4, "side": "bottom", "name": "virtual4", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 400, "y": 2105 }, "handleSide": "bottom"} },
            { "number": 5, "side": "bottom", "name": "virtual5", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 500, "y": 2105 }, "handleSide": "bottom"} },
            { "number": 6, "side": "bottom", "name": "virtual6", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 600, "y": 2105 }, "handleSide": "bottom"} },
            { "number": 7, "side": "bottom", "name": "virtual7", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 700, "y": 2105 }, "handleSide": "bottom"} }
        ],
        "config": {
            "esphome-arduino":{
                "esphome":{
                    "platformio_options": {
                        "board_build.flash_mode": "dio",
                        "board_build.arduino.memory_type": "opi_opi",
                        "board_upload.maximum_ram_size": 524288,
                        "build_flags": [
                            "-DBOARD_HAS_PSRAM",
                            "-DARDUINO_USB_CDC_ON_BOOT=1",
                            "-mfix-esp32-psram-cache-issue"
                        ]
                    }
                },
                "esp32":{
                    "board": "esp32-s3-devkitc-1",
                    "variant": "esp32s3",
                    "flash_size": "16Mb",
                    "framework": {
                        "type": "arduino"
                    }
                }
            },
            "esphome-idf":{
                "esphome":{
                    "platformio_options": {
                        "board_build.flash_mode": "dio",
                        "board_build.arduino.memory_type": "opi_opi",
                        "board_upload.maximum_ram_size": 524288,
                        "build_flags": [
                            "-DBOARD_HAS_PSRAM",
                            "-DARDUINO_USB_CDC_ON_BOOT=1",
                            "-mfix-esp32-psram-cache-issue"
                        ]
                    }
                },
                "esp32":{
                    "board": "esp32-s3-devkitc-1",
                    "variant": "esp32s3",
                    "flash_size": "16Mb",
                    "framework": {
                        "type": "esp-idf"
                    }
                }
            },
            "esphome-yaml":{
                "esphome":{
                    "name": "protofy_esp32s3_devboard",
                    "platformio_options": {
                        "board_build.flash_mode": "dio",
                        "board_build.arduino.memory_type": "opi_opi",
                        "board_upload.maximum_ram_size": 524288,
                        "build_flags": [
                            "-DBOARD_HAS_PSRAM",
                            "-DARDUINO_USB_CDC_ON_BOOT=1",
                            "-mfix-esp32-psram-cache-issue"
                        ]
                    }
                },
                "esp32":{
                    "board": "esp32-s3-devkitc-1",
                    "variant": "esp32s3",
                    "flash_size": "16Mb",
                    "framework": {
                        "type": "esp-idf"
                    }
                }
            }
        }
    },
    "Protofy XIAO ESP32S3 devBoard": {
        "id": "5",
        "name": "Protofy XIAO ESP32S3 devBoard",
        "core": "esp32s3",
        "icon": "/public/vento-square.png",
        "image": "/public/images/device/ProtofyXIAOdevBoard.png",
        "ports": [
            { "number": 1, "side": "left", "name": "43", "type": "IO", "analog": true, "description": "GPIO43, ADC1_CH1", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 498 }, "handleSide": "left"} },
            { "number": 2, "side": "left", "name": "44", "type": "IO", "analog": true, "description": "GPIO44, ADC1_CH0", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 630 }, "handleSide": "left"} },
            { "number": 3, "side": "left", "name": "7", "type": "IO", "analog": true, "description": "GPIO7, ADC1_CH5", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 10, "y": 760 }, "handleSide": "left"} },

            { "number": 1, "side": "bottom", "name": "8", "type": "IO", "analog": true, "description": "GPIO8, ADC2_CH4", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 272, "y": 915 }, "handleSide": "bottom"} },
            { "number": 2, "side": "bottom", "name": "9", "type": "IO", "analog": true, "description": "GPIO9", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 405, "y": 915 }, "handleSide": "bottom"} },
            { "number": 3, "side": "bottom", "name": "1", "type": "IO", "analog": true, "description": "GPIO1", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 533, "y": 915 }, "handleSide": "bottom"} },

            { "number": 1, "side": "right", "name": "6", "type": "IO", "analog": true, "description": "GPIO6, ADC1_CH4", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 355 }, "handleSide": "right"} },
            { "number": 2, "side": "right", "name": "5", "type": "IO", "analog": true, "description": "GPIO5, ADC1_CH2", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 405 }, "handleSide": "right"} },
            { "number": 3, "side": "right", "name": "4", "type": "IO", "analog": true, "description": "GPIO4, ADC1_CH3", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 520 }, "handleSide": "right"} },
            { "number": 4, "side": "right", "name": "3", "type": "IO", "analog": true, "description": "RTC_GPIO3, GPIO3, TOUCH3, ADC1_CH2", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 649 }, "handleSide": "right"} },
            { "number": 5, "side": "right", "name": "2", "type": "IO", "analog": true, "description": "GPIO2", "maxVoltage": 3.3, "rtc": true, "nodeRendering": {"position": { "x": 765, "y": 778 }, "handleSide": "right"} },
            
            { "number": 1, "side": "bottom", "name": "virtual1", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 100, "y": 1100 }, "handleSide": "bottom"} },
            { "number": 2, "side": "bottom", "name": "virtual2", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 200, "y": 1100 }, "handleSide": "bottom"} },
            { "number": 3, "side": "bottom", "name": "virtual3", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 300, "y": 1100 }, "handleSide": "bottom"} },
            { "number": 4, "side": "bottom", "name": "virtual4", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 400, "y": 1100 }, "handleSide": "bottom"} },
            { "number": 5, "side": "bottom", "name": "virtual5", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 500, "y": 1100 }, "handleSide": "bottom"} },
            { "number": 6, "side": "bottom", "name": "virtual6", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 600, "y": 1100 }, "handleSide": "bottom"} },
            { "number": 7, "side": "bottom", "name": "virtual7", "type": "virtual", "analog": false, "description": "virtual port", "maxVoltage": 0, "rtc": false, "nodeRendering": {"position": { "x": 700, "y": 1100 }, "handleSide": "bottom"} }
        ],
        "config": {
            "esphome-arduino":{
                "esphome":{},
                "esp32":{
                    "board": "seeed_xiao_esp32s3",
                    "variant": "esp32s3",
                    "framework": { 
                        "type": "arduino",
                        "version": "latest",
                        "platform_version": "6.5.0"
                    }
                }
            },
            "esphome-idf":{
                "esphome":{},
                "esp32":{
                    "board": "seeed_xiao_esp32s3",
                    "variant": "esp32s3", 
                    "framework": { 
                        "type": "esp-idf"
                    }
                }
            },
            "esphome-yaml":{
                "esphome":{
                    "name": "protofy_xiao_esp32s3_devboard"
                },
                "esp32":{
                    "board": "seeed_xiao_esp32s3",
                    "variant": "esp32s3", 
                    "framework": { 
                        "type": "esp-idf"
                    }
                }
            }
        }
    }
}

export default AutoAPI({
    modelName: 'deviceboards',
    modelType: DeviceBoardModel,
    initialData,
    skipDatabaseIndexes: true,
    prefix: '/api/core/v1/'
})

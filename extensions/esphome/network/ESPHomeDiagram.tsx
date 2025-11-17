import React, { useEffect, useState } from 'react'
import { NetworkGraphView } from './NetworkGraphView'
import { parseYaml, dumpYaml } from './ESPHome2Network'
import { DeviceModel } from '@extensions/devices/models/DeviceModel'



export default function ESPHomeDiagram({ yaml }: { yaml: string }) {
  // 🔹 Definición estructurada del circuito
  // const schematic = {
  //     components: [
  //         {
  //             type: 'device',
  //             id: 'ESP32',
  //             label: 'ESP32-WROOM-32',
  //             center: true,
  //             pins: {
  //                 left: [
  //                     { name: '3V3', type: "power" },
  //                     { name: 'GND', type: "power" },
  //                     { name: 'EN', type: "power" },
  //                     { name: 'GPIO36', type: "gpio" },
  //                     { name: 'GPIO39', type: "gpio" },
  //                     { name: 'GPIO34', type: "gpio" },
  //                     { name: 'GPIO35', type: "gpio" },
  //                     { name: 'GPIO32', type: "gpio" },
  //                     { name: 'GPIO33', type: "gpio" },
  //                     { name: 'GPIO25', type: "gpio" },
  //                     { name: 'GPIO26', type: "gpio" },
  //                 ],
  //                 right: [
  //                     { name: 'GPIO27', type: "gpio" },
  //                     { name: 'GPIO14', type: "gpio" },
  //                     { name: 'GPIO12', type: "gpio" },
  //                     { name: 'GPIO13', type: "gpio" },
  //                     { name: 'GPIO23', type: "gpio" },
  //                     { name: 'GPIO22', type: "gpio" },
  //                     { name: 'GPIO1_TX', type: "gpio" },
  //                     { name: 'GPIO3_RX', type: "gpio" },
  //                     { name: 'GPIO21_SDA', type: "gpio" },
  //                     { name: 'GPIO22_SCL', type: "gpio" },
  //                 ],
  //             },
  //         },
  //         {
  //             id: 'Relay1',
  //             type: 'device',
  //             editableProps: {
  //                 alwaysOn: { type: 'boolean', label: 'Always On', description: 'If enabled, the relay reset state will be always on.', default: false },
  //             },
  //             label: 'Relay 1',
  //             pins: {
  //                 left: [{ name: 'control', description: 'Control pin to activate the relay', connectedTo: 'GPIO25', type: "input" }],
  //                 right: []
  //             },
  //         },
  //         {
  //             id: 'UART0',
  //             type: 'device',
  //             label: 'UART 0',
  //             editableProps: {
  //                 baud: { type: 'number', label: 'Baud Rate', description: 'Baud rate for UART communication', default: 115200 },
  //             },
  //             pins: {
  //                 left: [
  //                     { name: 'tx', description: 'tx pin of UART bus', connectedTo: 'GPIO3_RX', type: "input" },
  //                     { name: 'rx', description: 'rx pin of UART bus', connectedTo: 'GPIO1_TX', type: "input" },
  //                 ],
  //                 right: [
  //                     { name: 'uart_bus', description: 'UART bus', connectedTo: null, type: "output"},
  //                 ],
  //             },
  //         },
  //         {
  //             id: 'I2C-Bus',
  //             type: 'device',
  //             label: 'I2C Bus',
  //             pins: {
  //                 left: [
  //                     { name: 'SDA', description: 'SDA pin of I2C bus', connectedTo: 'GPIO21_SDA' },
  //                     { name: 'SCL', description: 'SCL pin of I2C bus', connectedTo: 'GPIO22_SCL' }
  //                 ],
  //                 right: [
  //                     { name: 'i2c_bus', description: 'I2C bus', connectedTo: null },
  //                 ],
  //             }
  //         },
  //         {
  //             id: 'ADXL',
  //             type: 'device',
  //             label: 'Accelerometer ADXL',
  //             pins: {
  //                 left: [
  //                     { name: 'i2c_bus', description: 'I2C bus', connectedTo: 'i2c_bus' }
  //                 ],
  //                 right: [
  //                 ],
  //             }
  //         },
  //         {
  //             id: 'DHT22',
  //             type: 'device',
  //             label: 'Temperature & Humidity DHT22',
  //             pins: {
  //                 left: [
  //                     { name: 'i2c_bus', description: 'I2C bus', connectedTo: 'i2c_bus' }
  //                 ],
  //                 right: [
  //                 ],
  //             }
  //         },
  //         {
  //             id: 'I2C-Bus2',
  //             type: 'device',
  //             label: 'I2C Bus 2',
  //             pins: {
  //                 left: [
  //                     { name: 'SDA', description: 'SDA pin of I2C bus', connectedTo: 'GPIO39' , type: "input"},
  //                     { name: 'SCL', description: 'SCL pin of I2C bus', connectedTo: 'GPIO36' , type: "input"}
  //                 ],
  //                 right: [
  //                     { name: 'i2c_bus2', description: 'I2C bus', connectedTo: null, type: "output"},
  //                 ],
  //             }
  //         },
  //         {
  //             id: 'ADXL2',
  //             type: 'device',
  //             label: 'Accelerometer ADXL2',
  //             pins: {
  //                 left: [
  //                     { name: 'i2c_bus', description: 'I2C bus', connectedTo: 'i2c_bus2' }
  //                 ],
  //                 right: [
  //                 ],
  //             }
  //         },
  //     ],

  //     // components: [
  //     //     { id: 'Relay1', type: 'relay', pin: 'GPIO25', label: 'Relay 35', alwaysOn: false },
  //     //     { id: 'Relay2', type: 'relay', pin: 'GPIO26', label: 'Relay 2', alwaysOn: true },
  //     //     { id: 'UART0', type: 'uart', pins: { tx: 'GPIO1_TX', rx: 'GPIO3_RX' }, label: 'UART Device' },
  //     //     { id: 'I2C-Bus', type: 'i2c', pins: { sda: 'GPIO21_SDA', scl: 'GPIO22_SCL' }, label: 'Bus I2C' },
  //     //     { id: 'Accel', type: 'sensor', parent: 'I2C-Bus', label: 'Accelerometer' },
  //     //     { id: 'Temp', type: 'sensor', parent: 'I2C-Bus', label: 'Temperature' },
  //     //     { id: 'WiFi', type: 'virtual', label: 'WiFi' },
  //     //     { id: 'MQTT', type: 'virtual', parent: 'WiFi', label: 'MQTT Broker' },
  //     // ],
  // }

  const yamlExample = `
esphome:
  name: noindex
esp32:
  board: esp32dev
  variant: esp32
  framework:
    type: arduino
logger: {}
switch:
  - platform: gpio
    pin: 25
    name: papupi
    id: papupi
    restore_mode: ALWAYS_ON
  - platform: gpio
    pin: 27
    name: papupi
    id: papupi
    restore_mode: ALWAYS_ON
wifi:
  ssid: SSID
  password: PASSWORD
  power_save_mode: none
i2c:
  id: bus 1
  sda: 4
  scl: 22
  scan: true
ads1115:
  address: '0x48'
  i2c_id: bus 1
  id: analog
    `

  const schematic = parseYaml(yaml)
  console.log("DEV:::: 🚀 ~ file: ElectricalSchematic.tsx:236 ~ ElectricalSchematic ~ schematic:", schematic)

  return schematic != undefined ? <NetworkGraphView schematic={schematic} /> : <div>No schematic available</div>
}
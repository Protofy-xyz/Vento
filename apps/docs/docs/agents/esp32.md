# ESP32 / ESPHome

Vento includes an integrated editor and flash system to connect ESP32-based devices to your network.

## Features

- **Visual YAML editor** - Define your device configuration visually
- **Code editor** - Write ESPHome YAML directly
- **USB flashing** - Flash firmware directly from the browser
- **OTA updates** - Update devices over WiFi
- **Real-time monitoring** - See sensor data as it comes in

## Getting Started

### Via Network View

1. Open Network view (click Vento logo)
2. Click **+ Add** → **ESP32 Device**
3. Enter a device name
4. Optionally select a device template
5. Configure your device using the visual editor or YAML
6. Flash the firmware via USB

### Device Configuration

You can configure your ESP32 in two ways:

#### Visual Editor

Use the visual interface to:
- Add sensors (temperature, humidity, motion, etc.)
- Add actuators (relays, LEDs, motors)
- Configure WiFi settings
- Set up MQTT connection to Vento

#### YAML Editor

Write ESPHome YAML directly:

```yaml
esphome:
  name: my_sensor
  platform: ESP32
  board: esp32dev

wifi:
  ssid: "YourWiFi"
  password: "YourPassword"

mqtt:
  broker: 192.168.1.100
  port: 1883

sensor:
  - platform: dht
    pin: GPIO4
    temperature:
      name: "Temperature"
    humidity:
      name: "Humidity"
    update_interval: 60s

switch:
  - platform: gpio
    pin: GPIO5
    name: "Relay"
```

## Device Templates

Vento includes pre-defined templates for common device configurations. Templates are stored in `data/deviceDefinitions/`.

To use a template:
1. Select it when creating a new device
2. The YAML is pre-populated with the template configuration
3. Customize as needed

## Flashing

### USB Flash

1. Connect ESP32 to your computer via USB
2. Click **Flash** in the device editor
3. Select the serial port
4. Wait for the flash to complete

### OTA (Over-the-Air)

After initial USB flash, you can update devices wirelessly:
1. Make changes to the YAML
2. Click **Flash OTA**
3. Device updates over WiFi

## Communication

Once flashed, devices communicate with Vento via MQTT:

- **Sensors** publish state updates
- **Actuators** receive commands
- Real-time data appears in the device's board

## Common Components

### Sensors

| Component | ESPHome Platform |
|-----------|------------------|
| Temperature/Humidity | `dht`, `bme280` |
| Motion | `pir`, `binary_sensor` |
| Light level | `bh1750` |
| Distance | `ultrasonic` |

### Actuators

| Component | ESPHome Platform |
|-----------|------------------|
| Relay | `gpio switch` |
| LED | `light`, `pwm` |
| Servo | `servo` |

## Troubleshooting

### Device Not Connecting

1. Check WiFi credentials in YAML
2. Verify MQTT broker address is correct
3. Ensure device is on same network as Vento

### Flash Failed

1. Check USB connection
2. Try a different USB cable
3. Hold BOOT button during flash on some boards
4. Check serial port permissions

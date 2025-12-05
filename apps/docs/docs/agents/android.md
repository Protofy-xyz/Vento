# Android Agent

Turn any Android phone into a powerful IoT device with the Vento mobile app.

## Features

- **Camera**: Take photos on demand, stream frames
- **Microphone**: Record audio, voice commands
- **Sensors**: Accelerometer, gyroscope, light sensor
- **Location**: GPS coordinates
- **Notifications**: Send alerts to phone
- **Text-to-Speech**: Make the phone speak
- **Haptics**: Vibration feedback
- **Screen**: Brightness control
- **Bluetooth**: BLE device scanning

## Installation

### From Network View

1. Open Network view → **+ Add** → **Android Device**
2. Scan QR code to download APK
3. Install APK on phone
4. Scan connection QR code to authenticate

### Manual

1. Build APK from `apps/clients/expo`
2. Install on device
3. Enter Vento URL manually

## Available Actions

| Action | Description |
|--------|-------------|
| `take_photo` | Capture camera photo |
| `record_audio` | Record audio clip |
| `speak` | Text-to-speech output |
| `send_notification` | Show notification |
| `vibrate` | Trigger vibration |
| `set_brightness` | Adjust screen brightness |

## Available Values

| Value | Description |
|-------|-------------|
| `location` | GPS coordinates |
| `battery` | Battery level |
| `accelerometer` | Motion sensor |
| `gyroscope` | Rotation sensor |
| `light` | Ambient light level |
| `network` | WiFi/cellular info |

## Use Cases

### Visual Inspection
AI agents can request photos for visual analysis:
```javascript
const photo = await board.execute_action({ name: 'take_photo' })
// Send to vision AI for analysis
```

### Voice Alerts
Speak alerts to field workers:
```javascript
await board.execute_action({
    name: 'speak',
    params: { message: 'Temperature alert in Zone A' }
})
```

### Location Tracking
Monitor field device locations:
```javascript
const loc = states.location
// { latitude: 40.7128, longitude: -74.0060 }
```


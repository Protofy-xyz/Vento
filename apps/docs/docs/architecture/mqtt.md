# MQTT Broker

Vento runs an Aedes MQTT broker for real-time communication between services and devices.

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| **1883** | TCP | Standard MQTT for local agents |
| **3003** | WebSocket | Browser clients via `/websocket` |

## Connecting

### Node.js Client

```typescript
import { getMQTTClient } from 'protonode'

const mqtt = getMQTTClient('myservice', getServiceToken())

// Subscribe to topic
mqtt.subscribe('devices/#')

// Handle messages
mqtt.on('message', (topic, message) => {
    const data = JSON.parse(message.toString())
    console.log(`Received on ${topic}:`, data)
})

// Publish message
mqtt.publish('my/topic', JSON.stringify({ hello: 'world' }))
```

### Browser Client

Use the WebSocket endpoint:

```javascript
const client = mqtt.connect('ws://localhost:3003/websocket')

client.on('connect', () => {
    client.subscribe('notifications/#')
})

client.on('message', (topic, message) => {
    console.log(topic, JSON.parse(message))
})
```

### In Extensions

Extensions receive `mqtt` and `topicSub` via context:

```typescript
export default async (app, context) => {
    const { mqtt, topicSub } = context
    
    // Subscribe with helper (handles JSON parsing)
    topicSub(mqtt, 'devices/#', (message, topic) => {
        console.log('Device message:', message)
    })
}
```

## Topic Conventions

### Notifications

```
notifications/{model}/{action}/{id}
```

Examples:
- `notifications/boards/create/my_agent`
- `notifications/devices/update/sensor1`
- `notifications/events/create/devices/online`

### Events

```
notifications/event/create/{path}
```

Examples:
- `notifications/event/create/devices/esp32/online`
- `notifications/event/create/orders/created`

### Devices

```
devices/{deviceId}/status
devices/{deviceId}/command
homeassistant/{type}/{id}/config  (ESPHome discovery)
```

## Wildcards

MQTT supports wildcards:

| Pattern | Matches |
|---------|---------|
| `devices/#` | All topics under `devices/` |
| `devices/+/status` | `devices/{any}/status` |
| `notifications/event/create/orders/#` | All order events |

## Authentication

MQTT authentication is **disabled by default**.

Enable with environment variable:
```bash
ENABLE_MQTT_AUTH=true yarn start
```

When enabled, clients must authenticate with valid JWT token.

## Quality of Service (QoS)

Vento uses QoS 0 (at most once) for most messages. This is suitable for:
- Real-time sensor data
- UI notifications
- Event broadcasts

For critical messages, consider implementing application-level acknowledgments.

## Using in Card Code

Cards don't have direct MQTT access. Use events instead:

```javascript
// Emit event (published to MQTT automatically)
await context.events.emitEvent(
    'my/custom/topic',
    'card',
    'system',
    { data: 'value' }
)

// Subscribe to events
context.events.onEvent(
    context.mqtt,
    context,
    (event) => console.log(event),
    'my/custom/#'
)
```

## Frontend Subscription

Use the `useSubscription` hook:

```tsx
import useSubscription from 'protolib/lib/mqtt/useSubscription'

function SensorDisplay() {
    const sub = useSubscription('devices/sensor1/status')
    
    useEffect(() => {
        if (!sub?.onMessage) return
        
        const unsub = sub.onMessage((message) => {
            console.log('Sensor update:', message)
        })
        
        return () => unsub?.()
    }, [sub?.onMessage])
    
    return <div>Listening...</div>
}
```

## Real-Time Lists

`useRemoteStateList` subscribes to MQTT for live updates:

```tsx
import { useRemoteStateList } from 'protolib/lib/useRemoteState'

const [items, setItems] = useRemoteStateList(
    initialData,
    fetchFn,
    'notifications/mymodel/#',  // MQTT topic
    MyModel,
    true,  // quickRefresh: patch locally
    false  // disableNotifications
)
```

When MQTT message arrives:
- `create`: Prepends new item to list
- `update`: Updates matching item
- `delete`: Removes item from list

## Troubleshooting

### Connection Refused
- Check port 1883/3003 is not in use
- Verify Vento is running

### Messages Not Received
- Check topic pattern matches
- Verify subscription is active
- Check for JSON parse errors

### Memory Issues
- Large message payloads can cause issues
- Consider message size limits
- Use debouncing for high-frequency updates


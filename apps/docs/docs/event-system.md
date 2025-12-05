---
sidebar_position: 6
---

# Event System

Vento includes a powerful event system that enables decoupled communication between components. Events flow through MQTT and allow boards, APIs, and UI components to react to changes without knowing about each other.

## Concepts

- **Path**: Hierarchical event type (e.g., `devices/esp32/online`)
- **From**: Source identifier (e.g., `core`, `api`, `device`)
- **User**: User who triggered the event
- **Payload**: Event-specific data
- **Ephemeral**: If `true`, event is not stored in database

## Event Schema

```typescript
{
    path: string,        // Hierarchical: 'devices/esp32/online'
    from: string,        // Source: 'core', 'api', etc.
    user: string,        // User ID or 'system'
    payload: object,     // Event-specific data
    ephemeral?: boolean, // If true, not stored in DB
    created: string      // ISO timestamp
}
```

## Backend Usage

### Emitting Events

```javascript
// In card code or automations
await context.events.emitEvent(
    'orders/created',           // path
    'api',                      // from
    'user123',                  // user
    { orderId: 'ORD-001' },    // payload
    false                       // ephemeral (store in DB)
)
```

### Subscribing to Events

```javascript
// In automations or extensions
context.events.onEvent(
    context.mqtt,               // MQTT client
    context,                    // Context object
    async (event) => {
        console.log('Order created:', event.payload)
    },
    'orders/#',                 // path pattern (# = wildcard)
    'api'                       // optional: filter by 'from'
)
```

### Get Last Event

```javascript
const lastEvent = await context.events.getLastEvent({
    path: 'devices/sensor1/reading',
    from: 'device',
    user: 'system'
})
```

## Frontend Usage

### useEventEffect

React to events with payload:

```tsx
import { useEventEffect } from '@extensions/events/hooks'

function OrderNotifications() {
    useEventEffect(
        (payload, fullEvent) => {
            console.log('New order:', payload)
            showNotification(`Order ${payload.orderId} created`)
        },
        { path: 'orders/created', from: 'api' },
        true  // also fetch initial/last event
    )
    
    return <div>Listening for orders...</div>
}
```

### useEvent

Get last event as state:

```tsx
import { useEvent } from '@extensions/events/hooks'

function TemperatureDisplay() {
    const lastEvent = useEvent(
        { path: 'sensors/temperature' },
        (msg) => console.log('Temperature:', msg.parsed.payload)
    )
    
    return <div>Temperature: {lastEvent?.parsed?.payload?.value}°C</div>
}
```

### useLastEvent

Simple last event value:

```tsx
import { useLastEvent } from '@extensions/events/hooks'

function DeviceStatus() {
    const event = useLastEvent({ path: 'devices/status' })
    
    return <div>Device: {event?.payload?.status}</div>
}
```

## Common Event Patterns

| Path Pattern | Description |
|--------------|-------------|
| `devices/{id}/online` | Device came online |
| `devices/{id}/offline` | Device went offline |
| `boards/{name}/updated` | Board was modified |
| `objects/{name}/create/#` | Object was created |
| `objects/{name}/update/#` | Object was updated |
| `objects/{name}/delete/#` | Object was deleted |
| `services/{name}/start` | Service started |

## MQTT Topics

Events are published to:
```
notifications/event/create/{path}
```

Subscribe with wildcards:
- `notifications/event/create/devices/#` - All device events
- `notifications/event/create/orders/+/created` - Order created events

## Using Events in Cards

```javascript
//@card/react
function Widget(card) {
    const [data, setData] = React.useState(null)
    
    useEventEffect(
        (payload) => setData(payload),
        { path: 'sensors/reading' },
        true
    )
    
    return (
        <Tinted>
            <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
                <YStack ai="center" jc="center">
                    <Text>Sensor: {data?.value ?? 'N/A'}</Text>
                </YStack>
            </ProtoThemeProvider>
        </Tinted>
    )
}
```

## Event API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/core/v1/events` | GET | List events (paginated) |
| `/api/core/v1/events` | POST | Create event |
| `/api/core/v1/events/{id}` | GET | Get specific event |

**Query Parameters:**
- `filter[path]` - Filter by path prefix
- `filter[from]` - Filter by source
- `filter[user]` - Filter by user


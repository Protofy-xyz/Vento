# Card Rendering

Cards can have custom HTML/React rendering via the `html` field. Vento supports two rendering modes.

## Rendering Modes

### React Mode (`//@card/react`)

Renders React components directly in the DOM. Best for simple components that need access to Vento's component library.

```javascript
//@card/react

function Widget(card) {
  const value = card.value;
  
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} ai="center" jc="center">
          <Icon name={card.icon} size={48} color={card.color}/>
          <CardValue value={value ?? "N/A"} />
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
```

### IFrame Mode (`//@card/reactframe`)

Renders in an isolated iframe. Better for complex components, external libraries, or when you need isolation.

```javascript
//@card/reactframe

function Widget(props) {
  // props contains card data
  // execute_action() is available for calling board actions
  
  return (
    <div>
      <h2>Current Value: {props.value}</h2>
      <button onClick={() => execute_action('my_action', { param: 'value' })}>
        Run Action
      </button>
    </div>
  );
}
```

## Available Components

Components are registered via `packages/app/bundles/sharedComponents.tsx`:

### Layout Components

| Component | Description |
|-----------|-------------|
| `XStack` | Horizontal flex container |
| `YStack` | Vertical flex container |
| `View` | Generic container |
| `Text` | Text element |
| `Paragraph` | Paragraph text |
| `Button` | Clickable button |
| `Input` | Text input field |
| `Spinner` | Loading indicator |

### Card Components

| Component | Description |
|-----------|-------------|
| `ActionCard` | Action card wrapper with run button |
| `CardValue` | Display card value (auto JSON tree) |
| `ParamsForm` | Form for action parameters |
| `Icon` | Lucide icon renderer |
| `Tinted` | Applies theme tinting |
| `ProtoThemeProvider` | Theme context wrapper |

### Data Components

| Component | Description |
|-----------|-------------|
| `StorageView` | Object storage CRUD view |
| `ViewList` | List view with items |
| `ViewObject` | Object detail view |
| `JSONView` | JSON tree viewer |
| `FileBrowser` | File browser UI |
| `ObjectViewLoader` | Load and display objects |

### Chart Components

| Component | Description |
|-----------|-------------|
| `PieChart` | Pie chart |
| `BarChart` | Bar chart |
| `LineChart` | Line chart |
| `AreaChart` | Area chart |
| `RadarChart` | Radar chart |
| `RadialBarChart` | Radial bar chart |

### Media Components

| Component | Description |
|-----------|-------------|
| `Markdown` | Markdown editor/viewer |
| `Html` | HTML renderer |
| `CameraPreview` | Camera feed preview |
| `CameraCard` | Camera card component |
| `CanvasDraw` | Drawing canvas |
| `InteractiveGrid` | Interactive grid layout |

### Utilities

| Component | Description |
|-----------|-------------|
| `API` | HTTP client (`API.get`, `API.post`) |
| `ProtoModel` | Data model class |
| `MqttWrapper` | MQTT subscription wrapper |
| `KeySetter` | API key setter |
| `KeyGate` | API key gate |
| `useEventEffect` | Event subscription hook |
| `useKeyState` | Key state hook |
| `InteractiveIcon` | Clickable icon |

## ViewLib Helpers

For HTML mode, helpers are available in `extensions/boards/viewLib.js`:

### Container Helpers

```javascript
// Create card container
card({ content: '...', style: '', padding: '10px' })

// Create icon
icon({ name: 'search', size: 48, color: 'var(--color7)' })
```

### Data Display

```javascript
// JSON tree viewer (collapsible)
jsonToDiv(data, indent, expandedDepth)

// Data table from array
cardTable(dataArray)

// Display value with auto-formatting
cardValue({ value: '...', style: '', id: null })
```

### Action Helpers

```javascript
// Action card with params form
cardAction({ data: card, content: '...' })

// Parameters form
paramsForm({ data: card })
```

### Media Helpers

```javascript
// YouTube embed
youtubeEmbed({ url: 'https://youtube.com/watch?v=...' })

// Image
boardImage({ src: '...', alt: '', style: '' })

// IFrame
iframe({ src: 'https://...' })
```

### State Access

```javascript
// Get all board states
getStates()  // Returns window.protoStates

// Get all board actions
getActions()  // Returns window.protoActions

// Get storage data
getStorage(modelName, key, defaultValue)
```

### React Helpers

```javascript
// Get card aspect ratio
getCardAspectRatio(cardId)

// Hook for responsive aspect ratio
useCardAspectRatio(cardId)

// Hook for hover state
const [active, handlers] = useActiveCard()

// Get auth token
getToken()
```

## Example: Chart Card

```javascript
//@card/react

function Widget(card) {
  const data = card.value || [
    { name: 'A', value: 400 },
    { name: 'B', value: 300 },
    { name: 'C', value: 200 }
  ];
  
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} p="$2">
          <PieChart 
            data={data} 
            width={200} 
            height={200}
          />
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
```

## Example: Interactive Button

```javascript
//@card/react

function Widget(card) {
  const [count, setCount] = React.useState(0);
  
  const handleClick = () => {
    setCount(c => c + 1);
    execute_action(card.name, { count: count + 1 });
  };
  
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} ai="center" jc="center">
          <Text fontSize={24}>Count: {count}</Text>
          <Button onPress={handleClick}>
            Increment
          </Button>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
```

## Example: Event Listener

```javascript
//@card/react

function Widget(card) {
  const [data, setData] = React.useState(null);
  
  useEventEffect(
    (payload) => setData(payload),
    { path: 'sensors/temperature' },
    true  // Get initial event
  );
  
  return (
    <Tinted>
      <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>
        <YStack f={1} ai="center" jc="center">
          <Icon name="thermometer" size={32} color={card.color} />
          <Text fontSize={36}>{data?.value ?? '--'}°C</Text>
        </YStack>
      </ProtoThemeProvider>
    </Tinted>
  );
}
```


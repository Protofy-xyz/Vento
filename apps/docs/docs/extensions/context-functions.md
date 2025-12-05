# Creating Context Functions

Context functions are the primary way to expose capabilities to card code.

## Pattern

All context functions follow this pattern:

```typescript
export const myFunction = async (options: {
    requiredParam: string,
    optionalParam?: number,
    done?: (result) => void,
    error?: (err) => void
}) => {
    const {
        requiredParam,
        optionalParam = 10,
        done = (r) => r,
        error = () => {}
    } = options
    
    try {
        // Implementation
        const result = await doSomething(requiredParam, optionalParam)
        done(result)
        return result
    } catch (err) {
        error(err)
        throw err
    }
}
```

## Why This Pattern?

1. **Named Parameters**: Clear what each argument does
2. **Optional Callbacks**: Support both async/await and callback styles
3. **Error Handling**: Consistent error propagation
4. **Default Values**: Sensible defaults for optional params

## Example: Weather Service

```typescript
// extensions/weather/coreContext/index.ts

export const getWeather = async (options: {
    city: string,
    units?: 'metric' | 'imperial',
    done?: (result) => void,
    error?: (err) => void
}) => {
    const {
        city,
        units = 'metric',
        done = (r) => r,
        error = () => {}
    } = options
    
    try {
        const response = await fetch(
            `https://api.weather.com/v1/current?city=${city}&units=${units}`
        )
        const data = await response.json()
        
        done(data)
        return data
    } catch (err) {
        error(err)
        throw err
    }
}

export default {
    getWeather
}
```

## Usage in Card Code

```javascript
// Async/await style
const weather = await context.weather.getWeather({
    city: 'Barcelona',
    units: 'metric'
})

// Callback style
context.weather.getWeather({
    city: 'Barcelona',
    done: (weather) => {
        console.log('Temperature:', weather.temp)
    },
    error: (err) => {
        console.error('Failed:', err)
    }
})
```

## Registration

Context functions are auto-registered via:

```typescript
// packages/app/bundles/coreContext.ts
import weather from '@extensions/weather/coreContext'

export default {
    // ... other extensions
    weather
}
```

## Best Practices

1. **Keep Functions Pure**: Avoid global state
2. **Handle Errors Gracefully**: Always call error callback
3. **Document Parameters**: Use TypeScript types
4. **Return Meaningful Results**: Not just success/fail


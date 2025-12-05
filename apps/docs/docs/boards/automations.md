# Automations & Scheduling

Create scheduled tasks and automated workflows that run independently of user interaction.

## Creating Automations

Automations are defined in `data/automations/` and expose custom API endpoints.

### Basic Automation

```javascript
// data/automations/myTask.ts
import { Protofy } from 'protobase'
import APIContext from 'app/bundles/context'

export default Protofy("code", async (app, context: typeof APIContext) => {
    await context.automations.automation({
        name: 'daily-report',
        app: app,
        description: 'Generate and send daily report',
        automationParams: {
            email: { description: 'Email to send report to' }
        },
        onRun: async (params, res, name) => {
            // Your automation logic here
            console.log('Running daily report for', params.email)
            // res.send() is available for manual response mode
        }
    })
})
```

## Automation Options

```typescript
context.automations.automation({
    name: string,                    // Unique identifier
    app: Express.Application,        // Express app instance
    
    // Response handling
    responseMode?: 'instant' | 'wait' | 'manual',
    // - 'instant': Returns immediately, task runs in background
    // - 'wait': Waits for task completion (default)
    // - 'manual': You control the response via res.send()
    
    // Parameters
    automationParams?: Record<string, { description: string }>,
    cardConfigParams?: Record<string, CardConfigParam>,
    
    // Metadata
    displayName?: string,
    description?: string,
    tags?: string[],
    sourceFile?: string,
    
    // Callbacks
    onRun: (params, res, name) => Promise<void>,
    onError?: (err) => void
})
```

## What Gets Created

When you call `automation()`, it automatically:

1. **Registers in automations API** at `/api/core/v1/automations`
2. **Creates action endpoint** at `/api/v1/automations/{name}`
3. **Registers action** for board use
4. **Creates card template** for AI agents

## Scheduling

### One-Time Schedule

Schedule a task to run at a specific date/time:

```javascript
context.automations.createSchedule(
    '14:30',           // time (HH:mm)
    async () => {
        // Task logic
        console.log('Running scheduled task')
    },
    15,                // day of month
    'march',           // month
    2025               // year
)
```

### Periodic Schedule (Cron-like)

Schedule recurring tasks:

```javascript
context.automations.createPeriodicSchedule(
    8,                 // hour (0-23)
    30,                // minute (0-59)
    async () => {
        // Task logic
        await generateReport()
    },
    'monday,wednesday,friday'  // days
)
```

### Advanced Scheduling

For more control, use `scheduleJob`:

```javascript
const job = context.automations.scheduleJob({
    name: 'backup-job',           // For logging
    hours: 2,                     // 2 AM
    minutes: 0,
    days: 'sunday',               // Every Sunday
    
    // Or use raw cron expression
    croneTime: '0 0 2 * * 0',    // Alternative to hours/minutes/days
    
    callback: async () => {
        await performBackup()
    },
    
    autoStart: true,              // Start immediately
    runOnInit: false              // Don't run on creation
})

// Control the job
job.stop()   // Pause
job.start()  // Resume
```

### Day Names

Supported day names (case-insensitive):
- monday, tuesday, wednesday, thursday, friday, saturday, sunday

Combine multiple: `'monday,wednesday,friday'`

## Cron Expression Format

```
┌────────────── second (0-59)
│ ┌──────────── minute (0-59)
│ │ ┌────────── hour (0-23)
│ │ │ ┌──────── day of month (1-31)
│ │ │ │ ┌────── month (1-12)
│ │ │ │ │ ┌──── day of week (0-7, 0 or 7 is Sunday)
│ │ │ │ │ │
* * * * * *
```

Examples:
- `0 30 8 * * 1,3,5` - 8:30 AM on Mon, Wed, Fri
- `0 0 2 * * 0` - 2:00 AM every Sunday
- `0 */15 * * * *` - Every 15 minutes

## Error Handling

```javascript
const job = context.automations.scheduleJob({
    name: 'critical-task',
    hours: 0,
    minutes: 0,
    days: 'sunday',
    callback: async () => {
        try {
            await riskyOperation()
        } catch (err) {
            // Log error - job continues running
            logger.error('Task failed:', err)
            // Optionally notify
            await sendAlert(err.message)
        }
    }
})
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/core/v1/automations` | GET | List automations |
| `/api/core/v1/automations` | POST | Register automation |
| `/api/v1/automations/{name}` | GET | Execute automation |


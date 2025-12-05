# DataView Component

DataView is a React component that renders complete CRUD interfaces with automatic real-time updates.

## Basic Usage

```tsx
import { DataView } from 'protolib/components/DataView'
import { ProductsModel } from '@/objects/products'

function ProductsPage() {
    return (
        <DataView
            model={ProductsModel}
            sourceUrl="/api/v1/products"
            name="products"
        />
    )
}
```

## Features

- **Auto-refresh**: Subscribes to MQTT notifications and updates in real-time
- **Multiple Views**: List, Grid, Raw JSON, Map (for geo data)
- **Pagination**: Built-in with page navigation
- **Search**: Full-text and AI-powered search
- **Filters**: Custom filter components
- **CRUD Dialogs**: Add/Edit forms generated from schema
- **Selection**: Multi-select for bulk operations

## Props

```typescript
interface DataViewProps {
    // Required
    model: any;              // ProtoModel class
    sourceUrl: string;       // AutoAPI endpoint URL
    name: string;            // Display name
    
    // Optional: View configuration
    defaultView?: 'list' | 'grid' | 'raw' | 'map';
    disableViewSelector?: boolean;
    
    // Optional: Feature toggles
    hideAdd?: boolean;
    hideSearch?: boolean;
    hideFilters?: boolean;
    hidePagination?: boolean;
    disableNotifications?: boolean;
    
    // Optional: Callbacks
    onSelectItem?: (item: any) => void;
    onEdit?: (data: any) => any;
    onDelete?: (data: any) => any;
    onAdd?: (data: any) => any;
    
    // Optional: Customization
    itemData?: any;
    rowIcon?: any;
    extraFields?: Record<string, { component: (item) => ReactNode }>;
}
```

## Real-Time Updates

DataView uses `useRemoteStateList` to subscribe to MQTT:

```typescript
// Internally, DataView subscribes to:
const topic = model.getNotificationsTopic()
// e.g., 'notifications/products/#'

// When MQTT message arrives:
// - create: Prepends new item
// - update: Updates matching item  
// - delete: Removes item
```

## Custom Fields

Add custom columns:

```tsx
<DataView
    model={ProductsModel}
    sourceUrl="/api/v1/products"
    name="products"
    extraFields={{
        profit: {
            component: (item) => (
                <Text color="green">
                    ${(item.price - item.cost).toFixed(2)}
                </Text>
            )
        }
    }}
/>
```

## Disabling Real-Time

For performance or specific use cases:

```tsx
<DataView
    model={ProductsModel}
    sourceUrl="/api/v1/products"
    name="products"
    disableNotifications={true}
/>
```

## Search Modes

### Standard Search

Searches indexed fields:

```tsx
// User types "phone" in search box
// Request: GET /api/v1/products?search=phone
```

### AI Search

Enable AI-powered natural language search:

```tsx
// Request: GET /api/v1/products?search=products%20under%20$100&mode=ai
```

## View Types

### List View (Default)

Table with sortable columns:
- Click column headers to sort
- Row actions on hover

### Grid View

Card-based layout:
- Better for visual items
- Configurable card size

### Raw View

JSON editor:
- View/edit raw data
- Good for debugging

### Map View

Geographic visualization:
- Requires `location` field with coordinates
- Clustered markers

## Integration with AutoAPI

DataView is designed to work with AutoAPI endpoints:

```typescript
// AutoAPI creates:
// - GET /api/v1/products (list, paginated)
// - POST /api/v1/products (create)
// - GET /api/v1/products/:id (read)
// - POST /api/v1/products/:id (update)
// - GET /api/v1/products/:id/delete (delete)

// DataView uses these automatically based on model
```

## Pagination

```tsx
<DataView
    model={ProductsModel}
    sourceUrl="/api/v1/products"
    name="products"
    // Pagination controlled by AutoAPI
    // Default: 25 items per page
/>
```

Query params:
- `page`: Page number (0-indexed)
- `itemsPerPage`: Items per page
- `orderBy`: Sort field
- `orderDirection`: `asc` or `desc`

## Form Generation

Add/Edit forms are generated from model schema:

```typescript
// Schema fields become form inputs
const schema = Schema.object({
    name: z.string(),           // → Text input
    price: z.number(),          // → Number input
    active: z.boolean(),        // → Checkbox
    category: z.enum([...]),    // → Select dropdown
    tags: z.array(z.string()),  // → Tag input
})
```

### Field Modifiers

| Modifier | Effect on Form |
|----------|----------------|
| `.hidden()` | Field not shown |
| `.static()` | Read-only after create |
| `.secret()` | Password input |
| `.textArea()` | Multi-line text |
| `.datePicker()` | Date picker |
| `.color()` | Color picker |
| `.file()` | File upload |


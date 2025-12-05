# Data Objects Overview

Vento provides a powerful object system that automatically generates CRUD APIs from schema definitions and creates matching admin panel interfaces.

## What You Get

When you create a data object, Vento automatically generates:

| Component | Description |
|-----------|-------------|
| **Schema** | TypeScript file with Zod validation |
| **REST API** | Full CRUD at `/api/v1/{name}` |
| **Action Endpoints** | At `/api/v1/actions/{name}/*` |
| **Admin UI** | DataView CRUD interface |
| **Board** | Cards for AI agent interaction |
| **MQTT Events** | Real-time notifications on changes |

## Creating Objects

### Via Admin UI (Recommended)

1. Go to `/workspace/objects`
2. Click **+ Add**
3. Enter object name
4. Define fields using the visual editor
5. Click **Create Object**

### Via Network "+ Add" Menu

1. Open Network view
2. Click **+ Add** → **Data Object**
3. Follow the wizard

## Example: Products Object

Create a `products` object with fields:
- `sku` (string, id, search)
- `name` (string, search)
- `price` (number)
- `category` (string, search)
- `stock` (number)

**Result:**

```
data/objects/products.ts          → Schema definition
data/automations/products.ts      → AutoAPI endpoints
data/boards/products_object/      → CRUD cards
/api/v1/products                  → REST API
/workspace/objects/view?object=productsModel → Admin UI
```

## Field Types

| Type | Description |
|------|-------------|
| `string` | Text field |
| `number` | Numeric field |
| `boolean` | True/false |
| `array` | List of items |
| `object` | Nested object |
| `record` | Key-value map |
| `date` | Date picker |
| `relation` | Link to another object |

## Field Modifiers

| Modifier | Description |
|----------|-------------|
| `id` | Primary key |
| `search` | Enable full-text search |
| `optional` | Not required |
| `indexed` | Database index |
| `static` | Cannot change after creation |
| `hidden` | Not shown in UI |
| `secret` | Masked in UI |
| `generate` | Auto-generate on create |

## Storage Options

When creating an object, choose storage:

- **Default Provider** - SQLite database (default)
- **Google Sheets** - Store in a Google Spreadsheet
- **JSON File** - Store as local JSON file

## Using Objects

### REST API

```bash
# List items
GET /api/v1/products?page=0&itemsPerPage=25&search=phone

# Create item
POST /api/v1/products
{ "sku": "PHONE-001", "name": "iPhone", "price": 999 }

# Read item
GET /api/v1/products/PHONE-001

# Update item
POST /api/v1/products/PHONE-001
{ "price": 899 }

# Delete item
GET /api/v1/products/PHONE-001/delete
```

### In Card Code

```javascript
// Create
return execute_action("/api/v1/actions/products/create", {
    sku: "NEW-001",
    name: "New Product",
    price: 50
})

// Read
return execute_action("/api/v1/actions/products/read", {
    id: "NEW-001"
})

// List with search
return execute_action("/api/v1/actions/products/list", {
    search: "phone",
    itemsPerPage: 10
})
```

### Frontend DataView

```tsx
import { DataView } from 'protolib/components/DataView'
import { productsModel } from '@/objects/products'

<DataView
    model={productsModel}
    sourceUrl="/api/v1/products"
    name="products"
/>
```


# AutoAPI

AutoAPI automatically generates REST endpoints from Zod schemas.

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Zod Schema    │────▶│    AutoAPI      │────▶│  REST Endpoints │
│  (ProtoModel)   │     │  (generateApi)  │     │   /api/v1/...   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │ MQTT
                        │    DataView     │◀─────────────┤ notifications
                        │   (Frontend)    │              │
                        └─────────────────┘              │
```

## Generated Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/{model}` | GET | List items (paginated) |
| `/api/v1/{model}` | POST | Create item |
| `/api/v1/{model}/:id` | GET | Read item |
| `/api/v1/{model}/:id` | POST | Update item |
| `/api/v1/{model}/:id/delete` | GET | Delete item |

## Query Parameters

For list endpoint:

| Parameter | Description |
|-----------|-------------|
| `page` | Page number (0-indexed) |
| `itemsPerPage` | Items per page |
| `search` | Full-text search query |
| `orderBy` | Field to sort by |
| `orderDirection` | `asc` or `desc` |
| `filter[field]` | Filter by field value |
| `all=true` | Return all items |

## AutoAPI Options

```typescript
AutoAPI({
    modelName: 'products',
    modelType: ProductsModel,
    prefix: '/api/v1/',
    
    // Operations to enable
    operations: ['create', 'read', 'update', 'delete', 'list'],
    
    // Require admin for specific operations
    requiresAdmin: ['delete'],
    
    // Pagination
    itemsPerPage: 25,
    defaultOrderBy: 'created',
    defaultOrderDirection: 'desc',
    
    // Lifecycle hooks
    onBeforeCreate: async (data, session, req) => data,
    onAfterCreate: async (data, session, req) => data,
    onBeforeUpdate: async (data, session, req) => data,
    onAfterUpdate: async (data, session, req) => data,
    onBeforeDelete: async (data, session, req) => data,
    onAfterDelete: async (data, session, req) => data,
    
    // Events
    disableEvents: false,
    ephemeralEvents: false,
})
```

## MQTT Notifications

AutoAPI publishes MQTT messages on CRUD operations:

```
notifications/{modelName}/create/{id}
notifications/{modelName}/update/{id}
notifications/{modelName}/delete/{id}
```

## Manual Schema Definition

For custom logic, create schemas manually:

```typescript
// data/objects/products.ts
import { Protofy, Schema, BaseSchema, ProtoModel, z } from 'protobase'

Protofy("features", {
    "AutoAPI": true,
    "adminPage": "/objects/view?object=productsModel"
})

export const BaseProductsSchema = Schema.object(Protofy("schema", {
    sku: z.string().id().search(),
    name: z.string().search(),
    price: z.number(),
    category: z.string().search().groupIndex("category"),
    stock: z.number().indexed(),
    active: z.boolean().generate(() => true)
}))

export class ProductsModel extends ProtoModel<ProductsModel> {
    constructor(data, session) {
        super(data, ProductsSchema, session, "products");
    }

    public static getApiOptions() {
        return Protofy("api", {
            "name": "products",
            "prefix": "/api/v1/"
        })
    }
}
```


# Core API

The Core API provides endpoints for managing boards, events, and system operations.

**Base URL:** `/api/core/v1/`

## Authentication

Most endpoints require authentication via:
- Cookie: `session` token
- Query param: `?token=...`

## Boards

### List Boards
```http
GET /api/core/v1/boards
```

### Get Board
```http
GET /api/core/v1/boards/{name}
```

### Create Board
```http
POST /api/core/v1/boards
Content-Type: application/json

{
  "name": "my_agent",
  "template": "smart ai agent"
}
```

### Update Board
```http
POST /api/core/v1/boards/{name}
Content-Type: application/json

{
  "cards": [...],
  "rules": [...]
}
```

### Delete Board
```http
GET /api/core/v1/boards/{name}/delete
```

### Execute Action
```http
POST /api/core/v1/boards/{name}/actions/{action}
Content-Type: application/json

{
  "param1": "value1"
}
```

### Get Card Value
```http
GET /api/core/v1/boards/{name}/cards/{card}
```

## Events

### List Events
```http
GET /api/core/v1/events?page=0&itemsPerPage=25
```

**Query Parameters:**
- `filter[path]` - Filter by path
- `filter[from]` - Filter by source
- `filter[user]` - Filter by user
- `orderBy` - Sort field
- `orderDirection` - `asc` or `desc`

### Create Event
```http
POST /api/core/v1/events
Content-Type: application/json

{
  "path": "my/event/path",
  "from": "api",
  "user": "system",
  "payload": { "key": "value" },
  "ephemeral": false
}
```

### Get Event
```http
GET /api/core/v1/events/{id}
```

## Keys

### List Keys
```http
GET /api/core/v1/keys
```

### Get Key
```http
GET /api/core/v1/keys/{name}
```

### Set Key
```http
POST /api/core/v1/keys
Content-Type: application/json

{
  "name": "MY_API_KEY",
  "value": "secret-value"
}
```

## System

### Health Check
```http
GET /api/core/v1/health
```

### Service Status
```http
GET /api/core/v1/services
```


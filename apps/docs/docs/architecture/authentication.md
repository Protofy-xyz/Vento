# Authentication

Vento uses JWT (JSON Web Tokens) for authentication across all services.

## Token Types

| Type | Purpose | Created By |
|------|---------|------------|
| **User Token** | Authenticate logged-in users | Login flow |
| **Service Token** | Internal service-to-service calls | `getServiceToken()` |
| **Device Token** | Device authentication | Device registration |

## Session Structure

```typescript
type SessionDataType = {
    user: {
        admin: boolean,        // Has admin privileges
        id: string,            // User ID or 'guest'
        type: 'user' | 'guest' | 'device' | 'system',
        permissions: string[]  // Permission list
    },
    token: string,             // JWT token
    loggedIn: boolean          // Is authenticated
}
```

## Token Generation

Tokens are generated using JWT:

```typescript
import jwt from 'jsonwebtoken'

// Generate token (requires TOKEN_SECRET env var)
const token = jwt.sign(
    { id: userId, admin: true, type: 'user' },
    process.env.TOKEN_SECRET,
    { expiresIn: '3600000s' }
)

// Verify token
const decoded = jwt.verify(token, process.env.TOKEN_SECRET)
```

## Service Token

For internal API calls, use `getServiceToken()`:

```typescript
import { getServiceToken } from 'protonode'

// System-level token with admin privileges
const token = getServiceToken()
// Returns: jwt.sign({id:'system', type:'system', admin:true}, TOKEN_SECRET)

// Use in API calls
const result = await API.get(`/api/core/v1/boards?token=${token}`)
```

## API Handler

The `handler` function extracts session from requests:

```typescript
import { handler } from 'protonode'

app.get('/my-endpoint', handler(async (req, res, session, next) => {
    // session is automatically extracted from:
    // 1. query param: ?token=...
    // 2. cookie: session

    if (!session.loggedIn) {
        res.status(401).send({ error: 'Not authenticated' })
        return
    }

    if (!session.user.admin) {
        res.status(403).send({ error: 'Admin required' })
        return
    }

    // Proceed with request
    res.json({ data: 'success' })
}))
```

### requireAdmin Middleware

```typescript
import { requireAdmin } from 'protonode'

// Protect admin-only routes
app.get('/admin/settings', requireAdmin(), handler(async (req, res, session) => {
    // Only admins reach here
}))
```

## Authentication Flow

### 1. Login

```http
POST /api/core/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "admin", "admin": true }
}
```

### 2. Use Token

Include token in subsequent requests:

```http
GET /api/core/v1/boards?token=eyJhbGciOiJIUzI1NiIs...
```

Or set cookie:
```javascript
document.cookie = `session=${JSON.stringify({ token: 'eyJ...' })}`
```

### 3. Verify

Token is verified on each request via `handler()`.

## Password Hashing

Passwords are hashed using bcrypt:

```typescript
import bcrypt from 'bcryptjs'

// Hash password
const hash = await bcrypt.hash(password, 10)

// Verify password
const match = await bcrypt.compare(password, hash)
```

## Common Gotchas

1. **Missing TOKEN_SECRET**: Tokens fail to verify if not set
2. **Token in query vs cookie**: Query param takes precedence
3. **Guest session**: Unauthenticated users get `{ id: 'guest', type: 'guest' }`
4. **Token expiry**: Default is very long (3600000s), consider shorter for production

## Frontend Session Hook

```tsx
import { useSession } from 'protolib/lib/useSession'

function MyComponent() {
    const [session, setSession] = useSession()
    
    if (!session.loggedIn) {
        return <LoginForm />
    }
    
    return <div>Welcome, {session.user.id}!</div>
}
```


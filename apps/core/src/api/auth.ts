import { handler, checkPassword, hash, genToken, getApp, getSessionContext, getServiceToken } from 'protonode'
import { connectDB, getDB } from 'app/bundles/storageProviders';
import moment from 'moment';
import { getLogger, API, UserModel, LoginSchema, RegisterSchema, LoginRequest, RegisterRequest, verifyToken } from 'protobase';
import { SiteConfig } from 'app/conf'
import { getDBOptions } from 'protonode';
const { createExpressProxy } = require('app/proxy.js')
const logger = getLogger()

const app = getApp((app) => app.use(createExpressProxy('core')))

logger.debug(`API Module loaded: ${__filename.split('.')[0]}`);

const dbPath = 'auth'
const groupDBPath = 'auth_groups'

connectDB(dbPath, {}, getDBOptions(UserModel)) //preconnect database

const generateEvent = async (event, token = '') => {
    try {
        await API.post('/api/core/v1/events?token=' + token, event, undefined, true)
    } catch (e) {
        //console.error("Failed to send event: ", e)
    }
}

const genNewSession = (data: any) => {
    return {
        user: data,
        token: genToken(data)
    }
}
async function usersExist(db?: any): Promise<boolean> {
    const _db = db ?? getDB(dbPath)

    if (typeof _db.list === 'function') {
        try {
            const out = await _db.list({ prefix: '', limit: 1 })
            const arr =
                (Array.isArray(out) ? out :
                    Array.isArray(out?.keys) ? out.keys :
                        Array.isArray(out?.items) ? out.items :
                            [])
            return arr.length > 0
        } catch { }
    }

    if (typeof _db.keys === 'function') {
        try {
            const out = await _db.keys({ limit: 1 })
            return Array.isArray(out) ? out.length > 0 : !!out?.length
        } catch { }
    }

    if (typeof _db.scan === 'function') {
        try {
            const out = await _db.scan({ limit: 1 })
            return Array.isArray(out) ? out.length > 0 : !!out
        } catch { }
    }
    if (typeof _db.iterator === 'function') {
        try {
            const it = _db.iterator({ limit: 1 })
            if (typeof it?.next === 'function') {
                const n = await it.next()
                return !!n && n.done === false
            }
        } catch { }
    }
    return true
}
app.post('/api/core/v1/auth/login', handler(async (req: any, res: any) => {
    const request: LoginRequest = req.body
    const fail = (msg) => {
        res.status(401).send('"' + msg + '"')
        generateEvent({
            path: 'auth/login/error',
            from: 'core',
            user: 'system',
            payload: { reason: msg, username: request.username, clientIp: req.get('X-Client-IP') || req.headers['x-client-ip'] } // event payload, event-specific data
        }, getServiceToken())
    }
    try {
        LoginSchema.parse(request)
        
        // Check if password is a service token (type: 'system') - allows login as any user without DB check
        try {
            const decoded = verifyToken(request.password)
            if (decoded && decoded.type === 'system') {
                // Service token: create session directly for requested user
                const newSession = {
                    id: request.username,
                    type: 'admin',
                    admin: true,
                    permissions: ['*', 'admin']
                }
                logger.info({ user: request.username }, "Login with service token (impersonation)")
                res.send({
                    session: genNewSession(newSession),
                    context: await getSessionContext('admin')
                })
                generateEvent({
                    path: 'auth/login/success',
                    from: 'core',
                    user: request.username,
                    payload: { clientIp: req.get('X-Client-IP') || req.headers['x-client-ip'], serviceToken: true }
                }, getServiceToken())
                return
            }
        } catch (e) {
            // Not a valid token, continue with normal flow
        }

        // Normal login flow - user must exist
        const db = getDB(dbPath, req)
        if (!await db.exists(request.username)) {
            return fail('Incorrect user or password')
        }

        const storedUser = JSON.parse(await db.get(request.username))
        let skipLogin = false;
        
        // Check if password is a user token (only for own account)
        try {
            const decoded = verifyToken(request.password)
            if (decoded && decoded.id === storedUser.username) {
                skipLogin = true;
                logger.info({ user: storedUser.username }, "Login with token successful")
            }
        } catch (e) {
            // Not a valid token
        }

        //check if the password is a token, if so, accept it directly to get a new session
        if (skipLogin === true || await checkPassword(request.password, storedUser.password)) {
            //update lastLogin
            await db.put(storedUser.username, JSON.stringify({ ...storedUser, lastLogin: moment().toISOString() }))
            let group
            try {
                group = JSON.parse(await getDB(groupDBPath).get(storedUser.type))
            } catch (e) {
                logger.error({ error: e, user: request.username, group: storedUser.type }, "Error reading group for user")
                throw "Error reading group for user: " + request.username
            }
            const newSession = {
                id: storedUser.username,
                type: storedUser.type,
                admin: group.admin ? true : false,
                permissions: [...(group.admin ? ["*"] : []), storedUser.type, ...(group.permissions ?? []), ...(storedUser.permissions ?? [])]
            }
            res.send({
                session: genNewSession(newSession),
                context: await getSessionContext(storedUser.type)
            })
            generateEvent({
                path: 'auth/login/success', //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
                from: 'core', // system entity where the event was generated (next, api, cmd...)
                user: request.username, // the original user that generates the action, 'system' if the event originated in the system itself
                payload: { clientIp: req.get('X-Client-IP') || req.headers['x-client-ip'] } // event payload, event-specific data
            }, getServiceToken())
            logger.info({ newSession }, "Session created: " + request.username)
            return
        } else {
            return fail('Incorrect user or password')
        }
    } catch (error) {
        if (error.name == 'ZodError') {
            return fail('Incorrect user or password')
        } else {
            res.status(500).send('"Server error"')
        }

        logger.error({ error }, "Login error")
        return
    }
}));

app.get('/api/core/v1/auth/validate', handler(async (req: any, res: any, session) => {
    res.send(session)
}));

app.post('/api/core/v1/auth/register', handler(async (req: any, res: any) => {
    if (!SiteConfig.signupEnabled) {
        res.status(403).send('Signup is disabled');
        return
    }
    const request: RegisterRequest = req.body
    const defaultGroup = "user"
    RegisterSchema.parse(request)
    const db = getDB(dbPath, req)
    if (await db.exists(request.username)) {
        res.status(500).send({ fieldErrors: { 'username': 'A user with the same email already exists' } });
    } else {
        const { rePassword, password, ...newUserData } = request
        const newUser = {
            ...newUserData,
            from: 'signup',
            password: await hash(password)
        }
        const entityModel = UserModel.load(newUser).create()
        const userData = JSON.stringify({ ...entityModel.getData(), password: await hash(password) })

        await db.put(request.username, userData)

        let group = {
            admin: false,
            permissions: [],
            type: defaultGroup
        };
        try {
            group = JSON.parse(await getDB(groupDBPath).get('user'))
        } catch (error) {
            logger.error({ error }, "Register error: Cannot find group for registered user. Assuming is not admin.")
        }

        generateEvent({
            path: 'auth/register/user', //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
            from: 'core', // system entity where the event was generated (next, api, cmd...)
            user: request.username, // the original user that generates the action, 'system' if the event originated in the system itself
        }, getServiceToken())
        logger.info({ newUserData }, "User created: " + newUserData.username)


        const newSession = {
            id: request.username,
            type: defaultGroup,
            admin: group.admin ? true : false,
            permissions: [...(group.admin ? ["*"] : []), defaultGroup, ...(group.permissions ?? [])],
        }
        res.send({
            session: genNewSession(newSession),
            context: await getSessionContext('user')
        })
        logger.info({ newSession }, "Session created: " + request.username)
    }
}));

app.get('/api/core/v1/users/has', handler(async (req: any, res: any) => {
    const db = getDB(dbPath, req)
    const has = await usersExist(db)
    res.send({ hasUsers: has })
}))


export default 'auth'
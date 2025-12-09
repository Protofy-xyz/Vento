import { atom, useAtom } from 'jotai'
import { atomWithStorage, createJSONStorage, useHydrateAtoms } from 'jotai/utils'
import { createSession } from "protobase"
const initialContext = { state: "pending", group: { workspaces: [] } }
export const SessionContext = atom(initialContext)
export const UserSettingsAtom = atomWithStorage("userSettings", {} as any)
import { API } from 'protobase'
import { useEffect } from 'react'

let isValidatingSession = false
let lastValidatedToken: string | null = null

const ABSOLUTE_DAYS = 60 //absolute limit since first login
const SLIDING_DAYS = 14 //maximum sliding window

const readCookie = (name: string) => {
    if (typeof document === 'undefined') return null
    const match = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(name + '='))
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

const cookieJSONStorage = createJSONStorage(() => ({
    getItem: (key: string) => {
        return readCookie(key) // string | null
    },
    setItem: (key: string, value: string) => {
        const DAY = 24 * 3600 * 1000
        if (typeof document === 'undefined') return

        try {
            const obj = JSON.parse(value || '{}') || {}
            const now = Date.now()

            // If there is no token -> logout (delete cookie)
            if (!obj.token) {
                document.cookie = `${key}=;path=/;max-age=0;SameSite=Lax`
                return
            }

            // Ensure issuedAt is set once and calculate hybrid expiration
            obj.issuedAt = obj.issuedAt ?? now

            const absRemainingMs = (obj.issuedAt + ABSOLUTE_DAYS * DAY) - now
            const slidingMs = SLIDING_DAYS * DAY
            // Take the minimum between absolute remaining and sliding window
            // (if absolute is smaller than sliding, it means we are close to absolute expiration)
            const maxAgeSeconds = Math.max(0, Math.floor(Math.min(absRemainingMs, slidingMs) / 1000))

            if (maxAgeSeconds > 0) {
                // Update cookie with new sliding expiration
                document.cookie = `${key}=${encodeURIComponent(JSON.stringify(obj))};path=/;max-age=${maxAgeSeconds};SameSite=Lax`
            } else {
                // Absolute timeout reached, delete cookie
                document.cookie = `${key}=;path=/;max-age=0;SameSite=Lax`
            }
        } catch {
            // Defensive fallback: session cookie without explicit expiration
            document.cookie = `${key}=${encodeURIComponent(value ?? '')};path=/;SameSite=Lax`
        }
    },
    removeItem: (key: string) => {
        if (typeof document !== 'undefined') {
            document.cookie = `${key}=;path=/;max-age=0;SameSite=Lax`
        }
    },
}))

// atomWithStorage uses cookie as storage
export const SessionData = atomWithStorage("session", createSession(), cookieJSONStorage, {
    unstable_getOnInit: true
})


// - Only proxies to SessionData; storage handles the cookie.
export const Session = atom(
    (get) => get(SessionData),
    (get, set, data: SessionDataType) => {
        set(SessionData, data);
    }
);

export const getSessionContext = async (type) => {
    return { state: 'resolved', group: type ? (await API.get('/api/core/v1/groups/' + type)).data : {} }
}

export const initSession = (pageSession) => {
    if (pageSession) {
        useHydrateAtoms([
            [Session, pageSession.session],
            [SessionContext, pageSession.context]
        ]);
    }
}

export const useSession = (pageSession?) => {
    initSession(pageSession)
    const [session, setSession] = useAtom(Session)

    // if there is no cookie but you are "loggedIn", reset to a clean session.
    useEffect(() => {
        if (typeof document !== 'undefined') {
            const hasCookie = document.cookie
                .split(';')
                .some((c) => c.trim().startsWith('session='))
            if (!hasCookie && session.loggedIn) {
                setSession(createSession())
            }
        }
    }, [session.loggedIn, setSession])

    // ensure the stored session is still valid on the API side (guards against stale cookies)
    useEffect(() => {
        if (!session.loggedIn || !session.token) {
            return
        }

        if (isValidatingSession || lastValidatedToken === session.token) {
            return
        }

        const validateSession = async () => {
            isValidatingSession = true
            try {
                const result = await API.get('/api/core/v1/auth/validate')
                if (!result || result.isError) return

                if (result.isLoaded) {
                    const validatedSession = result.data
                    lastValidatedToken = session.token

                    if (!validatedSession?.loggedIn) {
                        lastValidatedToken = null
                        setSession(createSession())
                        return
                    }

                    if (validatedSession.token && validatedSession.token !== session.token) {
                        lastValidatedToken = validatedSession.token
                        setSession(validatedSession)
                    }
                }
            } finally {
                isValidatingSession = false
            }
        }

        validateSession()

    }, [session.loggedIn, session.token, setSession])

    return [session, setSession]
}

export const useSessionContext = () => {
    return useAtom(SessionContext)
}


export const useSessionGroup = () => {
    const [ctx] = useSessionContext()
    return ctx.group
}

export const useWorkspaces = () => {
    const group = useSessionGroup()
    if (group && group.workspaces) return group.workspaces
    return []
}

export const useUserSettings = () => {
    const [settings, setSettings] = useAtom(UserSettingsAtom)
    const [session] = useSession()
    return [
        session && settings[session.user.id] ? settings[session.user.id] : {},
        (val) => setSettings({ ...settings, [session.user.id]: val })
    ]
}
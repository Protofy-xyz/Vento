import { atom, useAtom } from 'jotai'
import { atomWithStorage, useHydrateAtoms } from 'jotai/utils'
import * as cookie from 'cookie'
import { validateSession, SessionDataType, getSessionContext } from 'protonode/dist/lib/session'
import { NextPageContext } from 'next'
import { parse } from 'cookie'
import { getLogger, createSession } from "protobase"

const logger = getLogger()

//to be used from nextJs
export const hasSessionCookie = (cookieStr) => {
    const parsedCookies = cookie.parse(cookieStr ?? '');
    return parsedCookies.session && JSON.parse(parsedCookies.session).loggedIn
}

export const getSessionCookie = async (cookieStr) => {
    const parsedCookies = cookie.parse(cookieStr ?? '');
    if (parsedCookies.session) {
        try {
            const data = JSON.parse(parsedCookies.session)
            const { iat, exp, ...validatedData } = await validateSession(data)
            return {
                ...data,
                user: {
                    ...data.user,
                    ...validatedData
                }
            } as SessionDataType
        } catch (error) {
            logger.error({ error }, "ERROR validating session")
            if (error == "Server Error") {
                throw "Server Error"
            }

        }
    }
    return undefined
}

//utility functions for nextjs pages
const fail = (returnUrl?) => {
    if (returnUrl.includes('_next/data/development/')) {
        const basePath = returnUrl.split('_next/data/development')[1].split('.json')[0];
        returnUrl = basePath
    }
    if (returnUrl == "/") returnUrl = undefined
    const encodedReturn = encodeURIComponent(returnUrl);
    return {
        redirect: {
            permanent: false,
            destination: "/workspace/auth/login" + (returnUrl ? "?return=" + encodedReturn : "")
        }
    }
}
export const withSession = async (context: any, permissions?: string[] | any[] | null, props?: any) => {
    let session;
    let sessionError;
    const hasSomePermission = (validPermissions, userPermissions) => {
        logger.trace({validPermissions, userPermissions}, "Checking permissions to access page");
        return validPermissions.some((perm) => userPermissions.includes(perm))
    }

    try {
        //try to get session. This can fail because of unavailable api
        //in case of error, let the client handle the session itself in CSR mode
        session = await getSessionCookie(context.req.headers.cookie)
    } catch (e) {
        sessionError = true
    }

    if (permissions && !sessionError) {
        if (!session) return fail(context.req.url)
        if (permissions.length && !session?.user?.admin && !hasSomePermission(permissions, session?.user?.permissions ?? [])) return fail()
    }

    const pageSession = { session: sessionError ? null : (session ?? createSession()), context: await getSessionContext(session?.user?.type) }
    return {
        props: {
            pageSession: pageSession,
            ...(typeof props === "function" ? await props(session) : props),
        }
    }
}
const initialContext = { state: "pending", group: { workspaces: [] } }


async function logoutCinnyClean() {

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("cinny_")) {
      localStorage.removeItem(key);
    }
  }

  if (indexedDB.databases) {
    const dbs = await indexedDB.databases();
    dbs.forEach((db) => {
      if (db.name && db.name.startsWith("matrix-js-sdk::")) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  } else {
    indexedDB.deleteDatabase("matrix-js-sdk::matrix-sdk-crypto");
    indexedDB.deleteDatabase("matrix-js-sdk::web-sync-store");
    indexedDB.deleteDatabase("matrix-js-sdk::account-data");
  }
}

export const clearSession = (setSession, setSessionContext) => {
    setSession(createSession())
    setSessionContext(initialContext)
    logoutCinnyClean()
}

export const getURLWithToken = (url, context: NextPageContext) => {
    const { req } = context;
    const cookies = req.headers.cookie;

    let session;
    if (cookies) {
        try {
            const parsedCookies = parse(cookies);
            session = JSON.parse(parsedCookies.session);
        } catch (e) {
            session = null
        }
    }

    const finalUrl = url + (session && session.token ? (url.includes('?') ? '&' : '?') + 'token=' + session.token : '')
    logger.debug({ url: finalUrl }, "Return url with session token")
    return finalUrl
}

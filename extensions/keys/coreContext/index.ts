import { API } from "protobase";
import { getLogger, getServiceToken } from "protobase";

const logger = getLogger()

export const getKey = async ({ key = '', done = (key) => { }, error = (err) => { }, token = '' , defaultValue = undefined }) => {
    if (!key) {
        logger.error("Error getting key: No key provided")
        error("No key provided")
        return
    }

    if (!token) {
        token = getServiceToken()
    }

    var urlEnch = '/api/core/v1/keys/' + key

    if (token) {
        urlEnch = urlEnch + "?token=" + token
    }

    const result = await API.get(urlEnch)

    if (result.isError) {
        if(process.env[key]) {
            if (done) done(process.env[key])
            return process.env[key]
        }
        if (defaultValue !== undefined) {
            if (done) done(defaultValue)
            return defaultValue
        }
        if (error) {
            logger.error({ error: result.error?.error ?? result.error }, "Error getting key: " + key)
            error(result.error?.error ?? result.error)
        }
        return
    }

    if (done) done(result.data?.value)

    return result.data?.value
}

export default {
    getKey
}

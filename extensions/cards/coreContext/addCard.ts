import { API, getLogger, ProtoMemDB, generateEvent } from 'protobase';
import {getServiceToken} from 'protonode';

const logger = getLogger();

export const addCard = async (options: {
    group?: string,
    tag: string,
    name: string,
    readme?: string,
    templateName: string,
    id: string,
    defaults: any,
    emitEvent?: boolean
}) => {
    const group = options.group || 'system'
    const name = options.name
    const readme = options.readme
    const tag = options.tag
    const id = options.id
    const defaults = options.defaults
    const templateName = options.templateName

    if(!name) {
        logger.error({}, "Action name is required");
        return
    }

    if(!id) {
        logger.error({}, "Action id is required");
        return
    }

    if(!tag) {
        logger.error({}, "Action tag is required");
        return
    }

    if(!defaults) {
        logger.error({}, "Card defaults are required");
        return
    }

    if(!templateName) {
        logger.error({}, "Card templateName is required");
        return
    }

    const content = {
        defaults: defaults,
        readme: readme,
        name: name,
        id: id,
        group: group,
        tag: tag,
        templateName: templateName
    }

    const response = await API.post(`/api/core/v1/cards?token=`+getServiceToken(), content)
    return response
}
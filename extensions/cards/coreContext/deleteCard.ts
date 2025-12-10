import { API, getLogger, ProtoMemDB, generateEvent } from 'protobase';
import { getServiceToken } from 'protonode';

const logger = getLogger();

export const deleteCard = async (options: {
    group?: string;
    tag: string;
    name: string;
    emitEvent?: boolean;
    token?: string;
}) => {
    const group = options.group || 'system';
    const { tag, name } = options;
    const token = options.token || getServiceToken();

    if (!name) {
        logger.error({}, 'Card name is required');
        return;
    }
    if (!tag) {
        logger.error({}, 'Card tag is required');
        return;
    }

    if (!token) {
        logger.error({ group, tag, name }, 'No token available to delete card');
        return;
    }

    const cardId = `${group}.${tag}.${name}`;
    const response = await API.get(
        `/api/core/v1/cards/${encodeURIComponent(cardId)}/delete?token=${token}`
    );

    ProtoMemDB('cards').remove(group, tag, name);

    if (options.emitEvent) {
        generateEvent(
            {
                path: `cards/${group}/${tag}/${name}/delete`,
                from: 'states',
                user: 'system',
                payload: { group, tag, name },
                ephemeral: true,
            },
            token
        );
    }

    return response;
};

import { ServiceModel } from "./servicesSchemas";
import {AutoActions, getServiceToken} from 'protonode'

const prefix = '/api/core/v1/'

export default (app, context) => {
    context.actions.add({
        group: 'objects',
        tag: 'services',
        name: 'list', //get last path element
        url: '/api/v1/actions/services/list',
        description: `Returns a list of services objects. You can filter the results by passing itemsPerPage, page, search, orderBy and orderDirection parameters.`,
        params: {
            itemsPerPage: 'number of items per page (optional)',
            page: 'page number to retrieve (optional)',
            search: 'search term to filter the results (optional)',
            orderBy: 'field to order the results by (optional)',
            orderDirection: 'direction to order the results by (asc or desc) (optional)'
        },
        token: getServiceToken(),
    })
}
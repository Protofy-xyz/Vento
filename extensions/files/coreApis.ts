import { addAction } from '@extensions/actions/coreContext/addAction';
import { addCard } from '@extensions/cards/coreContext/addCard';

export default async (app, context) => {
    addAction({
        group: 'directories',
        name: 'create',
        url: "/api/core/v1/directories",
        tag: 'operations',
        description: "Create a directory",
        method: 'post',
        params: {
            path: "Path to the directory to create",
        },
        emitEvent: true
    })

    addAction({
        group: 'files',
        name: 'read',
        url: "/api/core/v1/files",
        tag: 'operations',
        description: "Read a file or directory",
        params: {
            path: "Path to the file or directory to read",
        },
        emitEvent: true
    })

    addAction({
        group: 'files',
        name: 'files_download',
        url: "/api/core/v1/download",
        tag: 'operations',
        description: "Download a file from a URL",
        params: {
            path: "Path to the file to download",
            url: "URL to download the file from"
        },
        emitEvent: true
    })
}
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

    addCard({
        group: 'directories',
        tag: 'operations',
        id: 'directory_create',
        templateName: 'Create Directory',
        name: 'directories_create',
        defaults: {
            width: 2,
            height: 8,
            type: "action",
            icon: 'folder-plus',
            name: 'create directory',
            description: 'Create a directory',
            params: {
                path: "Path to the directory to create",
            },
            configParams: {
                "path": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "path",
                    "multiple": false
                },
            },
            rulesCode: "return await execute_action(\"/api/core/v1/directories\", userParams)",
        }
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

    addCard({
        group: 'files',
        tag: 'operations',
        id: 'files_read',
        templateName: 'Read File or Directory',
        name: 'files_read',
        defaults: {
            width: 2,
            height: 8,
            type: "action",
            icon: 'file',
            name: 'files_read',
            description: 'Read a file or directory',
            params: {
                path: "Path to the file or directory to read",
            },
            configParams: {
                "path": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "path",
                    "multiple": false
                },
            },
            rulesCode: `return await execute_action("/api/core/v1/files", userParams)`,
            displayResponse: true
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

    addCard({
        group: 'files',
        tag: 'actions',
        id: 'download',
        templateName: 'Download File from URL',
        name: 'files_url_download',
            defaults: {
            width: 2,
            height: 9,
            type: "action",
            icon: 'download',
            name: 'files_url_download',
            description: 'Download a file from a URL',
            configParams: {
                "path": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "path",
                    "multiple": false
                },
                "url": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "string"
                }
            },
            params: {
                path: "Path to the file to download",
                url: "URL to download the file from"
            },
            rulesCode: `return await execute_action("/api/core/v1/download", params)`,
            displayResponse: true
        },
        emitEvent: true
    })



    addCard({
        group: 'files',
        tag: 'board',
        id: 'file_board_context',
        templateName: 'Add a file to the board context',
        name: 'append',
        defaults: {
            width: 2,
            height: 12,
            "icon": "file",
            "type": "action",
            "name": "file_board_context",
            "displayResponse": true,
            "params": {
                "path": "path to the file"
            },
            "configParams": {
                "path": {
                    "visible": true,
                    "defaultValue": "",
                    "type": "path",
                    "multiple": false
                }
            },
            "rulesCode": "return {\n    type: 'file',\n    path: params.path\n}",
            "html": "//@card/react\n\nfunction Widget(card) {\n  const value = card.value;\n\n  const content = <YStack f={1}  mt={\"20px\"} ai=\"center\" jc=\"center\" width=\"100%\">\n      {card.icon && card.displayIcon !== false && (\n          <Icon name={card.icon} size={48} color={card.color}/>\n      )}\n      {card.displayResponse !== false && (\n          <CardValue value={value?.path ?? \"N/A\"} />\n      )}\n  </YStack>\n\n  return (\n      <Tinted>\n        <ProtoThemeProvider forcedTheme={window.TamaguiTheme}>\n          <ActionCard data={card}>\n            {card.displayButton !== false ? <ParamsForm data={card}>{content}</ParamsForm> : card.displayResponse !== false && content}\n          </ActionCard>\n        </ProtoThemeProvider>\n      </Tinted>\n  );\n}\n"
        }
    })
}
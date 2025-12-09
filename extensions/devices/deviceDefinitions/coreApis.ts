import { DeviceDefinitionModel} from ".";
import { AutoAPI, getRoot } from 'protonode'
import { API } from 'protobase'
import { DevicesModel } from "../devices";
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as fspath from 'path';
import { stringify as yamlStringify } from 'yaml';

const deviceDefinitionsDir = (root) => fspath.join(root, "/data/deviceDefinitions/")
const deviceDefinitionConfigDir = (root, name: string) => fspath.join(deviceDefinitionsDir(root), name)
const deviceDefinitionConfigPath = (root, name: string) => fspath.join(deviceDefinitionConfigDir(root, name), "config.yaml")
const initialData = {}

const onAfterCreate = async (data, session?, req?) => {
    await ensureEsphomeYamlConfigFile(data, req)
}

const onAfterUpdate = async (data, session?, req?) => {
    await ensureEsphomeYamlConfigFile(data, req)
}

const ensureEsphomeYamlConfigFile = async (data, req) => {
    if (!req || data?.sdk !== 'esphome-yaml') return

    const root = getRoot(req)
    const baseDir = deviceDefinitionsDir(root)
    const yamlDir = deviceDefinitionConfigDir(root, data.name)
    const yamlPath = deviceDefinitionConfigPath(root, data.name)

    try {
        await fs.mkdir(baseDir, { recursive: true })
        await fs.mkdir(yamlDir, { recursive: true })
    } catch {
        // ignore mkdir errors; next access will throw if still missing
    }

    try {
        await fs.access(yamlPath, fs.constants.F_OK)
        return
    } catch {
        // continue to create the file
    }

    const baseYaml = data?.config?.sdkConfig ?? {}
    const yamlContent = Object.keys(baseYaml).length ? yamlStringify(baseYaml) : '# ESPHome YAML\n'
    await fs.writeFile(yamlPath, yamlContent)
}

const getDB = (path, req, session) => {
    const db = {
        async *iterator() {
            // console.log("Iterator")
            //check if deviceDefinitions folder exists
            try {
                await fs.access(deviceDefinitionsDir(getRoot(req)), fs.constants.F_OK)
            } catch (error) {
                console.log("Creating deviceDefinitions folder")
                await fs.mkdir(deviceDefinitionsDir(getRoot(req)))
            }
            //list all .json files in the deviceDefinitions folder
            const files = (await fs.readdir(deviceDefinitionsDir(getRoot(req)))).filter(f => {
                const filenameSegments = f.split('.')
                return !fsSync.lstatSync(fspath.join(deviceDefinitionsDir(getRoot(req)), f)).isDirectory() && (filenameSegments[filenameSegments.length - 1] === "json")
            })
            // console.log("Files: ", files)
            for (const file of files) {
                //read file content
                const fileContent = await fs.readFile(deviceDefinitionsDir(getRoot(req)) + file, 'utf8')
                yield [file.name, fileContent];
            }
        },

        async del(key, value) {
            // delete deviceDefinitions[key]
            // try to delete the deviceDefinition file from the deviceDefinitions folder
            console.log("Deleting device definition: ", JSON.stringify({key,value}))
            const filePath = deviceDefinitionsDir(getRoot(req)) + key + ".json"
            const configDirPath = deviceDefinitionConfigDir(getRoot(req), key)
            try {
                await fs.unlink(filePath)
            } catch (error) {
                console.log("Error deleting file: " + filePath)
            }

            try {
                // remove config directory (including YAML) for this deviceDefinition
                await fs.rm(configDirPath, { recursive: true, force: true })
            } catch (error) {
                console.log("Error deleting config directory: " + configDirPath)
            }
        },

        async put(key, value) {
            // try to create the deviceDefinition file in the deviceDefinitions folder
            // console.log("Creating device definition: ", JSON.stringify({key,value}))
            const filePath = deviceDefinitionsDir(getRoot(req)) + key + ".json"
            try{
                let content = value
                try {
                    const parsed = typeof value === 'string' ? JSON.parse(value) : value
                    content = JSON.stringify(parsed, null, 2)
                } catch (parseErr) {
                }
                await fs.writeFile(filePath, content)
            }catch(error){
                console.error("Error creating file: " + filePath, error)
            }
        },

        async get(key) {
            // try to get the deviceDefinition file from the deviceDefinitions folder
            // console.log("Get function: ",key)
            const filePath = deviceDefinitionsDir(getRoot(req)) + key + ".json"
            try{
                const fileContent = await fs.readFile(filePath, 'utf8')
                // console.log("fileContent: ", fileContent)
                // console.log("filePath: ", filePath)
                return fileContent
            }catch(error){
                // console.log("Error reading file: " + filePath)
                throw new Error("File not found")
            }                   
        }
    };

    return db;
}

export default AutoAPI({
    modelName: 'devicedefinitions',
    modelType: DeviceDefinitionModel,
    initialData,
    onAfterCreate: onAfterCreate,
    onAfterUpdate: onAfterUpdate,
    skipDatabaseIndexes: true,
    getDB: getDB,
    prefix: '/api/core/v1/',
    transformers: {
        getConfig: async (field, e, data) => {
            //get config from deviceBoard
            const deviceBoard = await API.get("/api/core/v1/deviceboards/" +encodeURI(data.board.name))
            const boardConfig = deviceBoard?.data?.config?.[data.sdk] ?? {}
            data.config = data.config ?? {}
            data.config.sdkConfig = boardConfig
            return data
        }
    }
})

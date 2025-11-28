import { DeviceDefinitionModel} from ".";
import { AutoAPI, getRoot } from 'protonode'
import { API } from 'protobase'
import { DevicesModel } from "../devices";
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as fspath from 'path';

const deviceDefinitionsDir = (root) => fspath.join(root, "/data/deviceDefinitions/")
const initialData = {}

const onAfterCreate = async (data, session?, req?) => {
    if (data.device && session) {
        const objectDevice = DevicesModel.load({
            name: data.name + "1",
            platform: data.sdk,
            deviceDefinition: data.name,
            environment: data.environment,
        })
        await API.post("/api/core/v1/devices?token=" + session.token, objectDevice.create().getData())
    }
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
            try {
                await fs.unlink(filePath)
            } catch (error) {
                console.log("Error deleting file: " + filePath)
            }
        },

        async put(key, value) {
            // try to create the deviceDefinition file in the deviceDefinitions folder
            // console.log("Creating device definition: ", JSON.stringify({key,value}))
            const filePath = deviceDefinitionsDir(getRoot(req)) + key + ".json"
            try{
                await fs.writeFile(filePath, value)
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
    // onAfterCreate: onAfterCreate,
    skipDatabaseIndexes: true,
    getDB: getDB,
    prefix: '/api/core/v1/',
    transformers: {
        getConfig: async (field, e, data) => {
            //get config from deviceBoard
            const deviceBoard = await API.get("/api/core/v1/deviceboards/" +encodeURI(data.board.name))
            data.config.sdkConfig = deviceBoard.data.config[data.sdk]
            return data
        }
    }
})
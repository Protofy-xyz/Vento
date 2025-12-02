import { DeviceCoreModel } from ".";
import { AutoAPI } from 'protonode'
import { API } from 'protobase'

const initialData = {
    "esp32": {
        "id": "1",
        "name": "esp32",
        "sdks": ["esphome-arduino", "esphome-idf", "esphome-yaml"],
        "config": {
            "esphome-arduino":{
                "esphome":{},
                "esp32":{
                    "variant": "esp32",
                    "framework": { 
                        "type": "arduino"
                    }
                }
            },
            "esphome-idf":{
                "esphome":{},
                "esp32":{
                    "variant": "esp32", 
                    "framework": { 
                        "type": "esp-idf"
                    }
                }
            },
            "esphome-yaml":{
                "esphome":{},
                "esp32":{
                    "variant": "esp32",
                    "framework": {
                        "type": "esp-idf"
                    }
                }
            }
        }
    },
    "esp32s3": {
        "id": "2",
        "name": "esp32s3",
        "sdks": ["esphome-arduino", "esphome-idf", "esphome-yaml"],
        "config": {
            "esphome-arduino":{
                "esphome":{},
                "esp32":{
                    "variant": "esp32s3",
                    "framework": { 
                        "type": "arduino"
                    }
                }
            },
            "esphome-idf":{
                "esphome":{},
                "esp32":{
                    "variant": "esp32s3", 
                    "framework": { 
                        "type": "esp-idf"
                    }
                }
            },
            "esphome-yaml":{
                "esphome":{},
                "esp32":{
                    "variant": "esp32s3",
                    "framework": { 
                        "type": "esp-idf"
                    }
                }
            }
        }
    }
}

export default AutoAPI({
    modelName: 'devicecores',
    modelType: DeviceCoreModel,
    initialData,
    skipDatabaseIndexes: true,
    prefix: '/api/core/v1/',
    transformers: {
        getConfig: async (field, e, data) => {
            const sdksData = await API.get("/api/core/v1/devicesdks")
            data.sdks.forEach(async (sdk) => {
                const sdkData = sdksData.data.items.find((item) => item.name === sdk)
                if (sdkData !== undefined) {
                    if(!data.config) data.config = {}
                    data.config[sdk] = sdkData?.config
                }  
            })
            return data
        }
    }
})
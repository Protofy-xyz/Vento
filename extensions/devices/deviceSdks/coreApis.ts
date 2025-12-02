import { DeviceSdkModel } from ".";
import { AutoAPI } from 'protonode'

const initialData = {
    "1": {   
        "id": "1",
        "name": "esphome-arduino",
        "config":{
            "esphome":{}
        }
    },
    "2": {   
        "id": "2",
        "name": "esphome-idf",
        "config":{
            "esphome":{}
        }
    },
    "3": {
        "id": "3",
        "name": "esphome-yaml",
        "config": {
            "esphome": {}
        }
    }
}

export default AutoAPI({
    modelName: 'devicesdks',
    modelType: DeviceSdkModel,
    initialData,
    skipDatabaseIndexes: true,
    prefix: '/api/core/v1/'
})
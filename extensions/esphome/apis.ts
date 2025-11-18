import {handler, getServiceToken} from 'protonode'
import path from 'path'
import fs from 'fs'
import { API } from "protobase";
import { downloadDeviceFirmwareEndpoint } from './utils'

export default (app, context) => {

    app.get('/api/v1/esphome/:device/yaml', handler(async (req, res, session) => {
        if(!session || !session.user.admin) {
            res.status(401).send({error: "Unauthorized"})
            return
        }

        const devicesPathData = await API.get('/api/core/v1/devices/path?token='+getServiceToken())
        if(devicesPathData.isError) {
            console.error("Error getting devices path: ", devicesPathData.error, " - this is necesary for the esphome extension to work")
            res.status(500).send({error: "Devices path not found, this is necesary for the esphome extension to work"})
            return
        }
        // console.log("Devices path: ", devicePathData.data.path)
        const devicePath = path.join(devicesPathData.data.path, req.params.device)
        
        // console.log("Device path: ", devicePath)
        if(!fs.existsSync(devicePath)){
            res.status(404).send({error: "Not Found"})
            return
        }
        const yaml = fs.readFileSync(path.join(devicePath,"config.yaml"),'utf8')
        res.send({yaml})
    }))

    app.post('/api/v1/esphome/:device/yamls', handler(async (req, res, session) => {
        if(!session || !session.user.admin) {
            res.status(401).send({error: "Unauthorized"})
            return
        }

        const devicesPathData = await API.get('/api/core/v1/devices/path?token='+getServiceToken())
        if(devicesPathData.isError) {
            console.error("Error getting devices path: ", devicesPathData.error, " - this is necesary for the esphome extension to work")
            res.status(500).send({error: "Devices path not found, this is necesary for the esphome extension to work"})
            return
        }
        // console.log("Devices path: ", devicePathData.data.path)
        const devicesPath = devicesPathData.data.path

        const {yaml} = req.body

        if(!fs.existsSync(devicesPath)) fs.mkdirSync(devicesPath)
        const devicePath = path.join(devicesPath, req.params.device)
        if(!fs.existsSync(devicePath)) fs.mkdirSync(devicePath)
        fs.writeFileSync(path.join(devicePath,"config.yaml"),yaml)

        res.send({value: yaml})
    }))

    app.get('/api/v1/esphome/:device/:compileSessionId/manifest', handler(async (req, res, session) => {
        if(!req.params.device){
            res.status(400).send({error: "Device not specified"})
            return
        }
        const deviceData = await API.get('/api/core/v1/devices/'+req.params.device+'?token='+getServiceToken())
        if(deviceData.isError) {
            console.error("Error getting device data: ", deviceData.error)
            res.status(500).send({error: "Error getting device data"})
            return
        }
        const deviceInfo = deviceData.data
        console.log("Device info: ", deviceInfo)
        const core = await deviceInfo.getCore()
        const mapCore = {
            "esp32": "ESP32",
            "esp8266": "ESP8266",
            "esp32s3": "ESP32-S3",
            "esp32c3": "ESP32-C3",
            "esp32s2": "ESP32-S2" 
        }
        const manifest = {
            "name": `${req.params.device} firmware`,
            "new_install_prompt_erase": true,
            "improv": true,
            "builds": [{
                "chipFamily": mapCore[core],
                "parts": [
                    {"path": downloadDeviceFirmwareEndpoint(req.params.device, req.params.compileSessionId), "offset": "0"},
                ]
            }]
            }
        res.send(JSON.stringify(manifest))
    }))


}
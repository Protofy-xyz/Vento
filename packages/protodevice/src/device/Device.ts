const jsYaml = require("js-yaml");
class Device {
    components;
    pinTable;
    componentsTree;
    subsystemsTree;
    credentials;

    constructor(components) {
        this.pinTable = []
        this.components = components.slice(2)
        this.componentsTree = {}
        this.subsystemsTree = []
        this.credentials = {}
    }
    
    createComponentsTree(deviceName, deviceDefinition){
        var deviceComponents = {
            ...deviceDefinition.config.sdkConfig,
            logger: {}
        }
        deviceComponents.esphome.name = deviceName
        deviceComponents.protofy = { credentials: this.credentials }

        this.components?.map((component, i) => ({
            component,
            pin: !isNaN(parseInt(this.pinTable[i])) ? parseInt(this.pinTable[i]) : this.pinTable[i]
        }))
        // Sort to ensure "sd_card_component" types are attached last
        .sort((a, b) => {
            if (a.component?.type === "sd_card_component") return 1;
            if (b.component?.type === "sd_card_component") return -1;
            return 0;
        })
        // Attach each component in the sorted order with its associated pin
        .forEach(({ component, pin }) => {
            if (component) {
                deviceComponents = component.attach(pin, deviceComponents, this.components);
            }
        });
        
        delete deviceComponents.protofy
        //console.log("🚀 ~ file: Device.ts:120 ~ Device ~ getComponents ~ deviceComponents:", deviceComponents)
        this.componentsTree = deviceComponents

    }

    createSubsystemsTree(deviceName, deviceDefinition){
        this.subsystemsTree = []
        this.components?.forEach((component) => {
            if(component) {
                try {
                    let componentSubsystem = component.getSubsystem()
                    if(Array.isArray(componentSubsystem)){
                        componentSubsystem.forEach((subsystem)=>{
                            this.subsystemsTree.push({...subsystem})
                        })
                    }
                    else{
                        this.subsystemsTree.push({...componentSubsystem})
                    }
                } catch {

                }
            }
        })

        this.subsystemsTree.forEach((subsystem)=>{
            if(Object.keys(subsystem).length==0){
                console.warn("Subsystem is empty, removing it", subsystem)
                return
            }
            if(subsystem.monitors){
                subsystem.monitors = subsystem.monitors.map((monitor)=>{
                    monitor["ephemeral"] = true
                    return monitor
                })
            }
        })
        this.subsystemsTree = this.subsystemsTree.sort((a,b)=>{
            if(a.name=="mqtt"){
                return -1
            }else if(b.name == "mqtt"){
                return 1
            }else{
                return 0
            }
        })
    }

    getComponentsTree(deviceName?, deviceDefinition?) {
        const ports = deviceDefinition.board.ports
        this.pinTable = ports.map(port => port.name)
        
        this.createComponentsTree(deviceName, deviceDefinition)
        //console.log("🚀 ~ file: Device.ts:275 ~ Device ~ create ~ jsYaml.dump(components):", jsYaml.dump(components, {lineWidth: -1}))
        return this.componentsTree
    }

    
    getSubsystemsTree(deviceName?, deviceDefinition?) {
        this.createSubsystemsTree(deviceName, deviceDefinition)
        return this.subsystemsTree;
    }

    setCredentials(credentials){
        this.credentials = credentials
    }

    dump(format = "yaml") {
        if (format == "yaml") {
            let ret = jsYaml.dump(this.componentsTree, { lineWidth: -1 })
            ret = ret.replace(/'@!lambda ''(.*?)''@'/g, "!lambda '$1'");
            ret = ret.replace(/'@/g, "").replace(/@'/g, "")
            return ret
        } else {
            return undefined;
        }
    }
}

export function device(deviceInfo) {
    return new Device(deviceInfo)
}

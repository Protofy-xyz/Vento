import * as Zod from 'zod'

export class ProtoSchema {
    shape: any

    constructor(shape: any) {
        this.shape = shape
    }

    getFields() {
        return Object.keys(this.shape)
    }

    getDefinition() {
        //this.shape is a zod object
        //return an object with the field name and the type of the field as a string
        const fields = {}
        Object.keys(this.shape).forEach((key) => {
            fields[key] = {
                type: this.shape[key]._def.typeName.replace("Zod", "").toLowerCase(), 
                description: this.shape[key]._def.hint || "",
                isId: this.shape[key]._def.id || false,
                autogenerate: this.shape[key]._def.generate ? true : false
            }
        })
        return fields
    }

    getFieldKeyDefinition(field: string, key: string) {
        return this.shape[field] ? this.shape[field]._def[key] : undefined
    }

    //get field definition
    getFieldDefinition(field: string) {
        return this.shape[field] ? this.shape[field]._def : undefined
    }

    applyGenerators(data: any) {
        let newData = { ...data }
        Object.keys(this.shape).forEach((key) => {
            if (this.shape[key]._def.generate) {
                const gen = this.shape[key]._def.generate;
                if (!data[key] || gen.force) {
                    newData[key] = typeof gen.generator === 'function' ? gen.generator(data) : gen.generator
                }
            }
        })

        return newData;
    }

    //apply generative schema to data
    async apply(eventName: string, data: any, transformers: any, prevData?: any) {
        let newData = { ...data }
        const withEvents = this.is('events')
        const keys = Object.keys(withEvents.shape)
        for (var i = 0; i < keys.length; i++) {
            const key = keys[i]
            const currField: any = withEvents.shape[key]
            const isNode = typeof process !== 'undefined' && process.versions && process.versions.node
            const events = currField._def.events.filter(e => e.eventName == eventName && (!e.eventContext || (e.eventContext == 'client' && !isNode) || (e.eventContext == 'server' && isNode)))
            for (var x = 0; x < events.length; x++) {
                const e = events[x]
                if (transformers[e.eventHandler]) {
                    newData = await transformers[e.eventHandler](key, e, newData, prevData)
                }
            }
        }

        return newData
    }

    getLayout(num: Number) {
        const elements = [[]]
        let curIndex = 0

        Object.keys(this.shape).forEach((key) => {
            const field = this.shape[key]
            if (elements[curIndex].length == num) {
                elements.push([])
                curIndex++
            }
            elements[curIndex].push({ ...field, name: key })
        })
        return elements;
    }

    getFirst(field: string): string | undefined {
        return Object.keys(this.shape).find((key) => {
            if (this.shape[key]._def[field]) {
                return key
            }
        })
    }

    getLast(field: string): string | undefined {
        let lastKey: string | undefined = undefined;
        Object.keys(this.shape).forEach((key) => {
            if (this.shape[key]._def[field]) {
                lastKey = key;
            }
        });
        return lastKey;
    }

    isDisplay(displayType) {
        const validFields = {}
        Object.keys(this.shape).forEach(k => {
            if (!this.shape[k]._def.display || (this.shape[k]._def.display.includes('*')) || this.shape[k]._def.display.includes(displayType)) {
                if (!this.shape[k]._def.hidden || (!this.shape[k]._def.hidden.includes('*') && !this.shape[k]._def.hidden.includes(displayType))) {
                    validFields[k] = this.shape[k]
                }
            }
        })
        return new ProtoSchema(validFields)
    }

    isVisible(displayType, object) {
        const displayFields = this.isDisplay(displayType)

        const validFields = {}
        Object.keys(displayFields.shape).forEach((key) => {
            if (displayFields.shape[key]._def["visible"]) {
                const visible = displayFields.shape[key]._def["visible"](displayType, object)
                if (visible) {
                    validFields[key] = displayFields.shape[key]
                }
            } else {
                validFields[key] = displayFields.shape[key]
            }
        })
        return new ProtoSchema(validFields)
    }

    is(field: string) {
        const validFields = {}
        Object.keys(this.shape).forEach((key) => {
            if (this.shape[key]._def[field]) {
                validFields[key] = this.shape[key]
            }
        })
        return new ProtoSchema(validFields)
    }

    isNot(field: string) {
        const validFields = {}
        Object.keys(this.shape).forEach((key) => {
            if (!this.shape[key]._def[field]) {
                validFields[key] = this.shape[key]
            }
        })
        return new ProtoSchema(validFields)
    }

    isAfter(afterField: string) {
        const validFields = {}
        Object.keys(this.shape).forEach((field) => {
            if (this.shape[field]._def?.after && this.shape[field]._def.after == afterField) {
                validFields[field] = this.shape[field]
            }
        })
        return new ProtoSchema(validFields)
    }

    isBefore(beforeField: string) {
        const validFields = {}
        Object.keys(this.shape).forEach((field) => {
            if (this.shape[field]._def?.before && this.shape[field]._def.before == beforeField) {
                validFields[field] = this.shape[field]
            }
        })
        return new ProtoSchema(validFields)
    }

    merge(schema: ProtoSchema) {
        let newfields = {}
        Object.keys(this.shape).forEach((key) => {
            const beforeFields = schema.isBefore(key)
            newfields = { ...newfields, ...beforeFields.shape }
            newfields[key] = this.shape[key]
            const afterFields = schema.isAfter(key)
            newfields = { ...newfields, ...afterFields.shape }
        })
        return new ProtoSchema(newfields)
    }

    //generate a protoSchema from a extended zodSchema
    static load(schema: Zod.ZodObject<any>) {
        return new ProtoSchema(schema.shape)
    }
}
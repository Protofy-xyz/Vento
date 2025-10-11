import { createSession } from './Session'
import { SessionDataType } from './lib/perms'
import { BaseSchema, Schema, z, ZodObject } from './BaseSchema'
import { ProtoSchema } from './ProtoSchema';
import { getLogger } from "./logger"
import { API } from './Api';

const logger = getLogger()

function parseSearch(search) {
    const regex = /(\w+):("[^"]+"|\S+)/g;
    const parsed = {};
    let match;
    let searchWithoutTags = search;

    while ((match = regex.exec(search)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2].replace(/"/g, '').toLowerCase();

        parsed[key] = value;

        searchWithoutTags = searchWithoutTags.replace(match[0], '');
    }


    searchWithoutTags = searchWithoutTags.trim();

    return { parsed, searchWithoutTags };
}

export abstract class ProtoModel<T extends ProtoModel<T>> {
    data: any
    session: SessionDataType
    schema: ZodObject<any>
    idField: string
    objectSchema: ProtoSchema
    modelName: string
    indexes: {keys: string[], primary: string}
    groupIndexes: {key: string, fn: Function}[] | []
    constructor(data: any, schema: ZodObject<any>, session?: SessionDataType, modelName?:string) {
        this.data = data;
        this.session = session ?? createSession();
        this.schema = schema.extend({}) // create a copy to avoid sharing schema with other instances
        this.objectSchema = ProtoSchema.load(this.schema)
        this.modelName = modelName?.toLowerCase() ?? 'unknown'
        this.idField = this.objectSchema.is('id').getLast('id') ?? 'id'
        this.indexes = {
            primary: this.idField,
            keys: this.objectSchema.is('indexed').getFields()
        }

        const groupIndexesSchema = this.objectSchema.is('groupIndex')
        const groupIndexes = groupIndexesSchema.getFields()
        this.groupIndexes = groupIndexes.map((field) => {
            return {
                key: field,
                name: groupIndexesSchema.getFieldKeyDefinition(field, 'groupName') ?? field,
                fn: groupIndexesSchema.getFieldKeyDefinition(field, 'groupCode')
            }
        })
    }

    static getClassFromDefinition(definition: any) {

        const normalizeParams = (params?: any) => {
            return (params ?? []).map(param => {
                if (typeof param !== 'string') return param
                const trimmed = param.trim()
                if (!trimmed.length) return param
                try {
                    // Evaluate literals, arrays, objects, functions, and Zod expressions referencing `z`
                    return Function('z', `"use strict"; return (${trimmed});`)(z)
                } catch (error) {
                    return param
                }
            })
        }

        const schema = Schema.object(Object.keys(definition.keys).reduce((acc, key) => {
            const element = definition.keys[key];
            let schema = z;
            if(typeof schema[element.type] !== 'function') {
                throw new Error(`Type ${element.type} does not exist on z`);
            }
            schema = schema[element.type](...normalizeParams(element.params));
            if(element.modifiers) {
                element.modifiers.forEach(modifier => {
                    const methodName = modifier.name;
                    const params = normalizeParams(modifier.params);

                    if (typeof schema[methodName] === 'function') {
                        schema = schema[methodName](...params);
                    } else {
                        throw new Error(`Modifier ${methodName} does not exist on z`);
                    }
                });
            }

            acc[key] = schema;
            return acc;
        }, {}))

        const hasId = Object.keys(schema.shape).some(key => schema.shape[key]._def.id)
        const objSchema = Schema.object({
            ...(!hasId ? BaseSchema.shape : {}),
            ...schema.shape
        });

        type objType = z.infer<typeof objSchema>;
        const objModel = AutoModel.createDerived<objType>(definition.id, objSchema, definition.apiOptions.name, definition.apiOptions.prefix);
        return objModel
    }

    get(key: string, defaultValue?) {
        return this.data[key] ?? defaultValue
    }

    static getObjectSchema() {
        return this._newInstance({}).getObjectSchema()
    }

    getObjectSchema() {
        return this.objectSchema
    }

    static getGroupIndexes() {
        return this._newInstance({}).getGroupIndexes()
    }

    getGroupIndexes() {
        return this.groupIndexes
    }

    static getIndexes() {
        return this._newInstance({}).getIndexes()
    }

    getIndexes() {
        return this.indexes
    }

    static getSchemaLinks() {
        return this._newInstance({}).getSchemaLinks()
    }

    getSchemaLinks() {
        return this.objectSchema.is('linkTo').getFields().map((field) => {
            const {linkTo, linkToId, linkToReadIds, displayKey, linkToOptions} = this.objectSchema.getFieldDefinition(field)
            return {field, linkTo, linkToId, linkToReadIds, displayKey, linkToOptions}
        })
    }

    static getObjectFields() {
        return this._newInstance({}).getObjectFields()
    }

    getObjectFields() {
        return this.objectSchema.getFields()
    }

    static getObjectFieldsDefinition() {
        return this._newInstance({}).getObjectFieldsDefinition()
    }

    getObjectFieldsDefinition() {
        return this.objectSchema.getDefinition()
    }

    static getModelName() {
        return this._newInstance({}).getModelName()
    }

    getModelName() {
        return this.modelName
    }

    getLocation() : {lat: string, lon: string, type: string, style: any, options: any} | undefined {
        const locationFields = this.objectSchema.is('location').getFields()
        if (!locationFields.length) {
            throw "Model error: " + this.getModelName() + " doesn't have location information"
        }
        const field = locationFields[0]
        const latKey = this.objectSchema.getFieldKeyDefinition(field, 'latKey')
        const lonKey = this.objectSchema.getFieldKeyDefinition(field, 'lonKey')
        if(!this.data[field]) {
            return
        }

        return {
            type: this.objectSchema.getFieldKeyDefinition(field, 'locationType'),
            style: this.objectSchema.getFieldKeyDefinition(field, 'locationStyle'),
            options: this.objectSchema.getFieldKeyDefinition(field, 'locationOptions'),
            lat: this.data[field][latKey],
            lon: this.data[field][lonKey]
        }
    }

    static getIdField() {
        return this.getObjectSchema().is('id').getLast('id') ?? 'id'
    }

    getId() {
        return this.data[this.idField]
    }

    static getSequeceField() {
        return this._newInstance({}).getSequeceField()
    }

    getSequeceField() {
        return this.objectSchema.getFields().find((field) => {
            const { sequence } = this.objectSchema.getFieldDefinition(field)
            return sequence
        })
    }

    canTransition(newData?: any): boolean {
        return true
    }

    getNotificationsTopic(action?: string | undefined): string {
        if (!action) {
            return `notifications/${this.getModelName()}/#`
        }
        return `notifications/${this.getModelName()}/${action}/${this.getId()}`
    }

    static getNotificationsTopic(): string {
        return this._newInstance({}).getNotificationsTopic()
    }

    getNotificationsPayload() {
        return this.serialize()
    }

    setId(id: string, newData?): T {
        return new (this.constructor as new (data: any, session?: SessionDataType, modelName?: string) => T)({
            ...(newData ? newData : this.data),
            [this.idField]: id
        }, this.session, this.modelName);
    }

    isVisible(): boolean {
        return true
    }

    list(search?, session?, extraData?, params?, jsCode?): any {

        if(params && params.filter) {
            const allFiltersMatch = Object.keys(params.filter).every(key => {
                if(params.filter[key].from || params.filter[key].to) {
                    let valid = true
                    if(params.filter[key].from && this.data && this.data[key] < params.filter[key].from) {
                        valid = false
                    }

                    if(params.filter[key].to && this.data && this.data[key] > params.filter[key].to) {
                        valid = false
                    }

                    return valid
                } else {
                    return this.data && this.data[key]?.toString() == params.filter[key];
                }
            });

            if(!allFiltersMatch) return
        }

        if (jsCode) {
            try {
                const fn = new Function('element', 'session', 'extraData', jsCode + "\n return filter_element(element, session, extraData);");
                const result = fn(this, session, extraData);
                if (result === false) return;
            } catch (error) {
                logger.error({ error }, `Error executing JS code: ${jsCode}`);
                return;
            }
            return this.read();
        } else if (search) {
            const { parsed, searchWithoutTags } = parseSearch(search);

            for (const [key, value] of Object.entries(parsed)) {
                if (!this.data.hasOwnProperty(key) || this.data[key] != value) {
                    //logger.debug({ data: this.data[key] }, `discarded: ${JSON.stringify(this.data[key])}`)
                    return
                }
            }

            const findMatch = (schema, data, searchTerm, path = []) => {
                for (const key in schema.shape) {
                    const value = schema.shape[key];

                    if (value._def.typeName === "ZodObject") {
                        if (findMatch(value, data[key], searchTerm, [...path, key])) return true;
                    }
                    else if (value._def.search || value._def?.innerType?._def?.search) {
                        const propValue = [...path, key].reduce((acc, key) => acc && acc[key], this.data);

                        if (propValue && propValue.toString().toLowerCase().includes(searchTerm.toLowerCase())) {
                            return true;
                        }
                    }
                }
                return false;
            };

            if (findMatch(this.objectSchema, this.data, searchWithoutTags)) {
                return this.read();
            }
        } else {
            return this.read();
        }
    }

    async listTransformed(search?, transformers = {}, session?, extraData?, params?, jsCode?): Promise<any> {
        const result = this.list(search, session, extraData, params, jsCode);
        if (result) {
            return await (this.getObjectSchema().apply('list', result, transformers));
        }
    }

    static getAdditionalDescriptions(): string {
        return '';
    }

    create(data?): T {
        const transformed = this.getData(data)
        logger.trace({ transformed }, `Creating object: ${JSON.stringify(transformed)}`)
        return (new (this.constructor as new (data: any, session?: SessionDataType, modelName?: string) => T)(transformed, this.session, this.modelName)).validate();
    }

    async createTransformed(transformers = {}): Promise<T> {
        //loop through fieldDetails keys and find the marked as autogenerate
        const newData = await this.getObjectSchema().apply('create', { ...this.data }, transformers)
        return this.create(newData);
    }

    read(extraData?): any {
        return { ...this.data }
    }

    async readTransformed(transformers = {}, extraData?): Promise<any> {
        const result = await (this.getObjectSchema().apply('read', this.read(extraData), transformers))
        return result;
    }

    update(updatedModel: T, data?: any): T {
        return updatedModel.setId(this.getId(), { ...(data ? data : updatedModel.data) });
    }

    async updateTransformed(updatedModel: T, transformers = {}): Promise<T> {
        const newData = await this.getObjectSchema().apply('update', { ...updatedModel.data }, transformers, { ...this.data })
        return this.update(updatedModel, newData);
    }

    delete(data?): T {
        return new (this.constructor as new (data: any, session?: SessionDataType, modelName?: string) => T)({
            ...(data ? data : this.data)
        }, this.session, this.modelName);
    }

    async deleteTransformed(transformers = {}): Promise<T> {
        const newData = await this.getObjectSchema().apply('delete', { ...this.data }, transformers)
        return this.delete(newData)
    }

    validate(): this {
        this.schema.parse(this.data); //validate
        return this;
    }

    serialize(raw?): string {
        return raw?this.data:JSON.stringify(this.data);
    }

    static linkTo(displayKey?: string | Function, options?:{deleteOnCascade: boolean}) {
        return this._newInstance({}).linkTo(displayKey, options)
    }

    linkTo(displayKey?: string | Function, options?:{deleteOnCascade: boolean}) {
        const apiEndPoint = (this.constructor as typeof ProtoModel).getApiEndPoint()
        return this.schema.linkTo(
            async (search, URLTransform) => {
                const url = URLTransform(apiEndPoint + (search ? '?search=' + search : ''))
                const result = await API.get(url)
                return result.data?.items ?? []
            },
            (data) => data[this.idField],
            async (link, ids, items) => {
                const response = await API.post(apiEndPoint + '?action=read_multiple', ids)
                if(response.data && response.data.length) {
                    for(const item of items) {
                        const linkId = item[link.field]
                        const linkItem = response.data.find(x => x[this.idField] == linkId)
                        if(linkItem) {
                            item[link.field] = linkItem
                        }
                    }
                }
                return items
            },
            displayKey,
            options
        )
    }

    static getApiOptions(): any {
        throw new Error("Derived class must implement getApiOptions");
    }

    protected static _newInstance(data: any, session?: SessionDataType): ProtoModel<any> {
        throw new Error("Derived class must implement _newInstance.");
    }

    static unserialize(data: string, session?: SessionDataType): ProtoModel<any> {
        return this._newInstance(JSON.parse(data), session);
    }

    static getApiEndPoint(): string {
        const options = this.getApiOptions()
        const prefix = options.prefix.endsWith('/') ? options.prefix.slice(0, -1) : options.prefix;
        return prefix + '/' + options.name;
    }

    static load(data: any, session?: SessionDataType): ProtoModel<any> {
        return this._newInstance(data??{}, session);
    }

    getData(data?): any {
        return { ...(this.getObjectSchema().applyGenerators(data ?? this.data)) }
    }
}

export abstract class AutoModel<D> extends ProtoModel<AutoModel<D>> {
    protected static schemaInstance?: ZodObject<any>;

    constructor(data: D, schema: ZodObject<any>, session?: SessionDataType, modelName?: string) {
        super(data, schema, session, modelName);
    }

    protected static _newInstance(data: any, session?: SessionDataType): AutoModel<any> {
        throw new Error("Derived class must implement _newInstance.");
    }

    static createDerived<D>(name: string, schema: ZodObject<any>, apiName?, apiPrefix?) {
        class DerivedModel extends AutoModel<D> {
            constructor(data: D, session?: SessionDataType) {
                super(data, schema, session, name.substring(0, name.length - 5).toLowerCase());
            }

            public static _newInstance(data: any, session?: SessionDataType): AutoModel<any> {
                return new DerivedModel(data, session);
            }

            public static getApiOptions() {
                return {
                    name: apiName,
                    prefix: apiPrefix
                }
            }

            public static schemaInstance = schema;
        }

        Object.defineProperty(DerivedModel, 'name', { value: name, writable: false });
        return DerivedModel;
    }
}
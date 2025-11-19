import * as Zod from 'zod'
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

initSchemaSystem()

interface ZodExtensions {
    indexed(indexFn?: Function): this;
    groupIndex(groupName?: string, groupCode?: string): this;
    linkTo(getElements: Function, getId: Function, readIds: Function, displayKey?: string | Function, options?: { deleteOnCascade: boolean }): this;
    relation(targetModel): this;
    label(caption: string): this;
    hint(hintText: string): this;
    synthesize(fn: Function): this;
    display(views?: string[] | undefined): this;
    columnWidth(width: number): this;
    hidden(views?: Array<"list" | "sheet" | "preview" | "add" | "edit">): this;
    color(): this;
    textArea(height?: number): this;
    file({ initialPath, extensions }: { initialPath?: string, extensions?: string[] }): this;
    generate(val: any, force?: boolean): this;
    before(field: string): this;
    after(field: string): this;
    datePicker(type?: 'single' | 'month' | 'year'): this; // TODO: add types: 'multiple' | 'range' 
    dependsOn(field: string, value?: any): this;
    location(latKey: string, lonKey: string, locationType?: "point" | "boxarea", locationOptions?: any, locationStyle?: any): this;
    generateOptions(call: Function): this;
    visible(visibilityCheck: Function): this;
    sequence(): this;
    choices(): this;
    secret(): this;
    static(): this;
    id(): this;
    search(searchable?: boolean): this;
    filter(display?: boolean): this;
    displayOptions(options: any): this;
    size(size: number): this; //1, 2, 3, 4...
    group(group: number): this;
    name(key: string): this;
    help(description: string): this;
    defaultValue(value: any): this;
    onList(eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any): this;
    onCreate(eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any): this;
    onRead(eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any): this;
    onUpdate(eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any): this;
    onDelete(eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any): this;
    on(eventName: string, eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any): this;
}

declare module 'zod' {
    interface ZodString extends ZodExtensions { }
    interface ZodNumber extends ZodExtensions { }
    interface ZodBoolean extends ZodExtensions { }
    interface ZodAny extends ZodExtensions { }
    //@ts-ignore
    interface ZodOptional extends ZodExtensions { }
    //@ts-ignore
    interface ZodArray extends ZodExtensions { }
    //@ts-ignore
    interface ZodUnion extends ZodExtensions { }
    //@ts-ignore
    interface ZodObject extends ZodExtensions { }
    interface ZodRecord extends ZodExtensions { }
    interface ZodDate extends ZodExtensions { }
}

export const Schema = Zod.z
// export const z = Zod.z
// export const ZodError = Zod.ZodError;
import { z } from "zod";
export * from "zod";
export { z };

(z as any).relation = function relation(model: string) {
    return z.object({
        relationId: z.string()
    }).relation(model);
};

const onEvent = (that, eventName: string, eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any) => {
    if (!that._def.events) {
        that._def.events = []
    }
    that._def.events.push({
        eventName: eventName,
        eventHandler,
        eventContext: eventContext ?? 'server',
        eventParams
    })
    return that
}

function extendZodTypePrototype(type: any) {
    type.prototype.indexed = function (indexFn?: Function) {
        this._def.indexed = true;
        this._def.indexFn = indexFn;
        return this;
    };

    type.prototype.groupIndex = function (groupName?: string, groupCode?: string) {
        this._def.groupIndex = true;
        this._def.groupName = groupName;
        this._def.groupCode = groupCode;
        return this;
    };

    type.prototype.linkTo = function (getElements, getId, readIds, getDisplayField: Function, options?: { deleteOnCascade: boolean }) {
        this._def.linkTo = getElements;
        this._def.linkToId = getId;
        this._def.linkToReadIds = readIds;
        this._def.getDisplayField = getDisplayField;
        this._def.linkToOptions = options ?? {};
        return this;
    };

    type.prototype.relation = function (targetModel: string) {
        this._def.relation = {
            model: targetModel,
        };
        return this;
    };

    type.prototype.synthesize = function (fn) {
        this._def.synthesize = fn;
        return this;
    }

    type.prototype.label = function (caption: string) {
        this._def.label = caption;
        return this;
    };

    type.prototype.hint = function (hintText: string) {
        this._def.hint = hintText;
        return this;
    };

    type.prototype.datePicker = function (type: string) {
        this._def.datePicker = type;
        this._def.coerce = true;
        return this;
    };

    type.prototype.sequence = function () {
        this._def.sequence = true;
        return this;
    };

    type.prototype.name = function (key: string) {
        this._def.keyName = key;
        return this;
    };

    type.prototype.display = function (views: string[] | undefined) {
        this._def.display = !views ? ['*'] : views;
        return this;
    };

    type.prototype.columnWidth = function (width: number) {
        this._def.columnWidth = width;
        return this;
    };

    type.prototype.hidden = function (views?: Array<"list" | "sheet" | "preview" | "add" | "edit">) {
        this._def.hidden = !views ? ['*'] : views;
        return this;
    }

    type.prototype.generate = function (val, force?) {
        this._def.generate = { generator: val, force };
        return this;
    };

    type.prototype.before = function (val) {
        this._def.before = val;
        return this;
    };

    type.prototype.after = function (val) {
        this._def.after = val;
        return this;
    };

    type.prototype.dependsOn = function (field, value) {
        this._def.dependsOn = field
        this._def.dependsOnValue = value;
        return this;
    }

    type.prototype.help = function (val) {
        this._def.help = val
        return this;
    }

    type.prototype.generateOptions = function (call) {
        this._def.generateOptions = call
        return this;
    }

    type.prototype.visible = function (fn) {
        this._def.visible = fn
        return this;
    }

    type.prototype.choices = function () {
        this._def.choices = true
        return this;
    }

    type.prototype.displayOptions = function (options) {
        this._def.displayOptions = options;
        return this;
    };

    type.prototype.secret = function () {
        this._def.secret = true;
        return this;
    };

    type.prototype.static = function () {
        this._def.static = true;
        return this;
    };

    type.prototype.id = function () {
        this._def.id = true;
        this._def.indexed = true;
        return this;
    };

    type.prototype.search = function (searchable = true) {
        this._def.search = searchable;
        return this;
    };

    type.prototype.filter = function (display = true) {
        this._def.filter = display;
        return this;
    };

    type.prototype.size = function (size) {
        this._def.size = size;
        return this;
    };

    type.prototype.color = function () {
        this._def.color = true;
        return this;
    };

    type.prototype.textArea = function (height: number = 300) {
        this._def.textArea = true;
        this._def.textAreaHeight = height;
        return this;
    };

    type.prototype.file = function ({ initialPath, extensions }) {
        this._def.file = true;
        this._def.initialPath = initialPath;
        this._def.extensions = extensions ?? ['*'];
        return this;
    };

    type.prototype.location = function (latKey, lonKey, type = 'point', options = {}, style = {}) {
        this._def.latKey = latKey;
        this._def.lonKey = lonKey;
        this._def.location = true;
        this._def.locationType = type;
        this._def.locationOptions = options;
        this._def.locationStyle = style;
        return this;
    };

    type.prototype.group = function (group: number) {
        this._def.group = group;
        return this;
    };

    type.prototype.defaultValue = function (value) {
        this._def.defaultValue = value;
        return this;
    };

    type.prototype.on = function (eventName: string, eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any) {
        return onEvent(this, eventName, eventHandler, eventContext, eventParams)
    }

    type.prototype.onList = function (eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any) {
        return onEvent(this, 'list', eventHandler, eventContext, eventParams)
    }

    type.prototype.onCreate = function (eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any) {
        return onEvent(this, 'create', eventHandler, eventContext, eventParams)
    };

    type.prototype.onRead = function (eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any) {
        return onEvent(this, 'read', eventHandler, eventContext, eventParams)
    }

    type.prototype.onUpdate = function (eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any) {
        return onEvent(this, 'update', eventHandler, eventContext, eventParams)
    }

    type.prototype.onDelete = function (eventHandler: string, eventContext?: 'client' | 'server' | undefined, eventParams?: any) {
        return onEvent(this, 'delete', eventHandler, eventContext, eventParams)
    }
}

// Extiende el prototipo general de todos los tipos de Zod
export function initSchemaSystem() {
    const zodTypes = [Zod.ZodString, Zod.ZodNumber, Zod.ZodBoolean, Zod.ZodArray, Zod.ZodAny, Zod.ZodOptional, Zod.ZodUnion, Zod.ZodObject, Zod.ZodRecord, Zod.ZodDate];
    zodTypes.forEach(type => extendZodTypePrototype(type));
}

export const BaseSchema = Schema.object({
    id: Schema.string().generate(() => moment().format('YYYYMM-DDHHmm-ssSSS') + '-' + uuidv4().split('-')[0]).hidden().id(),
})

import { ProtoModel, z, SessionDataType } from "protobase";

export const ModifiersNames = z.union([
          z.literal("id"),
          z.literal("search"),
          z.literal("filter"),
          z.literal("generate"),
          z.literal("display"),
          z.literal("optional"),
          z.literal("email"),
          z.literal("color"),
          z.literal("file"),
          z.literal("textArea"),
          z.literal("label"),
          z.literal("hint"),
          z.literal("static"),
          z.literal("min"),
          z.literal("max"),
          z.literal("secret"),
          z.literal("onCreate"),
          z.literal("onUpdate"),
          z.literal("onRead"),
          z.literal("onDelete"),
          z.literal("onList"),
          z.literal("name"),
          z.literal("picker"),
          z.literal("location")
        ])

export const BaseObjectSchema = z.object({
  id: z.string().search().id().generate((obj) => obj.name.charAt(0).toUpperCase() + obj.name.slice(1) + 'Model').hidden(),
  name: z.string().search().static(),
  features: z.any().generate({}, true).hidden(),
  keys: z.record(
    z.string().optional(),
    z.object({
      type: z.union([
        z.literal("string"),
        z.literal("number"),
        z.literal("boolean"),
        z.literal("array"),
        z.literal("object"),
        z.literal("record"),
        z.literal("union"),
        z.literal("date"), 
        z.literal("relation")
      ]),
      params: z.array(z.string()).optional(),
      modifiers: z.array(z.object({
        name: ModifiersNames,
        params: z.array(z.string()).optional()
      }).name('name')).optional()
    }).name('name'))
    .generate({}).size(2)
  // data: z.string().search(), //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
  //from: z.string().search(), // system entity where the event was generated (next, api, cmd...)
  //user: z.string().generate((obj) => 'me').search(), // the original user that generates the action, 'system' if the event originated in the system itself
})

export const ObjectSchema = z.object({
  ...BaseObjectSchema.shape
});

export type ObjectType = z.infer<typeof ObjectSchema>;

const transformData = (data) => {
  return {
    ...data,
    keys: Object.keys(data.keys ? data.keys : {}).reduce((total, k) => {
      var nK = k.replace(/\s/g, "")
      return {
        ...total,
        [nK]: {
          type: "string",
          ...data.keys[k],
        }
      };
    }, {})
  };
}

export class ObjectModel extends ProtoModel<ObjectModel> {
  constructor(data: ObjectType, session?: SessionDataType) {
    super(data, ObjectSchema, session, "Object");
  }

  getDefaultSchemaFilePath() {
    return ObjectModel.getDefaultSchemaFilePath(this.data.name, this.data.id);
  }

  static load(data: any, session?: SessionDataType): ObjectModel {
    return this._newInstance(data, session);
  }

  getSourceCode() {
    const value = this.data
    const result = "{" + Object.keys(value.keys).reduce((total, current, i) => {
      const v = value.keys[current]
      if (v.type == 'date' && (!v.modifiers || !v.modifiers.find(m => m.name == 'datePicker'))) {
        v.modifiers = [...(v?.modifiers ?? []), { name: 'datePicker', params: [] }]
      }
      const modifiers = v.modifiers ? v.modifiers.reduce((total, current) => total + '.' + current.name + "(" + (current.params && current.params.length ? current.params.join(',') : '') + ")", '') : ''
      return total + "\n\t" + current + ": " + "z." + v.type + "(" + (v.params && v.params.length ? v.params.join(',') : '') + ")" + modifiers + ","
    }, '').slice(0, -1) + "\n}"

    return result
  }

  static getDefaultSchemaFilePath(name, id = false) {
    return '/data/objects/' + name + '.ts'
  }

  create(data?) {
    const _data = data ?? this.getData();
    const obj = transformData(_data);
    return super.create(obj);
  }

  update(updatedModel, data?) {
    const _data = data ?? updatedModel.data;
    const obj = transformData(_data);
    return super.update(updatedModel, obj);
  }

  protected static _newInstance(data: any, session?: SessionDataType): ObjectModel {
    return new ObjectModel(data, session);
  }
}

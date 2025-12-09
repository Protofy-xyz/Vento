import { AutoModel, ProtoModel, Schema, SessionDataType, z } from 'protobase'

export const DeviceBoardSchema = Schema.object({
  name: z.string().hint("ESP32S3, CHUWI, Arduino UNO...").static().id().search(),
  core: z.string().hidden().search(),
  icon: z.string().optional(),
  image: z.string().optional(),
  ports: z.array(z.record(z.string(), z.any())),
  config: z.record(z.string(), z.any()),
})
export type DeviceBoardType = z.infer<typeof DeviceBoardSchema>;
export class DeviceBoardModel extends ProtoModel<DeviceBoardModel> {
  constructor(data: DeviceBoardType, session?: SessionDataType, ) {
      super(data, DeviceBoardSchema, session, "DeviceBoardModel");
  }

  public static getApiOptions() {
      return {
          name: 'deviceboards',
          prefix: '/api/core/v1/'
      }
  }

  create(data?):DeviceBoardModel {
      const result = super.create(data)
      return result
  }

  read(extraData?): DeviceBoardType {
      const result = super.read(extraData)
      return result
  }

  update(updatedModel: DeviceBoardModel, data?: DeviceBoardType): DeviceBoardModel {
      const result = super.update(updatedModel, data)
      return result
  }

  list(search?, session?, extraData?, params?): DeviceBoardType[] {
      const result = super.list(search, session, extraData, params)
      return result
  }

  delete(data?): DeviceBoardModel {
      const result = super.delete(data)
      return result
  }

  getJsArray(): string{
    const arrayPorts = this.data.ports.map((port) => {
        if(port.type === 'IO' || port.type === 'I'){
            return null;
        }
    });
    return  JSON.stringify([null,null,...arrayPorts]);
  }

  protected static _newInstance(data: any, session?: SessionDataType): DeviceBoardModel {
      return new DeviceBoardModel(data, session);
  }

  static load(data: any, session?: SessionDataType): DeviceBoardModel {
      return this._newInstance(data, session);
  }
}

import { AutoModel, Schema, z } from 'protobase'
import { DeviceBoardModel } from '../deviceBoards';

export const DeviceDefinitionSchema = Schema.object({
  name: z.string().hint("Protofy screen controller...").regex(/^[a-z0-9_]+$/, "Only lower case chars, numbers or _").static().id(),
  description: z.string().optional().label("Description").hint("Short summary of what this template is for"),
  board: DeviceBoardModel.linkTo((data) => data.name).hint("Select your board").static(),
  sdk: z.string().hidden(),
  subsystems: z.record(z.string(), z.any()).optional().hidden(),
  environment: z.string().optional().help("The environment where the definition was created").hidden().groupIndex("env"),
  config: z.record(z.string(), z.any()).optional().onCreate('getConfig').onUpdate('getConfig').hidden(),
})
export type DeviceDefinitionType = z.infer<typeof DeviceDefinitionSchema>;
export const DeviceDefinitionModel = AutoModel.createDerived<DeviceDefinitionType>("DeviceDefinitionModel", DeviceDefinitionSchema);

import { z } from "protobase";
import {SubsystemType, SubsystemSchema } from './'
export type DeviceDataType = {
    name: string,
    deviceDefinition: string,
    platform: string,
    subsystem: SubsystemType[],
}


export const DeviceSchema = z.object({
    name: z.string(),
    deviceDefinition: z.string(),
    platform: z.string(),
    subsystem: z.array(SubsystemSchema),
})
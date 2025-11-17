import { deepClone } from './utils'

export type I2CBusBuildResult = {
  components: any[]
  busIds: string[]
}

export const buildI2CBusComponents = (i2cConfig: any): I2CBusBuildResult => {
  if (!i2cConfig) return { components: [], busIds: [] }
  const i2cConfigs = Array.isArray(i2cConfig) ? i2cConfig : [i2cConfig]

  const components: any[] = []
  const busIds: string[] = []

  i2cConfigs.forEach((bus, idx) => {
    const busId = bus.id || `i2c_bus${idx === 0 ? "" : idx + 1}`;
    busIds.push(busId)

    components.push({
      id: `I2C-Bus${idx === 0 ? "" : idx + 1}`,
      type: 'device',
      label: `I2C Bus${idx === 0 ? "" : idx + 1}`,
      category: 'i2c-bus',
      meta: {
        kind: 'i2c-bus',
        raw: deepClone(bus),
        busId,
      },
      pins: {
        left: [
          {
            name: 'SDA',
            description: 'SDA pin of I2C bus',
            connectedTo: bus.sda !== undefined ? `GPIO${bus.sda}` : null,
            type: 'input',
          },
          {
            name: 'SCL',
            description: 'SCL pin of I2C bus',
            connectedTo: bus.scl !== undefined ? `GPIO${bus.scl}` : null,
            type: 'input',
          },
        ],
        right: [
          {
            name: busId,
            description: 'I2C bus',
            connectedTo: null,
            type: 'output',
          },
        ],
      },
    })
  })

  return { components, busIds }
}

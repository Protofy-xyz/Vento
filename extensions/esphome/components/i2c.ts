import { deepClone } from './utils'
import type { ComponentTemplate, ComponentTemplateContext } from './templateTypes'
import { normalizeGpioHandle, extractPinNumber } from './templateHelpers'

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

export const buildI2CTemplate = (
  context: ComponentTemplateContext
): ComponentTemplate => {
  const i2cBusIndex = (context.componentCounts['i2c-bus'] || 0) + 1
  return {
    label: 'Bus I2C',
    description: 'Crea un bus I2C con SDA/SCL y salida compartida.',
    fields: [
      { name: 'id', label: 'ID interno', type: 'text', required: true },
      {
        name: 'label',
        label: 'Nombre visible',
        type: 'text',
        placeholder: `I2C Bus ${i2cBusIndex}`,
      },
      {
        name: 'busId',
        label: 'Nombre del bus (i2c_id)',
        type: 'text',
        required: true,
        placeholder: `i2c_bus${i2cBusIndex}`,
      },
      {
        name: 'sda',
        label: 'GPIO SDA',
        type: 'text',
        required: true,
        placeholder: 'GPIO21',
        useConnectionDatalist: true,
      },
      {
        name: 'scl',
        label: 'GPIO SCL',
        type: 'text',
        required: true,
        placeholder: 'GPIO22',
        useConnectionDatalist: true,
      },
    ],
    defaults: {
      id: context.ensureUniqueId(`I2C-Bus${i2cBusIndex}`),
      label: `I2C Bus ${i2cBusIndex}`,
      busId: `i2c_bus${i2cBusIndex}`,
      sda: '',
      scl: '',
    },
    build: (values, helpers) => {
      const id = helpers.ensureUniqueId(values.id || `I2C-Bus${i2cBusIndex}`)
      const label = values.label || `I2C Bus ${i2cBusIndex}`
      const busId = values.busId || `i2c_bus${i2cBusIndex}`
      const sda = normalizeGpioHandle(values.sda)
      const scl = normalizeGpioHandle(values.scl)
      return {
        id,
        type: 'device',
        label,
        category: 'i2c-bus',
        meta: {
          kind: 'i2c-bus',
          raw: {
            id: busId,
            sda: extractPinNumber(sda),
            scl: extractPinNumber(scl),
          },
          busId,
        },
        pins: {
          left: [
            {
              name: 'SDA',
              description: 'SDA pin of I2C bus',
              connectedTo: sda,
              type: 'input',
            },
            {
              name: 'SCL',
              description: 'SCL pin of I2C bus',
              connectedTo: scl,
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
      }
    },
  }
}

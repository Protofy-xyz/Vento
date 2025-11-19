import { deepClone } from './utils'
import type { ComponentTemplate, ComponentTemplateContext } from './templateTypes'

export const buildADXLComponents = (adxlConfig: any, i2cBuses: string[]): any[] => {
  if (!adxlConfig) return []
  const sensors = Array.isArray(adxlConfig) ? adxlConfig : [adxlConfig]

  return sensors.map((sensor, idx) => {
    const busUsed = sensor.i2c_id || i2cBuses[0] || 'i2c_bus'
    return {
      id: `ADXL${idx === 0 ? "" : idx + 1}`,
      type: 'device',
      label: `Accelerometer ADXL${idx === 0 ? "" : idx + 1}`,
      category: 'adxl345',
      meta: {
        kind: 'adxl345',
        raw: deepClone(sensor),
      },
      pins: {
        left: [
          {
            name: 'i2c_bus',
            description: 'I2C bus',
            connectedTo: busUsed,
          },
        ],
        right: [],
      },
    }
  })
}

export const buildADXLTemplate = (
  context: ComponentTemplateContext
): ComponentTemplate => {
  const adxlIndex = (context.componentCounts['adxl345'] || 0) + 1
  const firstBus = context.availableI2CBuses[0] || 'i2c_bus'
  return {
    label: 'Sensor ADXL345',
    description: 'I2C-based accelerometer sensor.',
    fields: [
      { name: 'id', label: 'Internal ID', type: 'text', required: true },
      { name: 'label', label: 'Display name', type: 'text' },
      {
        name: 'i2c_id',
        label: 'I2C bus',
        type: 'text',
        suggestions: context.availableI2CBuses,
        placeholder: firstBus,
      },
    ],
    defaults: {
      id: context.ensureUniqueId(`ADXL${adxlIndex}`),
      label: `Accelerometer ADXL${adxlIndex}`,
      i2c_id: firstBus,
    },
    build: (values, helpers) => {
      const id = helpers.ensureUniqueId(values.id || `ADXL${adxlIndex}`)
      const label = values.label || `Accelerometer ${id}`
      const i2cTarget = values.i2c_id || helpers.availableI2CBuses[0] || 'i2c_bus'
      return {
        id,
        type: 'device',
        label,
        category: 'adxl345',
        meta: {
          kind: 'adxl345',
          raw: {
            id,
            name: label,
            i2c_id: i2cTarget,
          },
        },
        pins: {
          left: [
            {
              name: 'i2c_bus',
              description: 'I2C bus',
              connectedTo: i2cTarget,
            },
          ],
          right: [],
        },
      }
    },
  }
}

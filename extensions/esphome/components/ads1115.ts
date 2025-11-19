import { deepClone } from './utils'
import type { ComponentTemplate, ComponentTemplateContext } from './templateTypes'

const getADS1115ComponentId = (sensor: any, idx: number) =>
  sensor?.id && typeof sensor.id === 'string'
    ? sensor.id
    : `ADS1115_${idx === 0 ? '' : idx + 1}`

export const buildADS1115Components = (adsConfig: any, i2cBuses: string[]): any[] => {
  if (!adsConfig) return []
  const sensors = Array.isArray(adsConfig) ? adsConfig : [adsConfig]
  return sensors.map((sensor, idx) => {
    const busUsed = sensor?.i2c_id || i2cBuses[0] || 'i2c_bus'
    const componentId = getADS1115ComponentId(sensor, idx)
    const label = sensor?.name || `ADC ADS1115${idx === 0 ? '' : idx + 1}`
    return {
      id: componentId,
      type: 'device',
      label,
      category: 'ads1115',
      meta: {
        kind: 'ads1115',
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

export const buildADS1115Subsystems = (adsConfig: any): any[] => {
  if (!adsConfig) return []
  const sensors = Array.isArray(adsConfig) ? adsConfig : [adsConfig]

  const channelMonitor = (baseName: string, channel: number) => ({
    label: `Channel ${channel}`,
    name: `${baseName}_channel_${channel}`,
    description: `Get A${channel} sensor status`,
    endpoint: `/sensor/${baseName}_channel_${channel}/state`,
    connectionType: 'mqtt',
  })

  return sensors.map((sensor, idx) => {
    const componentId = getADS1115ComponentId(sensor, idx)
    const baseName = sensor?.id || componentId
    return {
      componentId,
      name: baseName,
      type: 'sensor',
      monitors: [0, 1, 2, 3].map((channel) => channelMonitor(baseName, channel)),
    }
  })
}

export const buildADS1115Template = (
  context: ComponentTemplateContext
): ComponentTemplate => {
  const adsIndex = (context.componentCounts['ads1115'] || 0) + 1
  const firstBus = context.availableI2CBuses[0] || 'i2c_bus'
  return {
    label: 'ADC ADS1115',
    description: 'Analog-to-digital converter over I2C.',
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
      {
        name: 'address',
        label: 'I2C address',
        type: 'text',
        placeholder: '0x48',
      },
    ],
    defaults: {
      id: context.ensureUniqueId(`ADS1115_${adsIndex}`),
      label: `ADC ADS1115${adsIndex}`,
      i2c_id: firstBus,
      address: '0x48',
    },
    build: (values, helpers) => {
      const id = helpers.ensureUniqueId(values.id || `ADS1115_${adsIndex}`)
      const label = values.label || `ADS1115 ${id}`
      const i2cTarget = values.i2c_id || helpers.availableI2CBuses[0] || 'i2c_bus'
      return {
        id,
        type: 'device',
        label,
        category: 'ads1115',
        meta: {
          kind: 'ads1115',
          raw: {
            id,
            name: label,
            i2c_id: i2cTarget,
            address: values.address || '0x48',
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

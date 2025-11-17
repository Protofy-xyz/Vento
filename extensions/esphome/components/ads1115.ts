import { deepClone } from './utils'

export const buildADS1115Components = (adsConfig: any, i2cBuses: string[]): any[] => {
  if (!adsConfig) return []
  const sensors = Array.isArray(adsConfig) ? adsConfig : [adsConfig]
  return sensors.map((sensor, idx) => {
    const busUsed = sensor.i2c_id || i2cBuses[0] || 'i2c_bus'
    return {
      id: `ADS1115_${idx === 0 ? "" : idx + 1}`,
      type: 'device',
      label: `ADC ADS1115${idx === 0 ? "" : idx + 1}`,
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

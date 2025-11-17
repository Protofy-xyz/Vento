import { deepClone } from './utils'

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

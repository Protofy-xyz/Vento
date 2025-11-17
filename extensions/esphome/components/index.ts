import { buildSwitchComponents, buildSwitchSubsystems } from './switches'
import { buildUARTComponents } from './uart'
import { buildI2CBusComponents } from './i2c'
import { buildADXLComponents } from './adxl'
import { buildADS1115Components, buildADS1115Subsystems } from './ads1115'
import { deepClone, toNumberFromGpio } from './utils'

export type ComponentBuilderResult = {
  components: any[]
  data?: Record<string, any>
  subsystems?: any[]
}

export type ComponentBuilder = {
  key: string
  build: (config: any, context: Record<string, any>) => ComponentBuilderResult
}

const builders: ComponentBuilder[] = [
  {
    key: 'switch',
    build: (config) => ({
      components: buildSwitchComponents(config),
      subsystems: buildSwitchSubsystems(config),
    }),
  },
  {
    key: 'uart',
    build: (config) => ({
      components: buildUARTComponents(config),
    }),
  },
  {
    key: 'i2c',
    build: (config) => {
      const result = buildI2CBusComponents(config)
      return { components: result.components, data: { busIds: result.busIds } }
    },
  },
  {
    key: 'adxl345',
    build: (config, context) => ({
      components: buildADXLComponents(config, context.i2c?.busIds || []),
    }),
  },
  {
    key: 'ads1115',
    build: (config, context) => ({
      components: buildADS1115Components(config, context.i2c?.busIds || []),
      subsystems: buildADS1115Subsystems(config),
    }),
  },
]

export {
  builders as componentBuilders,
  buildSwitchComponents,
  buildUARTComponents,
  buildI2CBusComponents,
  buildADXLComponents,
  buildADS1115Components,
  buildADS1115Subsystems,
  deepClone,
  toNumberFromGpio,
}

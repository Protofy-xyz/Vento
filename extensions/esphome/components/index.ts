import { buildESPBoardComponents } from './boards'
import {
  buildSwitchComponents,
  buildSwitchSubsystems,
  buildSwitchTemplate,
} from './switches'
import { buildUARTComponents, buildUARTTemplate } from './uart'
import { buildI2CBusComponents, buildI2CTemplate } from './i2c'
import { buildADXLComponents, buildADXLTemplate } from './adxl'
import {
  buildADS1115Components,
  buildADS1115Subsystems,
  buildADS1115Template,
} from './ads1115'
import { deepClone, toNumberFromGpio } from './utils'
import type { ComponentTemplate, ComponentTemplateContext } from './templateTypes'

export type ComponentBuilderResult = {
  components: any[]
  data?: Record<string, any>
  subsystems?: any[]
  template?: any
}

export type ComponentBuilder = {
  key: string
  build: (
    config: any,
    context: Record<string, any>,
    templateContext?: ComponentTemplateContext
  ) => ComponentBuilderResult
}

const builders: ComponentBuilder[] = [
  {
    key: 'esp32',
    build: (config) => ({
      components: buildESPBoardComponents(config),
    }),
  },
  {
    key: 'switch',
    build: (config, _context, templateContext) => ({
      components: buildSwitchComponents(config),
      subsystems: buildSwitchSubsystems(config),
      template: templateContext ? buildSwitchTemplate(templateContext) : undefined,
    }),
  },
  {
    key: 'uart',
    build: (config, _context, templateContext) => ({
      components: buildUARTComponents(config),
      template: templateContext ? buildUARTTemplate(templateContext) : undefined,
    }),
  },
  {
    key: 'i2c',
    build: (config, _context, templateContext) => {
      const result = buildI2CBusComponents(config)
      return {
        components: result.components,
        data: { busIds: result.busIds },
        template: templateContext ? buildI2CTemplate(templateContext) : undefined,
      }
    },
  },
  {
    key: 'adxl345',
    build: (config, context, templateContext) => ({
      components: buildADXLComponents(config, context.i2c?.busIds || []),
      template: templateContext ? buildADXLTemplate(templateContext) : undefined,
    }),
  },
  {
    key: 'ads1115',
    build: (config, context, templateContext) => ({
      components: buildADS1115Components(config, context.i2c?.busIds || []),
      subsystems: buildADS1115Subsystems(config),
      template: templateContext ? buildADS1115Template(templateContext) : undefined,
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
  buildSwitchTemplate,
  buildUARTTemplate,
  buildI2CTemplate,
  buildADXLTemplate,
  buildADS1115Template,
  buildADS1115Subsystems,
  buildESPBoardComponents,
  deepClone,
  toNumberFromGpio,
}

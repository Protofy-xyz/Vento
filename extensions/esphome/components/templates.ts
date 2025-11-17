import type { ComponentTemplate, ComponentTemplateContext } from './templateTypes'
import { componentBuilders } from './index'

export const buildComponentTemplates = (
  context: ComponentTemplateContext
): Record<string, ComponentTemplate> => {
  return componentBuilders.reduce<Record<string, ComponentTemplate>>((acc, builder) => {
    const result = builder.build(undefined, {}, context)
    if (result.template) {
      acc[builder.key] = result.template
    }
    return acc
  }, {})
}

export * from './templateTypes'


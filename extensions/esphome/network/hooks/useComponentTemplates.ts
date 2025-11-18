import { useCallback, useMemo } from 'react'
import { buildComponentTemplates } from '@extensions/esphome/components/templates'
import type { ComponentTemplate } from '@extensions/esphome/components/templates'

type ComponentCounts = Record<string, number>

export const useComponentTemplates = (
  components: any[]
): {
  ensureUniqueId: (baseId: string) => string
  availableI2CBuses: string[]
  componentTemplates: Record<string, ComponentTemplate>
  componentCounts: ComponentCounts
} => {
  const componentCounts = useMemo<ComponentCounts>(() => {
    return components.reduce<ComponentCounts>((acc, component) => {
      acc[component.category] = (acc[component.category] || 0) + 1
      return acc
    }, {})
  }, [components])

  const availableI2CBuses = useMemo(() => {
    return components
      .filter((component) => component.category === 'i2c-bus')
      .map(
        (component) =>
          component.meta?.busId || component.pins?.right?.[0]?.name || component.id
      )
      .filter(Boolean)
  }, [components])

  const ensureUniqueId = useCallback(
    (baseId: string) => {
      const trimmed = baseId && baseId.trim() ? baseId.trim() : `Device${components.length + 1}`
      if (!components.some((component) => component.id === trimmed)) {
        return trimmed
      }
      let index = 2
      while (components.some((component) => component.id === `${trimmed}${index}`)) {
        index += 1
      }
      return `${trimmed}${index}`
    },
    [components]
  )

  const componentTemplates = useMemo<Record<string, ComponentTemplate>>(
    () =>
      buildComponentTemplates({
        componentCounts,
        ensureUniqueId,
        availableI2CBuses,
      }),
    [availableI2CBuses, componentCounts, ensureUniqueId]
  )

  return {
    ensureUniqueId,
    availableI2CBuses,
    componentTemplates,
    componentCounts,
  }
}


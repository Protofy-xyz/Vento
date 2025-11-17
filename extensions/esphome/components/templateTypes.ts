export type TemplateField = {
  name: string
  label: string
  type: 'text' | 'number' | 'boolean'
  required?: boolean
  placeholder?: string
  description?: string
  suggestions?: string[]
  useConnectionDatalist?: boolean
}

export type TemplateHelpers = {
  ensureUniqueId: (baseId: string) => string
  availableI2CBuses: string[]
}

export type ComponentTemplate = {
  label: string
  description?: string
  fields: TemplateField[]
  defaults: Record<string, any>
  build: (values: Record<string, any>, helpers: TemplateHelpers) => any
}

export type ComponentTemplateContext = TemplateHelpers & {
  componentCounts: Record<string, number>
}

export type ComponentTemplateBuilder = {
  key: string
  build: any
}

import React, { useMemo } from 'react'
import type {
  ComponentTemplate,
  TemplateField,
} from '@extensions/esphome/components/templates'
import { Button, Input, Text, YStack } from '@my/ui'
import { SelectList } from "protolib/components/SelectList";

type AddComponentFormProps = {
  componentTemplates: Record<string, ComponentTemplate>
  newComponentType: string
  onComponentTypeChange: (value: string) => void
  selectedTemplate?: ComponentTemplate
  mergedNewComponentValues: Record<string, any>
  onFieldChange: (field: TemplateField, rawValue: any) => void
  onAddComponent: () => void
  canAddComponent: boolean
  connectionOptions?: string[]
}

const AddComponentForm = ({
  componentTemplates,
  newComponentType,
  onComponentTypeChange,
  selectedTemplate,
  mergedNewComponentValues,
  onFieldChange,
  onAddComponent,
  canAddComponent,
  connectionOptions = [],
}: AddComponentFormProps) => {
  const sanitizedConnectionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (connectionOptions || []).filter(
            (option): option is string =>
              typeof option === 'string' && option.trim().length > 0
          )
        )
      ),
    [connectionOptions]
  )

  const buildConnectionSelectElements = (connectedTo?: string | null) => {
    const elements = sanitizedConnectionOptions.map((option) => ({
      value: option,
      caption: option,
    }))

    const hasConnectedValue =
      !!connectedTo && sanitizedConnectionOptions.includes(connectedTo)

    if (connectedTo && !hasConnectedValue) {
      elements.push({ value: connectedTo, caption: connectedTo })
    }

    return [{ value: '', caption: 'Sin conexión' }, ...elements]
  }

  return (
    <YStack gap="$2">
      <Text marginBottom="$3">Add Component</Text>
      <SelectList
        title="Component Type"
        triggerProps={{ backgroundColor: "transparent", borderColor: "var(--gray6)" }}
        elements={Object.entries(componentTemplates).map(([key, template]) => ({ caption: template.label, value: key }))}
        value={newComponentType}
        setValue={onComponentTypeChange}
      />
      {newComponentType && selectedTemplate && (
        <YStack gap="$4">
          {selectedTemplate.description && (
            <Text fontSize="$3" color="$gray9">{selectedTemplate.description}</Text>
          )}
          {selectedTemplate.fields.map((field) => {
            const value = mergedNewComponentValues[field.name] ?? ''
            if (field.type === 'boolean') {
              return (
                <label
                  key={field.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(event) => onFieldChange(field, event.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              )
            }

            const datalistId =
              !field.useConnectionDatalist && field.suggestions
                ? `suggestions-${newComponentType}-${field.name}`
                : undefined

            return (
              <YStack key={field.name} gap="$2">
                <Text fontSize="$2" fontWeight="500" paddingLeft="$2">
                  {field.label}
                  {field.required && <span style={{ color: 'var(--color8)' }}> *</span>}
                </Text>
                {field.useConnectionDatalist ? (
                  <SelectList
                    title={`Conexiones para ${field.label}`}
                    elements={buildConnectionSelectElements(value)}
                    value={value}
                    setValue={(selected) => onFieldChange(field, selected)}
                    placeholder={field.placeholder || 'Selecciona un pin o bus'}
                    triggerProps={{
                      backgroundColor: 'transparent',
                      borderColor: 'var(--gray6)',
                      width: '100%',
                    }}
                    selectorStyle={{ normal: { width: '100%' } }}
                  />
                ) : (
                  <Input
                    value={value}
                    placeholder={field.placeholder}
                    placeholderTextColor="$gray9"
                    onChangeText={(text) => onFieldChange(field, text)}
                    backgroundColor="tranparent"
                    borderColor="$gray6"
                    width="100%"
                    {...(datalistId ? { list: datalistId } : {})}
                  />
                )}
                {(field.description ||
                  (field.useConnectionDatalist && 'Selecciona el destino de este pin.')) && (
                    <small style={{ opacity: 0.7 }}>
                      {field.description || 'Selecciona el destino de este pin.'}
                    </small>
                  )}
                {field.suggestions && datalistId && (
                  <datalist id={datalistId}>
                    {field.suggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                )}
              </YStack>
            )
          })}
          <Button
            onPress={onAddComponent}
            disabled={!canAddComponent}
            width="100%"
            backgroundColor={canAddComponent ? "$color7" : "$gray5"}
          >
            Add Component
          </Button>
        </YStack>
      )}
    </YStack>
  )
}

export default AddComponentForm


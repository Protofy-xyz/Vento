import React from 'react'
import type {
  ComponentTemplate,
  TemplateField,
} from '@extensions/esphome/components/templates'
import { Button, Input, Switch, Text, TooltipSimple, XStack, YStack } from '@my/ui'
import { SelectList } from "protolib/components/SelectList";
import ConnectionSelect from './ConnectionSelect'

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
  return (
    <YStack gap="$2" enterStyle={{ opacity: 0.5, right: -10 }} right={0} animation={"bouncy"} exitStyle={{ opacity: 0.5 }} >
      <Text marginBottom="$3">Add Component</Text>
      <SelectList
        title="Component Type"
        triggerProps={{ backgroundColor: "transparent", borderColor: "var(--gray6)" }}
        elements={Object.entries(componentTemplates).map(([key, template]) => ({ caption: template.label, value: key }))}
        value={newComponentType}
        setValue={onComponentTypeChange}
      />
      {
        newComponentType && selectedTemplate && (
          <YStack gap="$4">
            {selectedTemplate.description && (
              <Text fontSize="$3" color="$gray9">{selectedTemplate.description}</Text>
            )}
            {selectedTemplate.fields.map((field) => {
              const value = mergedNewComponentValues[field.name] ?? ''
              if (field.type === 'boolean') {
                return (
                  <TooltipSimple key={field.name} label={field.description || ''} delay={{ open: 500, close: 0 }} restMs={0}>
                    <XStack justifyContent='space-between' alignItems='center' key={field.label} width='100%'>
                      <Text fontSize="$2" fontWeight="500" paddingLeft="$2" marginRight="$3">
                        {field.label}
                        {field.required && <span style={{ color: 'var(--color8)' }}> *</span>}
                      </Text>
                      <Switch
                        key={field.name}
                        size="$3"
                        onCheckedChange={(v) => onFieldChange(field, v)}
                        checked={!!value}
                      >
                        <Switch.Thumb />
                      </Switch>
                    </XStack>
                  </TooltipSimple>
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
                    <ConnectionSelect
                      title={`Conexiones para ${field.label}`}
                      value={value}
                      onValueChange={(selected) => onFieldChange(field, selected)}
                      placeholder={field.placeholder || 'Selecciona un pin o bus'}
                      connectionOptions={connectionOptions}
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
                  {/* {(field.description ||
                  (field.useConnectionDatalist && 'Selecciona el destino de este pin.')) && (
                    <small style={{ opacity: 0.7 }}>
                      {field.description || 'Selecciona el destino de este pin.'}
                    </small>
                  )} */}
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
        )
      }
    </YStack >
  )
}

export default AddComponentForm


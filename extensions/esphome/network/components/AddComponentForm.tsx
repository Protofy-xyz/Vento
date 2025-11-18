import React from 'react'
import type {
  ComponentTemplate,
  TemplateField,
} from '@extensions/esphome/components/templates'

type AddComponentFormProps = {
  componentTemplates: Record<string, ComponentTemplate>
  newComponentType: string
  onComponentTypeChange: (value: string) => void
  selectedTemplate?: ComponentTemplate
  mergedNewComponentValues: Record<string, any>
  onFieldChange: (field: TemplateField, rawValue: any) => void
  onAddComponent: () => void
  canAddComponent: boolean
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
}: AddComponentFormProps) => {
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 12,
        borderTop: '1px solid var(--gray6)',
      }}
    >
      <h4 style={{ margin: '0 0 8px 0' }}>Añadir componente</h4>
      <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tipo</label>
      <select
        value={newComponentType}
        onChange={(event) => onComponentTypeChange(event.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid var(--gray6)',
          background: 'var(--bg)',
          color: 'var(--color)',
          marginBottom: 10,
        }}
      >
        <option value="">Selecciona un tipo</option>
        {Object.entries(componentTemplates).map(([key, template]) => (
          <option value={key} key={key}>
            {template.label}
          </option>
        ))}
      </select>
      {newComponentType && selectedTemplate && (
        <div style={{ fontSize: 12 }}>
          {selectedTemplate.description && (
            <p style={{ marginTop: 0, marginBottom: 8 }}>{selectedTemplate.description}</p>
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

            const datalistId = field.suggestions
              ? `suggestions-${newComponentType}-${field.name}`
              : undefined
            const inputProps: Record<string, string> = {}
            if (field.useConnectionDatalist) {
              inputProps.list = 'network-graph-connection-options'
            } else if (datalistId) {
              inputProps.list = datalistId
            }

            return (
              <div key={field.name} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                  {field.label}
                  {field.required && <span style={{ color: 'var(--color8)' }}> *</span>}
                </label>
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(event) => onFieldChange(field, event.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--gray6)',
                    background: 'var(--bg)',
                    color: 'var(--color)',
                  }}
                  {...inputProps}
                />
                {field.description && <small style={{ opacity: 0.7 }}>{field.description}</small>}
                {field.suggestions && datalistId && (
                  <datalist id={datalistId}>
                    {field.suggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                )}
              </div>
            )
          })}
          <button
            onClick={onAddComponent}
            disabled={!canAddComponent}
            style={{
              width: '100%',
              marginTop: 4,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              cursor: canAddComponent ? 'pointer' : 'not-allowed',
              background: canAddComponent ? 'var(--color8)' : 'var(--gray6)',
              color: 'var(--softContrast)',
              fontWeight: 600,
            }}
          >
            Añadir
          </button>
        </div>
      )}
    </div>
  )
}

export default AddComponentForm


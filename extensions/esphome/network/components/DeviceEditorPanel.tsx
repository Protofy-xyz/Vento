import React from 'react'

type DeviceEditorPanelProps = {
  selectedComponent?: any
  onLabelChange: (componentId: string, label: string) => void
  onEditablePropChange: (componentId: string, propKey: string, value: any) => void
  onPinFieldChange: (
    componentId: string,
    side: 'left' | 'right',
    pinName: string,
    value: string
  ) => void
  componentSubsystems: any[]
  subsystemActionStatus: Record<
    string,
    {
      state: 'idle' | 'loading' | 'success' | 'error'
      message?: string
    }
  >
  onSubsystemAction: (subsystemName: string, action: any) => void
  deviceName?: string
}

const DeviceEditorPanel = ({
  selectedComponent,
  onLabelChange,
  onEditablePropChange,
  onPinFieldChange,
  componentSubsystems,
  subsystemActionStatus,
  onSubsystemAction,
  deviceName,
}: DeviceEditorPanelProps) => {
  if (!selectedComponent) {
    return (
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Selecciona un nodo para ver sus propiedades y realizar cambios.
      </p>
    )
  }

  return (
    <>
      <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nombre visible</label>
      <input
        type="text"
        value={selectedComponent.label || ''}
        onChange={(event) => onLabelChange(selectedComponent.id, event.target.value)}
        style={{
          width: '100%',
          marginBottom: 12,
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid var(--gray6)',
          background: 'var(--bg)',
          color: 'var(--color)',
        }}
      />
      {selectedComponent.editableProps &&
        Object.entries(selectedComponent.editableProps).map(([propKey, prop]: any) => {
          const type = prop.type || 'text'
          const value = prop.default ?? ''
          return (
            <div key={propKey} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                {prop.label || propKey}
              </label>
              {type === 'boolean' ? (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(event) =>
                      onEditablePropChange(selectedComponent.id, propKey, event.target.checked)
                    }
                  />
                  <span>{prop.description}</span>
                </label>
              ) : (
                <input
                  type={type === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={(event) => {
                    const rawValue = event.target.value
                    const nextValue =
                      type === 'number'
                        ? rawValue === ''
                          ? ''
                          : Number(rawValue)
                        : rawValue
                    onEditablePropChange(selectedComponent.id, propKey, nextValue)
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--gray6)',
                    background: 'var(--bg)',
                    color: 'var(--color)',
                  }}
                />
              )}
            </div>
          )
        })}
      {(selectedComponent.pins?.left?.length || selectedComponent.pins?.right?.length) && (
        <>
          <label style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Conexiones</label>
          {([
            ['left', selectedComponent.pins?.left],
            ['right', selectedComponent.pins?.right],
          ] as const).map(([side, pins]) =>
            (pins || []).map((pin: any) => (
              <div key={`${side}-${pin.name}`} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, marginBottom: 2 }}>{pin.name}</div>
                <input
                  list="network-graph-connection-options"
                  value={pin.connectedTo || ''}
                  onChange={(event) =>
                    onPinFieldChange(
                      selectedComponent.id,
                      side,
                      pin.name,
                      event.target.value
                    )
                  }
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--gray6)',
                    background: 'var(--bg)',
                    color: 'var(--color)',
                  }}
                />
              </div>
            ))
          )}
        </>
      )}
      {componentSubsystems.length ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: 'var(--bg3)',
            border: '1px solid var(--gray6)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Subsistemas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {componentSubsystems.map((subsystem: any) => (
              <div
                key={subsystem.id || subsystem.name}
                style={{ fontSize: 12, borderBottom: '1px solid var(--gray5)', paddingBottom: 8 }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {subsystem.label || subsystem.name || subsystem.id}
                </div>
                {subsystem.description && (
                  <div style={{ fontSize: 11, marginBottom: 6, opacity: 0.8 }}>
                    {subsystem.description}
                  </div>
                )}
                {subsystem.actions?.length ? (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>Acciones</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {subsystem.actions.map((action: any) => {
                        const key = `${subsystem.name}:${action.name}`
                        const status = subsystemActionStatus[key]?.state || 'idle'
                        const isLoading = status === 'loading'
                        const message = subsystemActionStatus[key]?.message
                        return (
                          <div key={action.name}>
                            <button
                              disabled={isLoading}
                              onClick={() => onSubsystemAction(subsystem.name, action)}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: isLoading ? 'var(--gray5)' : 'var(--color8)',
                                color: isLoading ? 'var(--gray10)' : 'var(--softContrast)',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              {(action.label || action.name || 'Acción') +
                                (isLoading ? '...' : '')}
                            </button>
                            {action.description && (
                              <div style={{ fontSize: 11, marginTop: 2 }}>
                                {action.description}
                              </div>
                            )}
                            {message && (
                              <div
                                style={{
                                  fontSize: 11,
                                  marginTop: 2,
                                  color:
                                    status === 'error' ? 'var(--red10)' : 'var(--green10)',
                                }}
                              >
                                {message}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {!deviceName && (
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
                        Define `esphome.name` para habilitar las acciones.
                      </div>
                    )}
                  </div>
                ) : null}
                {subsystem.monitors?.length ? (
                  <div style={{ fontSize: 11 }}>
                    <span style={{ fontWeight: 600 }}>Monitores:</span>{' '}
                    {subsystem.monitors
                      .map(
                        (monitor: any) =>
                          monitor.label || monitor.name || `Monitor ${monitor?.id}`
                      )
                      .join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

export default DeviceEditorPanel

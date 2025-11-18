import { Button, Input, Text, TooltipSimple, XStack, YStack } from '@my/ui'
import React, { useMemo } from 'react'
import { SelectList } from 'protolib/components/SelectList'

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
  connectionOptions?: string[]
}


const CustomInput = (props: any) => {
  return <Input
    backgroundColor="transparent"
    width="100%"
    borderColor="$gray6"
    placeholderTextColor="$gray6"
    {...props}
  />
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
  connectionOptions = [],
}: DeviceEditorPanelProps) => {
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

  const buildPinSelectElements = (connectedTo?: string | null) => {
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

  if (!selectedComponent) {
    return (
      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Selecciona un nodo para ver sus propiedades y realizar cambios.
      </p>
    )
  }

  return (
    <>
      <CustomInput
        padding="$0"
        paddingLeft="$2"
        placeholder='Label'
        fontWeight="600"
        fontSize="$6"
        borderWidth={0}
        value={selectedComponent.label || ''}
        hoverStyle={{
          shadowColor: 'var(--gray9)',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 2,
        }}
        onChangeText={(value) => onLabelChange(selectedComponent.id, value)}
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
      {(selectedComponent.pins?.left?.length || selectedComponent.pins?.right?.length) ? (
        <>
          <Text>Connections</Text>
          {([
            ['left', selectedComponent.pins?.left],
            ['right', selectedComponent.pins?.right],
          ] as const).map(([side, pins]) =>
            (pins || []).map((pin: any) => (
              <div key={`${side}-${pin.name}`} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, marginBottom: 2 }}>{pin.name}</div>
                <SelectList
                  title={`Conexiones para ${pin.name}`}
                  elements={buildPinSelectElements(pin.connectedTo)}
                  value={pin.connectedTo || ''}
                  setValue={(value) =>
                    onPinFieldChange(selectedComponent.id, side, pin.name, value)
                  }
                  placeholder="Selecciona un pin o bus"
                  triggerProps={{
                    backgroundColor: 'transparent',
                    borderColor: 'var(--gray6)',
                    width: '100%',
                  }}
                  selectorStyle={{ normal: { width: '100%' } }}
                />
                <Text fontSize="$1" color="$gray9" paddingLeft="$2">
                  {pin.description || 'Selecciona el destino de este pin.'}
                </Text>
              </div>
            ))
          )}
        </>
      ) : null}
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
          <Text>Subsystems</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {componentSubsystems.map((subsystem: any) => (
              <div
                key={subsystem.id || subsystem.name}
                style={{ fontSize: 12, borderBottom: '1px solid var(--gray5)', paddingBottom: 8 }}
              >
                {/* <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {subsystem.label || subsystem.name || subsystem.id}
                </div> */}
                {/* {subsystem.description && (
                  <div style={{ fontSize: 11, marginBottom: 6, opacity: 0.8 }}>
                    {subsystem.description}
                  </div>
                )} */}
                {subsystem.actions?.length ? (
                  <YStack gap="$2">
                    <Text style={{ fontSize: 11, fontWeight: 600 }}>Actions</Text>
                    <XStack gap="$2" flexWrap="wrap">
                      {subsystem.actions.map((action: any) => {
                        const key = `${subsystem.name}:${action.name}`
                        const status = subsystemActionStatus[key]?.state || 'idle'
                        const isLoading = status === 'loading'
                        // const message = subsystemActionStatus[key]?.message
                        return (
                          <YStack key={action.name}>
                            <TooltipSimple label={action.description || ''} restMs={0} delay={{ open: 500, close: 0 }}>
                              <Button
                                size="$3"
                                flex={1}
                                disabled={isLoading}
                                onPress={() => onSubsystemAction(subsystem.name, action)}
                                opacity={isLoading ? 0.5 : 1}
                              >
                                {(action.label || action.name || 'Action')}
                              </Button>
                            </TooltipSimple>
                            {/* {message && (
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
                            )} */}
                          </YStack>
                        )
                      })}
                    </XStack>
                    {!deviceName && (
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
                        Define `esphome.name` para habilitar las acciones.
                      </div>
                    )}
                  </YStack>
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

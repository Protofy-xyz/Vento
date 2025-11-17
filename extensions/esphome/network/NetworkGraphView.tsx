import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tinted } from 'protolib/components/Tinted'
import { API } from 'protobase'
import {
  ReactFlow,
  Background,
  useEdgesState,
  useNodesState,
  getBezierPath,
} from 'reactflow'
import 'reactflow/dist/style.css'
import DeviceNode from '@extensions/esphome/network/DeviceNode'
import { buildComponentTemplates } from '@extensions/esphome/components/templates'
import type {
  ComponentTemplate,
  TemplateField,
  TemplateHelpers,
} from '@extensions/esphome/components/templates'

const CurvyEdge = (props: any) => {
  const [edgePath] = getBezierPath({ ...props, curvature: 0.3 })
  return (
    <path
      id={props.id}
      d={edgePath}
      stroke={props.style?.stroke || 'var(--color7)'}
      strokeWidth={2.5}
      fill="none"
      markerEnd="url(#arrowhead)"
    />
  )
}

const edgeTypes = { curvy: CurvyEdge }
const nodeTypes = { device: DeviceNode }

type NetworkGraphViewProps = {
  schematic: any
  onSchematicChange?: (schematic: any) => void
}

export const NetworkGraphView = ({
  schematic,
  onSchematicChange = () => {},
}: NetworkGraphViewProps) => {
  const [components, setComponents] = useState<any[]>(schematic?.components || [])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [newComponentType, setNewComponentType] = useState('')
  const [newComponentValues, setNewComponentValues] = useState<Record<string, any>>({})
  const lastTemplateTypeRef = useRef<string | null>(null)
  const [subsystemActionStatus, setSubsystemActionStatus] = useState<
    Record<
      string,
      {
        state: 'idle' | 'loading' | 'success' | 'error'
        message?: string
      }
    >
  >({})

  useEffect(() => {
    setComponents(schematic?.components || [])
  }, [schematic])

  const handleComponentsChange = useCallback(
    (updater: any) => {
      setComponents((prev) => {
        const nextComponents =
          typeof updater === 'function' ? updater(prev) : updater
        onSchematicChange({ ...schematic, components: nextComponents })
        return nextComponents
      })
    },
    [onSchematicChange, schematic]
  )

  // === Calcular layout ===
  const nodes = useMemo(() => {
    const list: any[] = []
    const esp = components.find((c: any) => c.center)
    if (!esp) return []

    // === ESP32 central ===
    list.push({
      id: esp.id,
      type: 'device',
      position: { x: 0, y: 0 },
      data: { ...esp },
      draggable: false,
      selectable: false,
    })

    // === Calcular posiciones de cada pin ===
    const pinYPositions: Record<string, number> = {}
    const allPins = [
      ...(esp.pins.left?.map((p: any, i: number) => ({
        name: p.name,
        y: -((i - esp.pins.left.length / 2) * 40),
      })) || []),
      ...(esp.pins.right?.map((p: any, i: number) => ({
        name: p.name,
        y: -((i - esp.pins.right.length / 2) * 40),
      })) || []),
    ]
    allPins.forEach((p) => (pinYPositions[p.name] = p.y))

    const placedY: Record<string, number> = {}

    components.forEach((c) => {
      if (c.center) return // skip ESP32

      // Detectar el primer pin conectado
      const firstInput =
        c.pins?.left?.find((p: any) => p.connectedTo)?.connectedTo ||
        c.pins?.right?.find((p: any) => p.connectedTo)?.connectedTo ||
        ''

      const leftPins = esp.pins.left.map((p: any) => p.name)
      const rightPins = esp.pins.right.map((p: any) => p.name)

      let x = 0
      let y = 0
      let side: 'left' | 'right' = 'right'

      // Conectado al lado izquierdo del ESP32
      if (leftPins.includes(firstInput)) {
        x = -400
        y = pinYPositions[firstInput] || 0
        side = 'left'
      }
      // Conectado al lado derecho del ESP32
      else if (rightPins.includes(firstInput)) {
        x = 400
        y = pinYPositions[firstInput] || 0
        side = 'right'
      }
      // Conectado a otro componente (por ejemplo, bus)
      else {
        const sourceComponent = components.find((cmp: any) =>
          cmp.pins?.right?.some((out: any) => out.name === firstInput)
        )
        if (sourceComponent) {
          const parentY = placedY[sourceComponent.id] ?? 0
          const sourceSide = sourceComponent.side || sourceComponent.data?.side
          x = sourceSide === 'left' ? -800 : 800
          y = parentY + 100
          side = 'right'
        } else {
          x = 800
          y = 0
        }
      }

      placedY[c.id] = y
      list.push({
        id: c.id,
        type: 'device',
        position: { x, y },
        data: { ...c, side },
        selected: c.id === selectedNodeId,
      })
    })

    return list
  }, [components, selectedNodeId])

  // === Crear edges ===
  const edges = useMemo(() => {
    const list: any[] = []
    const esp = components.find((c: any) => c.center)
    if (!esp) return []

    components.forEach((c) => {
      if (c.center || !c.pins) return

      // Combinar todos los pines del nodo
      const allPins = [...(c.pins.left || []), ...(c.pins.right || [])]

      allPins.forEach((p: any) => {
        if (!p.connectedTo) return

        let source = esp.id
        let sourceHandle = p.connectedTo
        let color = 'var(--color8)'

        // Buscar si el connectedTo pertenece a otro componente (ej. I2C bus)
        const sourceComponent = components.find((cmp: any) =>
          cmp.pins?.right?.some((out: any) => out.name === p.connectedTo)
        )

        if (sourceComponent) {
          source = sourceComponent.id
          sourceHandle = p.connectedTo
          color = '#00c896' // Verde para buses
        }

        list.push({
          id: `${sourceHandle}->${c.id}-${p.name}`,
          source,
          sourceHandle,
          target: c.id,
          targetHandle: p.name,
          type: 'curvy',
          animated: true,
          style: { stroke: color, strokeWidth: 2 },
        })
      })
    })

    return list
  }, [components])

  const [nodesState, setNodesState, onNodesChange] = useNodesState(nodes)
  const [edgesState, setEdgesState, internalOnEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    setNodesState(nodes)
  }, [nodes, setNodesState])

  useEffect(() => {
    setEdgesState(edges)
  }, [edges, setEdgesState])

  const updatePinConnection = useCallback(
    (componentId: string, pinName: string, value: string | null) => {
      handleComponentsChange((prev: any[]) =>
        prev.map((component) => {
          if (component.id !== componentId) return component
          const updateSide = (pins: any[] = []) =>
            pins.map((pin) =>
              pin.name === pinName ? { ...pin, connectedTo: value } : pin
            )
          return {
            ...component,
            pins: {
              left: updateSide(component.pins?.left),
              right: updateSide(component.pins?.right),
            },
          }
        })
      )
    },
    [handleComponentsChange]
  )

  const handleConnect = useCallback(
    (connection: any) => {
      if (!connection?.target || !connection?.targetHandle) return
      const connectedTo = connection.sourceHandle || connection.source
      updatePinConnection(connection.target, connection.targetHandle, connectedTo)
    },
    [updatePinConnection]
  )

  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      internalOnEdgesChange(changes)
      changes.forEach((change) => {
        if (change.type === 'remove') {
          const removedEdge = edgesState.find((edge) => edge.id === change.id)
          if (removedEdge?.target && removedEdge?.targetHandle) {
            updatePinConnection(removedEdge.target, removedEdge.targetHandle, null)
          }
        }
      })
    },
    [edgesState, internalOnEdgesChange, updatePinConnection]
  )

  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedNodeId),
    [components, selectedNodeId]
  )

  const componentSubsystems = useMemo(() => {
    if (!selectedComponent) return []
    const candidateIds = new Set<string>()
    const possibleIds = [
      selectedComponent.id,
      selectedComponent.meta?.raw?.id,
      selectedComponent.meta?.raw?.name,
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)
    possibleIds.forEach((value) => candidateIds.add(value))
    if (!candidateIds.size) return []
    return (schematic?.subsystems || []).filter((subsystem: any) => {
      const targetId =
        (typeof subsystem?.componentId === 'string' && subsystem.componentId) ||
        (typeof subsystem?.name === 'string' && subsystem.name) ||
        (typeof subsystem?.id === 'string' && subsystem.id)
      return !!targetId && candidateIds.has(targetId)
    })
  }, [schematic?.subsystems, selectedComponent])

  const deviceName = schematic?.config?.esphome?.name

  const handleSubsystemAction = useCallback(
    async (subsystemName: string, action: any) => {
      const key = `${subsystemName}:${action?.name}`
      if (!subsystemName || !action?.name) return
      if (!deviceName) {
        setSubsystemActionStatus((prev) => ({
          ...prev,
          [key]: { state: 'error', message: 'Configura esphome.name para ejecutar acciones.' },
        }))
        return
      }
      setSubsystemActionStatus((prev) => ({
        ...prev,
        [key]: { state: 'loading' },
      }))
      try {
        let url = `/api/core/v1/devices/${encodeURIComponent(
          deviceName
        )}/subsystems/${encodeURIComponent(subsystemName)}/actions/${encodeURIComponent(action.name)}`
        const valueParam =
          action.value ??
          action.defaultValue ??
          action.payload?.value ??
          action.params?.value ??
          null
        if (valueParam !== null && valueParam !== undefined && valueParam !== '') {
          url += `/${encodeURIComponent(String(valueParam))}`
        }
        const result: any = await API.get(url)
        if (result?.isError) {
          throw result.error || new Error('Error ejecutando la acción')
        }
        setSubsystemActionStatus((prev) => ({
          ...prev,
          [key]: { state: 'success', message: 'Acción ejecutada' },
        }))
      } catch (error: any) {
        setSubsystemActionStatus((prev) => ({
          ...prev,
          [key]: {
            state: 'error',
            message: error?.message || 'No se pudo ejecutar la acción',
          },
        }))
        console.error('Error executing subsystem action', error)
      }
    },
    [deviceName]
  )

  const connectionOptions = useMemo(() => {
    const handles = new Set<string>()
    components.forEach((component) => {
      component.pins?.left?.forEach((pin: any) => handles.add(pin.name))
      component.pins?.right?.forEach((pin: any) => handles.add(pin.name))
    })
    return Array.from(handles)
  }, [components])

  const availableI2CBuses = useMemo(() => {
    return components
      .filter((component) => component.category === 'i2c-bus')
      .map(
        (component) =>
          component.meta?.busId ||
          component.pins?.right?.[0]?.name ||
          component.id
      )
      .filter(Boolean)
  }, [components])

  const componentCounts = useMemo(() => {
    return components.reduce<Record<string, number>>((acc, component) => {
      acc[component.category] = (acc[component.category] || 0) + 1
      return acc
    }, {})
  }, [components])

  const ensureUniqueId = useCallback(
    (baseId: string) => {
      let candidate = baseId && baseId.trim() ? baseId.trim() : `Device${components.length + 1}`
      if (!components.some((component) => component.id === candidate)) {
        return candidate
      }
      let index = 2
      while (components.some((component) => component.id === `${candidate}${index}`)) {
        index += 1
      }
      return `${candidate}${index}`
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

  useEffect(() => {
    if (!newComponentType) {
      setNewComponentValues({})
      lastTemplateTypeRef.current = null
      return
    }
    if (lastTemplateTypeRef.current !== newComponentType) {
      const template = componentTemplates[newComponentType]
      setNewComponentValues(template?.defaults || {})
      lastTemplateTypeRef.current = newComponentType
    }
  }, [newComponentType, componentTemplates])

  const selectedTemplate = newComponentType
    ? componentTemplates[newComponentType]
    : undefined

  const mergedNewComponentValues = useMemo(() => {
    if (!selectedTemplate) return {}
    return { ...selectedTemplate.defaults, ...newComponentValues }
  }, [selectedTemplate, newComponentValues])

  const handleEditablePropChange = useCallback(
    (componentId: string, propKey: string, value: any) => {
      handleComponentsChange((prev: any[]) =>
        prev.map((component) => {
          if (component.id !== componentId) return component
          return {
            ...component,
            editableProps: {
              ...component.editableProps,
              [propKey]: {
                ...component.editableProps?.[propKey],
                default: value,
              },
            },
          }
        })
      )
    },
    [handleComponentsChange]
  )

  const handlePinFieldChange = useCallback(
    (componentId: string, side: 'left' | 'right', pinName: string, value: string) => {
      handleComponentsChange((prev: any[]) =>
        prev.map((component) => {
          if (component.id !== componentId) return component
          const updatedPins = (component.pins?.[side] || []).map((pin: any) =>
            pin.name === pinName ? { ...pin, connectedTo: value } : pin
          )
          return {
            ...component,
            pins: {
              ...component.pins,
              [side]: updatedPins,
            },
          }
        })
      )
    },
    [handleComponentsChange]
  )

  const handleNewComponentValueChange = useCallback(
    (field: TemplateField, rawValue: any) => {
      setNewComponentValues((prev) => {
        if (field.type === 'boolean') {
          return { ...prev, [field.name]: !!rawValue }
        }
        if (field.type === 'number') {
          return {
            ...prev,
            [field.name]: rawValue === '' || rawValue === null ? '' : Number(rawValue),
          }
        }
        return { ...prev, [field.name]: rawValue }
      })
    },
    []
  )

  const templateHelpers = useMemo<TemplateHelpers>(
    () => ({
      ensureUniqueId,
      availableI2CBuses,
    }),
    [ensureUniqueId, availableI2CBuses]
  )

  const canAddComponent =
    !!selectedTemplate &&
    selectedTemplate.fields.every((field) => {
      if (!field.required) return true
      if (field.type === 'boolean') return true
      const value = mergedNewComponentValues[field.name]
      return value !== undefined && value !== null && String(value).trim() !== ''
    })

  const handleAddComponent = useCallback(() => {
    if (!selectedTemplate || !canAddComponent) return
    const component = selectedTemplate.build(mergedNewComponentValues, templateHelpers)
    handleComponentsChange((prev: any[]) => [...prev, component])
    setSelectedNodeId(component.id)
    setNewComponentType('')
    setNewComponentValues({})
    lastTemplateTypeRef.current = null
  }, [
    canAddComponent,
    handleComponentsChange,
    mergedNewComponentValues,
    selectedTemplate,
    templateHelpers,
  ])

  return (
    <Tinted>
      <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={1.5}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--color7)" />
            </marker>
          </defs>
          <Background gap={24} />
        </ReactFlow>
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 300,
            borderRadius: 12,
            padding: 16,
            background: 'var(--bgPanel)',
            border: '1px solid var(--gray6)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
            maxHeight: '90%',
            overflowY: 'auto',
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Editor de nodo</h3>
          {selectedComponent ? (
            <>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Nombre visible
              </label>
              <input
                type="text"
                value={selectedComponent.label || ''}
                onChange={(e) =>
                  handleComponentsChange((prev: any[]) =>
                    prev.map((component) =>
                      component.id === selectedComponent.id
                        ? { ...component, label: e.target.value }
                        : component
                    )
                  )
                }
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
                Object.entries(selectedComponent.editableProps).map(
                  ([propKey, prop]: any) => {
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
                              onChange={(e) =>
                                handleEditablePropChange(
                                  selectedComponent.id,
                                  propKey,
                                  e.target.checked
                                )
                              }
                            />
                            <span>{prop.description}</span>
                          </label>
                        ) : (
                          <input
                            type={type === 'number' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) => {
                              const rawValue = e.target.value
                              const nextValue =
                                type === 'number'
                                  ? rawValue === ''
                                    ? ''
                                    : Number(rawValue)
                                  : rawValue
                              handleEditablePropChange(
                                selectedComponent.id,
                                propKey,
                                nextValue
                              )
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
                  }
                )}
              {(selectedComponent.pins?.left?.length ||
                selectedComponent.pins?.right?.length) && (
                <>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Conexiones
                  </label>
                  <datalist id="network-graph-connection-options">
                    {connectionOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                  {[
                    ['left', selectedComponent.pins?.left],
                    ['right', selectedComponent.pins?.right],
                  ].map(
                    ([side, pins]: any) =>
                      (pins || []).map((pin: any) => (
                        <div key={`${side}-${pin.name}`} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, marginBottom: 2 }}>{pin.name}</div>
                          <input
                            list="network-graph-connection-options"
                            value={pin.connectedTo || ''}
                            onChange={(e) =>
                              handlePinFieldChange(
                                selectedComponent.id,
                                side,
                                pin.name,
                                e.target.value
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
              {componentSubsystems.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Subsistemas asociados
                  </label>
                  <div
                    style={{
                      border: '1px solid var(--gray6)',
                      borderRadius: 8,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: 'var(--bg)',
                    }}
                  >
                    {componentSubsystems.map((subsystem: any, idx: number) => {
                      const subsystemName =
                        subsystem.name || subsystem.componentId || `Subsystem ${idx + 1}`
                      return (
                        <div
                          key={`${subsystem.name || subsystem.componentId || idx}`}
                          style={{
                            borderBottom:
                              idx < componentSubsystems.length - 1
                                ? '1px solid var(--gray6)'
                                : 'none',
                            paddingBottom: idx < componentSubsystems.length - 1 ? 8 : 0,
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            {subsystemName}
                            {subsystem.type && (
                              <span style={{ fontSize: 11, opacity: 0.7 }}> - {subsystem.type}</span>
                            )}
                          </div>
                          {subsystem.actions?.length ? (
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                                Acciones
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {subsystem.actions.map((action: any) => {
                                  const actionKey = `${subsystemName}:${action.name}`
                                  const status = subsystemActionStatus[actionKey]?.state || 'idle'
                                  const message = subsystemActionStatus[actionKey]?.message
                                  const isLoading = status === 'loading'
                                  const disabled = !deviceName || isLoading
                                  return (
                                    <div key={`${action.name}-${actionKey}`}>
                                      <button
                                        disabled={disabled}
                                        onClick={() =>
                                          handleSubsystemAction(
                                            subsystem.name || subsystem.componentId || '',
                                            action
                                          )
                                        }
                                        style={{
                                          width: '100%',
                                          padding: '6px 8px',
                                          borderRadius: 6,
                                          border: '1px solid var(--gray6)',
                                          background: disabled
                                            ? 'var(--gray5)'
                                            : 'var(--color8)',
                                          color: disabled ? 'var(--gray10)' : 'var(--softContrast)',
                                          cursor: disabled ? 'not-allowed' : 'pointer',
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
                                              status === 'error'
                                                ? 'var(--red10)'
                                                : 'var(--green10)',
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
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              Selecciona un nodo para ver sus propiedades y realizar cambios.
            </p>
          )}
          <div
            style={{
              marginTop: 20,
              paddingTop: 12,
              borderTop: '1px solid var(--gray6)',
            }}
          >
            <h4 style={{ margin: '0 0 8px 0' }}>Añadir componente</h4>
            <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              Tipo
            </label>
            <select
              value={newComponentType}
              onChange={(e) => setNewComponentType(e.target.value)}
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
                  <p style={{ marginTop: 0, marginBottom: 8 }}>
                    {selectedTemplate.description}
                  </p>
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
                          onChange={(e) =>
                            handleNewComponentValueChange(field, e.target.checked)
                          }
                        />
                        <span>{field.label}</span>
                      </label>
                    )
                  }
                  const datalistId = field.suggestions
                    ? `suggestions-${newComponentType}-${field.name}`
                    : undefined
                  const inputProps: any = {}
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
                        onChange={(e) =>
                          handleNewComponentValueChange(field, e.target.value)
                        }
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
                      {field.description && (
                        <small style={{ opacity: 0.7 }}>{field.description}</small>
                      )}
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
                  onClick={handleAddComponent}
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
        </div>
      </div>
    </Tinted>
  )
}
export default NetworkGraphView
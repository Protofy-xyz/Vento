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
import DeviceNode from '../network/DeviceNode'
import type { TemplateField, TemplateHelpers } from '../components/templates'
import DeviceEditorPanel from './components/DeviceEditorPanel'
import AddComponentForm from './components/AddComponentForm'
import ConnectionOptionsDatalist from './components/ConnectionOptionsDatalist'
import { useGraphNodes, type NodeSizeMap } from './hooks/useGraphNodes'
import { useGraphEdges } from './hooks/useGraphEdges'
import { useComponentTemplates } from './hooks/useComponentTemplates'

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
  onSchematicChange = () => { },
}: NetworkGraphViewProps) => {
  const [components, setComponents] = useState<any[]>(schematic?.components || [])
  const [nodeSizes, setNodeSizes] = useState<NodeSizeMap>({})
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
  const nodes = useGraphNodes(components, nodeSizes, selectedNodeId)

  // === Crear edges ===
  const edges = useGraphEdges(components)

  const [nodesState, setNodesState, onNodesChange] = useNodesState(nodes)
  const [edgesState, setEdgesState, internalOnEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    setNodesState(nodes)
  }, [nodes, setNodesState])

  useEffect(() => {
    setNodeSizes((prev) => {
      let changed = false
      const next = { ...prev }
      nodesState.forEach((node: any) => {
        if (!node.width || !node.height) return
        const stored = prev[node.id]
        if (!stored || stored.width !== node.width || stored.height !== node.height) {
          next[node.id] = { width: node.width, height: node.height }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [nodesState])

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

  const isBoardComponent = (component) => component?.center === true

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

  const { ensureUniqueId, availableI2CBuses, componentTemplates } =
    useComponentTemplates(components)

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

  const handleLabelChange = useCallback(
    (componentId: string, nextLabel: string) => {
      handleComponentsChange((prev: any[]) =>
        prev.map((component) =>
          component.id === componentId ? { ...component, label: nextLabel } : component
        )
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
      <ConnectionOptionsDatalist options={connectionOptions} />
      <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
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
            backdropFilter: 'blur(16px)',
            background: 'var(--bgPanel) + 80',
            border: '1px solid var(--gray6)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
            maxHeight: '90%',
            overflowY: 'auto',
          }}
        >
          {/* <h3 style={{ marginTop: 0, marginBottom: 12 }}>Editor de nodo</h3> */}
          {selectedComponent && !isBoardComponent(selectedComponent)
            ? (
              <DeviceEditorPanel
                selectedComponent={selectedComponent}
                onLabelChange={handleLabelChange}
                onEditablePropChange={handleEditablePropChange}
                onPinFieldChange={handlePinFieldChange}
                componentSubsystems={componentSubsystems}
                subsystemActionStatus={subsystemActionStatus}
                onSubsystemAction={handleSubsystemAction}
                deviceName={deviceName}
                connectionOptions={connectionOptions}
              />
            )
            : (
              <AddComponentForm
                componentTemplates={componentTemplates}
                newComponentType={newComponentType}
                onComponentTypeChange={(value) => setNewComponentType(value)}
                selectedTemplate={selectedTemplate}
                mergedNewComponentValues={mergedNewComponentValues}
                onFieldChange={handleNewComponentValueChange}
                onAddComponent={handleAddComponent}
                canAddComponent={canAddComponent}
                connectionOptions={connectionOptions}
              />
            )}
        </div>
      </div>
    </Tinted>
  )
}
export default NetworkGraphView

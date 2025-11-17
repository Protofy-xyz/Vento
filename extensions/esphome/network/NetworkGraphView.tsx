import React, { useMemo } from 'react'
import { Tinted } from 'protolib/components/Tinted'
import {
  ReactFlow,
  Background,
  useEdgesState,
  useNodesState,
  getBezierPath,
} from 'reactflow'
import 'reactflow/dist/style.css'
import DeviceNode from '@extensions/esphome/network/DeviceNode'

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

export const NetworkGraphView = ({ schematic }: { schematic: any }) => {
console.log("DEV:::: 🚀 ~ file: ElectricalGraphView.tsx:28 ~ ElectricalGraphView ~ schematic:", schematic)
  const components = schematic.components || []

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
          x = sourceComponent.data?.side === 'left' ? -800 : 800
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
      })
    })

    return list
  }, [schematic])

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
  }, [schematic])

  const [nodesState, , onNodesChange] = useNodesState(nodes)
  const [edgesState, , onEdgesChange] = useEdgesState(edges)

  return (
    <Tinted>
      <div style={{ width: '100%', height: '100vh' }}>
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
      </div>
    </Tinted>
  )
}
export default NetworkGraphView
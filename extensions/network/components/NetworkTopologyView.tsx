import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { API } from 'protobase'
import { Tinted } from 'protolib/components/Tinted'
import { useThemeSetting } from '@tamagui/next-theme'
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useInternalNode,
  getBezierPath,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { YStack, Text, XStack, Spinner, Image, useThemeName } from '@my/ui'
import { shouldShowInArea } from 'protolib/helpers/Visibility'
import { NetworkCard, getIconForPlatform } from './NetworkCard'

const CFG = {
  VENTO_NODE_SIZE: { width: 100, height: 100 },
  VENTO_NODE_BORDER: "$4",
  DEVICE_NODE_SIZE: { width: 260, height: 140 },
  RADIUS: 420,
  VIEWPORT: { x: 0, y: 0, zoom: 0.7 },
} as const

// Get edge params for floating edges (similar to ReactFlow example)
function getEdgeParams(sourceNode: any, targetNode: any, sourceSize: { width: number; height: number }, targetSize: { width: number; height: number }, sourceIsCircle = false) {
  const sourcePos = sourceNode.internals.positionAbsolute
  const targetPos = targetNode.internals.positionAbsolute

  const sourceCenterX = sourcePos.x + sourceSize.width / 2
  const sourceCenterY = sourcePos.y + sourceSize.height / 2
  const targetCenterX = targetPos.x + targetSize.width / 2
  const targetCenterY = targetPos.y + targetSize.height / 2

  // Calculate angle between centers
  const dx = targetCenterX - sourceCenterX
  const dy = targetCenterY - sourceCenterY
  const angle = Math.atan2(dy, dx)
  
  let sx: number, sy: number, sourcePosition: Position
  let tx: number, ty: number, targetPosition: Position

  // Source point (Vento hub - circle)
  if (sourceIsCircle) {
    const radius = sourceSize.width / 2
    sx = sourceCenterX + Math.cos(angle) * radius
    sy = sourceCenterY + Math.sin(angle) * radius
    
    // Determine position for bezier curve direction
    const angleDeg = (angle * 180) / Math.PI
    if (angleDeg >= -45 && angleDeg < 45) sourcePosition = Position.Right
    else if (angleDeg >= 45 && angleDeg < 135) sourcePosition = Position.Bottom
    else if (angleDeg >= -135 && angleDeg < -45) sourcePosition = Position.Top
    else sourcePosition = Position.Left
  } else {
    // Rectangle intersection for source
    const result = getRectIntersectionPoint(sourcePos.x, sourcePos.y, sourceSize.width, sourceSize.height, targetCenterX, targetCenterY)
    sx = result.x
    sy = result.y
    sourcePosition = result.position
  }

  // Target point (device card - rectangle)
  const targetResult = getRectIntersectionPoint(targetPos.x, targetPos.y, targetSize.width, targetSize.height, sourceCenterX, sourceCenterY)
  tx = targetResult.x
  ty = targetResult.y
  targetPosition = targetResult.position

  return { sx, sy, tx, ty, sourcePos: sourcePosition, targetPos: targetPosition }
}

// Helper: get intersection point on rectangle border
function getRectIntersectionPoint(
  rx: number, ry: number, rw: number, rh: number,
  px: number, py: number
): { x: number; y: number; position: Position } {
  const cx = rx + rw / 2
  const cy = ry + rh / 2
  const dx = px - cx
  const dy = py - cy
  
  const angle = Math.atan2(dy, dx)
  const absCos = Math.abs(Math.cos(angle))
  const absSin = Math.abs(Math.sin(angle))
  
  let x: number, y: number
  let position: Position
  
  if (rw / 2 * absSin <= rh / 2 * absCos) {
    // Intersects left or right side
    x = dx > 0 ? rx + rw : rx
    y = cy + (dx > 0 ? 1 : -1) * (rw / 2) * Math.tan(angle)
    position = dx > 0 ? Position.Right : Position.Left
  } else {
    // Intersects top or bottom side
    x = cx + (dy > 0 ? 1 : -1) * (rh / 2) / Math.tan(angle)
    y = dy > 0 ? ry + rh : ry
    position = dy > 0 ? Position.Bottom : Position.Top
  }
  
  return { x, y, position }
}

// Simple hash function to get a pseudo-random value from string
const hashString = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

// Floating edge using getBezierPath like ReactFlow example
const FloatingEdge = memo(({ id, source, target, data, style }: any) => {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  
  const isConnected = data?.connected === true
  const strokeColor = isConnected ? 'var(--green9)' : 'var(--gray7)'

  // Using negative begin makes the animation start as if it's already been running
  const offset = useMemo(() => {
    const hash = hashString(id)
    const dur = 2.5 + (hash % 1500) / 1000 // 2.5-4s duration
    return  -((hash % 1000) / 1000) * dur // negative offset
  }, [id])

  if (!sourceNode || !targetNode) return null

  // Get edge params with floating positions
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode,
    CFG.VENTO_NODE_SIZE,
    CFG.DEVICE_NODE_SIZE,
    true // source is circle (Vento hub)
  )

  // Use ReactFlow's getBezierPath for smooth curves
  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: targetPos,
  })

  return (
    <>
      <path
        id={id}
        d={edgePath}
        stroke={strokeColor}
        strokeWidth={1}
        strokeDasharray={'6 4'}
        fill="none"
        style={{ 
          opacity: isConnected ? 1 : 0.5,
          filter: isConnected ? 'drop-shadow(0 0 3px var(--green9))' : undefined,
          ...style
        }}
      />
      {isConnected && (
        <circle r="3" fill="var(--green9)">
          <animateMotion 
            dur="3s"
            begin={`${offset}s`}
            repeatCount="indefinite" 
            path={edgePath}
            keyPoints="0;1;0"
            keyTimes="0;0.5;1"
            calcMode="linear"
          />
        </circle>
      )}
    </>
  )
})

// Central Vento Hub node - premium design with logo
const VentoNode = memo(({ data }: { data: any }) => {
  const themeName = useThemeName()
  const isDark = themeName?.startsWith('dark')
  
  return (
    <YStack
      width={CFG.VENTO_NODE_SIZE.width}
      height={CFG.VENTO_NODE_SIZE.height}
      br={CFG.VENTO_NODE_BORDER}
      ai="center"
      jc="center"
      style={{
        background: 'linear-gradient(145deg, var(--color5), var(--color3))',
        boxShadow: '0 0 40px rgba(var(--color9-rgb), 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        border: '3px solid var(--color8)',
      }}
    >
      <YStack
        position="absolute"
        top={-8}
        right={-8}
        bg="$green9"
        br="$10"
        px="$2"
        py="$1"
      >
        <Text fontSize={9} fontWeight="700" color="white">ONLINE</Text>
      </YStack>
      
      {/* Vento Logo */}
      <Image
        src="/public/vento-square.png"
        alt="Vento"
        width={"$5"}
        height={"$5"}
        style={{ 
          filter: isDark ? 'invert(70%) brightness(10)' : 'invert(5%)',
          objectFit: 'contain'
        }}
      />
      
      {/* Invisible handle for floating edges (required by ReactFlow) */}
      <Handle 
        type="source" 
        position={Position.Right} 
        id="source"
        style={{ opacity: 0, pointerEvents: 'none' }} 
      />
    </YStack>
  )
})

// Device node wrapper - uses NetworkCard in node mode
const DeviceNode = memo(({ data, selected }: { data: any; selected?: boolean }) => {
  // Ensure connected is explicitly boolean to match edge state
  const isConnected = data.connected === true
  
  return (
    <NetworkCard
      board={data.originalData}
      platform={data.type}
      isConnected={isConnected}
      isHidden={data.isHidden}
      selected={selected}
      mode="node"
      handlePosition={data.handlePosition}
    />
  )
})

const nodeTypes = { vento: VentoNode, device: DeviceNode }
const edgeTypes = { floating: FloatingEdge }

// Get handle position based on angle (for device nodes - still needed for the card's handle)
const getHandlePosition = (angle: number): Position => {
  if (angle >= -45 && angle < 45) return Position.Left
  if (angle >= 45 && angle < 135) return Position.Top
  if (angle >= 135 || angle < -135) return Position.Right
  return Position.Bottom
}

type NetworkTopologyViewProps = {
  onNodeClick?: (node: any) => void
  showAll?: boolean
}

export const NetworkTopologyView = memo(({ onNodeClick, showAll = false }: NetworkTopologyViewProps) => {
  const [boards, setBoards] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [deviceStates, setDeviceStates] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const { resolvedTheme } = useThemeSetting()
  const darkMode = resolvedTheme === 'dark'

  // Fetch boards and devices
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [boardsRes, devicesRes] = await Promise.all([
          API.get('/api/core/v1/boards?all=true'),
          API.get('/api/core/v1/devices?all=true'),
        ])
        
        if (!boardsRes.isError && boardsRes.data?.items) {
          setBoards(boardsRes.data.items)
        }
        
        if (!devicesRes.isError && devicesRes.data?.items) {
          setDevices(devicesRes.data.items)
          
          // Fetch connection states for each device
          const states: Record<string, any> = {}
          for (const device of devicesRes.data.items) {
            try {
              const stateRes = await API.get(`/api/core/v1/protomemdb/states/devices/${device.name}`)
              if (!stateRes.isError && stateRes.data) {
                states[device.name] = stateRes.data
              }
            } catch (e) {
              // Device might not have state yet
            }
          }
          setDeviceStates(states)
        }
      } catch (error) {
        console.error('Error fetching network data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  // Check if a device is connected based on recent state updates
  const isDeviceConnected = useCallback((deviceName: string) => {
    const state = deviceStates[deviceName]
    return state && Object.keys(state).length > 0
  }, [deviceStates])

  // Build nodes and edges
  const { nodes, edges } = useMemo(() => {
    const allNodes: any[] = []
    const allEdges: any[] = []
    
    // Central Vento node
    allNodes.push({
      id: 'vento-hub',
      type: 'vento',
      position: { x: 0, y: 0 },
      data: { label: 'Vento' },
      draggable: false,
    })

    // Separate boards into visible and hidden
    const visibleBoards: any[] = []
    const hiddenBoards: any[] = []
    
    boards.forEach(b => {
      // Skip device boards
      if (devices.some(d => d.name === b.name || `${d.name}_device` === b.name)) return
      
      const isVisibleInAgents = shouldShowInArea(b, 'agents')
      
      if (isVisibleInAgents) {
        visibleBoards.push(b)
      } else if (showAll) {
        hiddenBoards.push(b)
      }
    })

    // Build network elements - all use the same design now
    const networkElements = [
      // Devices first - connection state from ProtoMemDB
      ...devices.map(d => {
        const connected = isDeviceConnected(d.name) === true
        return {
          id: `device-${d.name}`,
          name: d.name,
          type: 'device',
          platform: d.platform,
          connected, // Explicit boolean
          isHidden: false,
          originalData: d,
        }
      }),
      // Visible boards - virtual boards are always connected (they run on the server)
      ...visibleBoards.map(b => ({
        id: `board-${b.name}`,
        name: b.name,
        type: 'board',
        platform: 'virtual',
        connected: true,
        isHidden: false,
        originalData: b,
      })),
      // Hidden boards (only when showAll) - same design, just with badge
      ...hiddenBoards.map(b => ({
        id: `board-${b.name}`,
        name: b.name,
        type: 'board',
        platform: 'virtual',
        connected: true,
        isHidden: true,
        originalData: b,
      })),
    ]

    // Position elements in a circle around Vento
    const count = networkElements.length
    if (count === 0) return { nodes: allNodes, edges: allEdges }

    const angleStep = (2 * Math.PI) / count
    const startAngle = -Math.PI / 2 // Start from top

    networkElements.forEach((element, index) => {
      const angle = startAngle + index * angleStep
      const angleDeg = (angle * 180) / Math.PI
      
      // All nodes use the same radius and size now
      const x = Math.cos(angle) * CFG.RADIUS - CFG.DEVICE_NODE_SIZE.width / 2
      const y = Math.sin(angle) * CFG.RADIUS - CFG.DEVICE_NODE_SIZE.height / 2

      const handlePosition = getHandlePosition(angleDeg)

      allNodes.push({
        id: element.id,
        type: 'device',
        position: { x, y },
        data: {
          label: element.name,
          type: element.platform,
          connected: element.connected,
          isHidden: element.isHidden,
          icon: getIconForPlatform(element.platform),
          handlePosition,
          originalData: element.originalData,
        },
      })

      // Create floating edge from Vento to this element
      allEdges.push({
        id: `edge-${element.id}`,
        source: 'vento-hub',
        target: element.id,
        type: 'floating',
        data: { connected: element.connected },
      })
    })

    return { nodes: allNodes, edges: allEdges }
  }, [boards, devices, isDeviceConnected, showAll])

  const [nodesState, setNodesState, onNodesChange] = useNodesState(nodes)
  const [edgesState, setEdgesState] = useEdgesState(edges)

  useEffect(() => {
    setNodesState(nodes)
  }, [nodes, setNodesState])

  useEffect(() => {
    setEdgesState(edges)
  }, [edges, setEdgesState])

  const handleNodeClick = useCallback((_: any, node: any) => {
    if (node.id !== 'vento-hub' && onNodeClick) {
      onNodeClick(node.data)
    }
  }, [onNodeClick])

  // Calculate viewport to center the graph
  const defaultViewport = useMemo(() => {
    if (typeof window === 'undefined') return CFG.VIEWPORT
    return {
      x: window.innerWidth / 2 - 80,
      y: window.innerHeight / 2 - 120,
      zoom: CFG.VIEWPORT.zoom,
    }
  }, [])

  if (loading) {
    return (
      <YStack f={1} ai="center" jc="center">
        <Tinted>
          <Spinner color="$color8" size={75} />
        </Tinted>
      </YStack>
    )
  }

  return (
    <Tinted>
      <div style={{ width: '100%', height: '100%', minHeight: '500px' }}>
        <ReactFlow
          nodes={nodesState}
          edges={edgesState}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          defaultViewport={defaultViewport}
          minZoom={0.2}
          maxZoom={1.5}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          zoomOnScroll
          zoomOnPinch
          panOnDrag
        >
          <Background gap={30} />
        </ReactFlow>
      </div>
    </Tinted>
  )
})

export default NetworkTopologyView

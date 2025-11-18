import { useMemo } from 'react'

export type NodeSizeMap = Record<
  string,
  {
    width: number
    height: number
  }
>

export const useGraphNodes = (
  components: any[],
  nodeSizes: NodeSizeMap,
  selectedNodeId: string | null
) => {
  return useMemo(() => {
    const esp = components.find((component: any) => component.center)
    if (!esp) return []

    type LayoutEntry = {
      id: string
      x: number
      y: number
      width: number
      height: number
      side: 'left' | 'right' | 'center'
      depth: number
    }

    const nonCenterComponents = components.filter((component) => !component.center)

    const resolveSize = (component: any) => {
      const measured = nodeSizes[component.id]
      if (measured) return measured
      if (component.center) {
        return { width: 320, height: 480 }
      }
      const editablePropsCount = Object.keys(component.editableProps || {}).length
      const maxPins = Math.max(
        component.pins?.left?.length || 0,
        component.pins?.right?.length || 0
      )
      const estimatedHeight = 120 + editablePropsCount * 32 + maxPins * 26
      return { width: 200, height: Math.max(estimatedHeight, 140) }
    }

    const espSize = resolveSize(esp)

    const buildPinOffsets = (pins: any[] = []) => {
      const offsets: Record<string, number> = {}
      if (!pins.length) return offsets
      const spacing = espSize.height / (pins.length + 1)
      pins.forEach((pin, index) => {
        offsets[pin.name] = spacing * (index + 1) - espSize.height / 2
      })
      return offsets
    }

    const pinOffsets: Record<string, number> = {
      ...buildPinOffsets(esp.pins?.left || []),
      ...buildPinOffsets(esp.pins?.right || []),
    }

    const leftPins = (esp.pins?.left || []).map((pin: any) => pin.name)
    const rightPins = (esp.pins?.right || []).map((pin: any) => pin.name)

    const pinOwnerByName: Record<string, string> = {}
    nonCenterComponents.forEach((component) => {
      const pins = [...(component.pins?.left || []), ...(component.pins?.right || [])]
      pins.forEach((pin: any) => {
        if (pin?.name) {
          pinOwnerByName[pin.name] = component.id
        }
      })
    })

    const connectedComponentIds = new Set<string>()
    const markConnected = (id?: string) => {
      if (id && id !== esp.id) {
        connectedComponentIds.add(id)
      }
    }

    nonCenterComponents.forEach((component) => {
      const pins = [...(component.pins?.left || []), ...(component.pins?.right || [])]
      pins.forEach((pin: any) => {
        if (!pin?.connectedTo) return
        markConnected(component.id)
        const ownerId = pinOwnerByName[pin.connectedTo]
        markConnected(ownerId)
      })
    })

    const connectedComponents = nonCenterComponents.filter((component) =>
      connectedComponentIds.has(component.id)
    )
    const isolatedComponents = nonCenterComponents.filter(
      (component) => !connectedComponentIds.has(component.id)
    )

    const HORIZONTAL_GAP = 80
    const VERTICAL_GAP = 40
    const COLUMN_MARGIN = 24
    const ISOLATED_HORIZONTAL_GAP = 80
    const ISOLATED_VERTICAL_OFFSET = 200

    const columnOccupancy: Record<string, Array<{ top: number; bottom: number }>> = {}
    const ensureColumn = (key: string) => {
      if (!columnOccupancy[key]) {
        columnOccupancy[key] = []
      }
      return columnOccupancy[key]
    }

    const placeInColumn = (key: string, desiredY: number, height: number) => {
      const column = ensureColumn(key)
      column.sort((a, b) => a.top - b.top)
      let y = desiredY
      for (const box of column) {
        if (y + height + COLUMN_MARGIN <= box.top) break
        if (y >= box.bottom + COLUMN_MARGIN) continue
        y = box.bottom + COLUMN_MARGIN
      }
      column.push({ top: y, bottom: y + height })
      column.sort((a, b) => a.top - b.top)
      return y
    }

    const layoutMap: Record<string, LayoutEntry> = {
      [esp.id]: {
        id: esp.id,
        x: 0,
        y: 0,
        width: espSize.width,
        height: espSize.height,
        side: 'center',
        depth: 0,
      },
    }

    const findConnectionInfo = (component: any) => {
      const firstInput =
        component.pins?.left?.find((pin: any) => pin.connectedTo)?.connectedTo ||
        component.pins?.right?.find((pin: any) => pin.connectedTo)?.connectedTo ||
        ''

      if (!firstInput) {
        return { parentId: esp.id, preferredSide: 'right' as 'left' | 'right', pinName: undefined }
      }

      if (leftPins.includes(firstInput)) {
        return { parentId: esp.id, preferredSide: 'left' as const, pinName: firstInput }
      }
      if (rightPins.includes(firstInput)) {
        return { parentId: esp.id, preferredSide: 'right' as const, pinName: firstInput }
      }

      const ownerId = pinOwnerByName[firstInput]
      if (ownerId) {
        return { parentId: ownerId, preferredSide: undefined, pinName: firstInput }
      }

      return { parentId: esp.id, preferredSide: 'right' as const, pinName: undefined }
    }

    const pending = connectedComponents.slice()
    const maxIterations = pending.length * 5 || 1
    let iterations = 0

    while (pending.length && iterations < maxIterations) {
      iterations += 1
      let placedSomething = false

      for (let i = pending.length - 1; i >= 0; i--) {
        const component = pending[i]
        const connection = findConnectionInfo(component)
        const parentLayout = layoutMap[connection.parentId || esp.id]
        if (!parentLayout) continue

        const size = resolveSize(component)
        const parentSide =
          parentLayout.side === 'center'
            ? (connection.preferredSide || 'right')
            : (parentLayout.side as 'left' | 'right')
        const side = parentSide || 'right'
        const depth = (parentLayout.depth || 0) + 1

        const columnKey = `${side}-${depth}`
        let desiredY: number
        if (parentLayout.id === esp.id && connection.pinName) {
          const parentCenterY = parentLayout.y + parentLayout.height / 2
          const offset = pinOffsets[connection.pinName] || 0
          desiredY = parentCenterY + offset - size.height / 2
        } else {
          desiredY = parentLayout.y + parentLayout.height + VERTICAL_GAP
        }
        const y = placeInColumn(columnKey, desiredY, size.height)

        const x =
          side === 'left'
            ? parentLayout.x - size.width - HORIZONTAL_GAP
            : parentLayout.x + parentLayout.width + HORIZONTAL_GAP

        layoutMap[component.id] = {
          id: component.id,
          x,
          y,
          width: size.width,
          height: size.height,
          side,
          depth,
        }
        pending.splice(i, 1)
        placedSomething = true
      }

      if (!placedSomething) {
        break
      }
    }

    if (pending.length) {
      const fallbackParent = layoutMap[esp.id]
      pending.forEach((component, index) => {
        const size = resolveSize(component)
        const side: 'left' | 'right' = index % 2 === 0 ? 'right' : 'left'
        const depth = 10 + index
        const columnKey = `${side}-${depth}`
        const desiredY =
          fallbackParent.y + fallbackParent.height + VERTICAL_GAP * (index + 1)
        const y = placeInColumn(columnKey, desiredY, size.height)
        const x =
          side === 'left'
            ? fallbackParent.x - size.width - HORIZONTAL_GAP * (depth / 2)
            : fallbackParent.x + fallbackParent.width + HORIZONTAL_GAP * (depth / 2)

        layoutMap[component.id] = {
          id: component.id,
          x,
          y,
          width: size.width,
          height: size.height,
          side,
          depth,
        }
      })
    }

    if (isolatedComponents.length) {
      const existingLayouts = Object.values(layoutMap)
      const graphLeft = existingLayouts.length
        ? Math.min(...existingLayouts.map((entry) => entry.x))
        : 0
      const graphRight = existingLayouts.length
        ? Math.max(...existingLayouts.map((entry) => entry.x + entry.width))
        : 0
      const graphBottom = existingLayouts.length
        ? Math.max(...existingLayouts.map((entry) => entry.y + entry.height))
        : 0
      const midX = (graphLeft + graphRight) / 2

      const isolatedSizes = isolatedComponents.map((component) => ({
        component,
        size: resolveSize(component),
      }))
      const totalWidth =
        isolatedSizes.reduce((acc, entry) => acc + entry.size.width, 0) +
        ISOLATED_HORIZONTAL_GAP * Math.max(isolatedSizes.length - 1, 0)
      let currentX = midX - totalWidth / 2
      const rowY = graphBottom + ISOLATED_VERTICAL_OFFSET

      isolatedSizes.forEach(({ component, size }) => {
        layoutMap[component.id] = {
          id: component.id,
          x: currentX,
          y: rowY,
          width: size.width,
          height: size.height,
          side: 'right',
          depth: 0,
        }
        currentX += size.width + ISOLATED_HORIZONTAL_GAP
      })
    }

    const list: any[] = []
    const centerLayout = layoutMap[esp.id]
    list.push({
      id: esp.id,
      type: 'device',
      position: { x: centerLayout.x, y: centerLayout.y },
      data: { ...esp },
      draggable: false,
      selectable: false,
    })

    components
      .filter((component) => !component.center)
      .forEach((component) => {
        const layout = layoutMap[component.id]
        if (!layout) return
        list.push({
          id: component.id,
          type: 'device',
          position: { x: layout.x, y: layout.y },
          data: { ...component, side: layout.side === 'center' ? 'right' : layout.side },
          selected: component.id === selectedNodeId,
        })
      })

    return list
  }, [components, nodeSizes, selectedNodeId])
}


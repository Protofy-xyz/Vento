import { useMemo } from 'react'

export const useGraphEdges = (components: any[]) => {
  return useMemo(() => {
    const list: any[] = []
    const esp = components.find((component: any) => component.center)
    if (!esp) return []

    components.forEach((component) => {
      if (component.center || !component.pins) return

      const allPins = [...(component.pins.left || []), ...(component.pins.right || [])]

      allPins.forEach((pin: any) => {
        if (!pin.connectedTo) return

        let source = esp.id
        let sourceHandle = pin.connectedTo
        let color = 'var(--color8)'

        const sourceComponent = components.find((candidate: any) =>
          candidate.pins?.right?.some((output: any) => output.name === pin.connectedTo)
        )

        if (sourceComponent) {
          source = sourceComponent.id
          sourceHandle = pin.connectedTo
          color = '#00c896'
        }

        list.push({
          id: `${sourceHandle}->${component.id}-${pin.name}`,
          source,
          sourceHandle,
          target: component.id,
          targetHandle: pin.name,
          type: 'curvy',
          animated: true,
          style: { stroke: color, strokeWidth: 2 },
        })
      })
    })

    return list
  }, [components])
}


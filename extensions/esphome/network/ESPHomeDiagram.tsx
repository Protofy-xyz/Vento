import React, { useEffect, useState } from 'react'
import { NetworkGraphView } from './NetworkGraphView'
import { parseYaml, dumpYaml } from './ESPHome2Network'

type ESPHomeDiagramProps = {
  yaml: string
  setCode?: (code: string) => void
}

export default function ESPHomeDiagram({ yaml, setCode }: ESPHomeDiagramProps) {
  const [schematic, setSchematic] = useState<any | null>(null)

  useEffect(() => {
    const parsed = parseYaml(yaml)
    setSchematic(parsed)
  }, [yaml])

  const handleSchematicChange = (updated: any) => {
    setSchematic(updated)
    try {
      const newYaml = dumpYaml(updated)
      if (newYaml && typeof setCode === 'function') {
        setCode(newYaml)
      }
    } catch (error) {
      console.error('Error dumping ESPHome YAML from diagram changes', error)
    }
  }

  if (!schematic) {
    return <div>No schematic available</div>
  }

  return (
    <NetworkGraphView
      schematic={schematic}
      onSchematicChange={handleSchematicChange}
    />
  )
}

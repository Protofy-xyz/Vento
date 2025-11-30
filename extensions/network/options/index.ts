import React from 'react'

export interface NetworkOption {
  id: string
  name: string
  description: string
  icon: string
  Component: React.FC<{ onCreated: (data?: any) => void }>
}

// Re-exporta desde cada extensión
import { virtualAgentsOption } from '../../boards/networkOption'

export const networkOptions: NetworkOption[] = [
  virtualAgentsOption,
  // Futuras opciones:
  // import { computerOption } from '../../devices/networkOption'
  // import { esp32Option } from '../../devices/networkOption'
  // etc.
]

